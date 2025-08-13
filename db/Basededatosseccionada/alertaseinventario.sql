/* ===========================================================
   ALERTAS DE INVENTARIO – Tablas
   =========================================================== */

DROP TABLE IF EXISTS productos_sin_stock;
GO
CREATE TABLE productos_sin_stock (
  producto_id NVARCHAR(20) UNIQUE NOT NULL
);
GO

DROP TABLE IF EXISTS productos_sin_stock_log;
GO
CREATE TABLE productos_sin_stock_log (
  producto_id  NVARCHAR(20) NOT NULL,
  fecha_alerta DATETIME     NOT NULL DEFAULT GETDATE(),
  categoria_id INT          NOT NULL
);
GO

/* ===========================================================
   TRIGGER: Insert -> si activo y stock = 0 => registra en sin_stock + log
   =========================================================== */
CREATE OR ALTER TRIGGER trg_productos_zero_stock_insert
ON productos
AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;

  -- Solo productos activos con stock = 0
  INSERT INTO productos_sin_stock (producto_id)
  SELECT i.producto_id
  FROM inserted AS i
  WHERE (i.estado_producto = N'activo')
    AND i.stock = 0
    AND NOT EXISTS (
      SELECT 1 FROM productos_sin_stock s WHERE s.producto_id = i.producto_id
    );

  -- Log de alerta
  INSERT INTO productos_sin_stock_log (producto_id, categoria_id)
  SELECT i.producto_id, i.categoria_id
  FROM inserted AS i
  WHERE (i.estado_producto = N'activo') AND i.stock = 0;
END;
GO

/* ===========================================================
   TRIGGER: Update -> si activo y stock = 0 => registra en sin_stock + log
   =========================================================== */
CREATE OR ALTER TRIGGER trg_productos_zero_stock_update
ON productos
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;

  -- Solo filas cuyo nuevo valor cumpla la condición (activo y stock = 0)
  INSERT INTO productos_sin_stock (producto_id)
  SELECT i.producto_id
  FROM inserted AS i
  WHERE (i.estado_producto = N'activo')
    AND i.stock = 0
    AND NOT EXISTS (
      SELECT 1 FROM productos_sin_stock s WHERE s.producto_id = i.producto_id
    );

  -- Log de alerta
  INSERT INTO productos_sin_stock_log (producto_id, categoria_id)
  SELECT i.producto_id, i.categoria_id
  FROM inserted AS i
  WHERE (i.estado_producto = N'activo') AND i.stock = 0;
END;
GO

/* ===========================================================
   STOCK: agregar unidades
   - Suma @cantidad al stock del producto.
   - Si el nuevo stock > 0, elimina registro en productos_sin_stock.
   =========================================================== */
CREATE OR ALTER PROCEDURE productos_stock_agregar
  @producto_id NVARCHAR(20),  -- admite 'prd-123' o '123'
  @cantidad    INT
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;

  BEGIN TRY
    IF @cantidad IS NULL OR @cantidad <= 0
      THROW 52007, 'Cantidad inválida (debe ser > 0).', 1;

    DECLARE @pid NVARCHAR(20) =
      CASE WHEN LEFT(LTRIM(RTRIM(@producto_id)),4)='prd-' THEN LTRIM(RTRIM(@producto_id))
           ELSE CONCAT('prd-', LTRIM(RTRIM(@producto_id))) END;

    IF NOT EXISTS (SELECT 1 FROM productos WHERE producto_id = @pid)
      THROW 52008, 'El producto no existe.', 1;

    BEGIN TRAN;

      UPDATE p WITH (ROWLOCK, UPDLOCK)
        SET p.stock = p.stock + @cantidad
      FROM productos p
      WHERE p.producto_id = @pid;

      -- Si el stock quedó > 0, eliminar de la lista de sin stock
      DELETE FROM productos_sin_stock WHERE producto_id = @pid;

    COMMIT;

    SELECT producto_id, stock FROM productos WHERE producto_id = @pid;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs(origen, mensaje) VALUES (N'productos_stock_agregar', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

/* ===========================================================
   STOCK: reducir unidades
   - Resta @cantidad al stock del producto (sin permitir negativo).
   - Si queda exactamente 0, el trigger UPDATE registrará en sin_stock + log.
   =========================================================== */
CREATE OR ALTER PROCEDURE productos_stock_reducir
  @producto_id NVARCHAR(20),  -- admite 'prd-123' o '123'
  @cantidad    INT
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;

  BEGIN TRY
    IF @cantidad IS NULL OR @cantidad <= 0
      THROW 52007, 'Cantidad inválida (debe ser > 0).', 1;

    DECLARE @pid NVARCHAR(20) =
      CASE WHEN LEFT(LTRIM(RTRIM(@producto_id)),4)='prd-' THEN LTRIM(RTRIM(@producto_id))
           ELSE CONCAT('prd-', LTRIM(RTRIM(@producto_id))) END;

    IF NOT EXISTS (SELECT 1 FROM productos WHERE producto_id = @pid)
      THROW 52008, 'El producto no existe.', 1;

    BEGIN TRAN;

      -- No permitir stock negativo
      UPDATE p WITH (ROWLOCK, UPDLOCK)
        SET p.stock = CASE WHEN p.stock >= @cantidad THEN p.stock - @cantidad
                           ELSE 0 END
      FROM productos p
      WHERE p.producto_id = @pid;

      -- Si quedó en 0: el TRIGGER trg_productos_zero_stock_update hará el alta en sin_stock + log.

    COMMIT;

    SELECT producto_id, stock FROM productos WHERE producto_id = @pid;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs(origen, mensaje) VALUES (N'productos_stock_reducir', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

/* ===========================================================
   CONSULTAS: productos_sin_stock_log
   =========================================================== */

-- 4.1) Todos
CREATE OR ALTER PROCEDURE productos_sin_stock_log_get_all
AS
BEGIN
  SET NOCOUNT ON;
  SELECT producto_id, categoria_id, fecha_alerta
  FROM productos_sin_stock_log
  ORDER BY fecha_alerta DESC, producto_id;
END;
GO

-- 4.2) Por producto
CREATE OR ALTER PROCEDURE productos_sin_stock_log_get_by_producto
  @producto_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @pid NVARCHAR(20) =
    CASE WHEN LEFT(LTRIM(RTRIM(@producto_id)),4)='prd-' THEN LTRIM(RTRIM(@producto_id))
         ELSE CONCAT('prd-', LTRIM(RTRIM(@producto_id))) END;

  SELECT producto_id, categoria_id, fecha_alerta
  FROM productos_sin_stock_log
  WHERE producto_id = @pid
  ORDER BY fecha_alerta DESC;
END;
GO

-- 4.3) Por categoría
CREATE OR ALTER PROCEDURE productos_sin_stock_log_get_by_categoria
  @categoria_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT producto_id, categoria_id, fecha_alerta
  FROM productos_sin_stock_log
  WHERE categoria_id = @categoria_id
  ORDER BY fecha_alerta DESC, producto_id;
END;
GO

-- 4.4) Por rango de fechas (inclusive)
CREATE OR ALTER PROCEDURE productos_sin_stock_log_get_by_rango
  @desde DATETIME,
  @hasta DATETIME
AS
BEGIN
  SET NOCOUNT ON;
  SELECT producto_id, categoria_id, fecha_alerta
  FROM productos_sin_stock_log
  WHERE fecha_alerta >= @desde AND fecha_alerta <= @hasta
  ORDER BY fecha_alerta DESC, producto_id;
END;
GO

-- 4.5) Por categoría y rango
CREATE OR ALTER PROCEDURE productos_sin_stock_log_get_by_categoria_rango
  @categoria_id INT,
  @desde DATETIME,
  @hasta DATETIME
AS
BEGIN
  SET NOCOUNT ON;
  SELECT producto_id, categoria_id, fecha_alerta
  FROM productos_sin_stock_log
  WHERE categoria_id = @categoria_id
    AND fecha_alerta >= @desde AND fecha_alerta <= @hasta
  ORDER BY fecha_alerta DESC, producto_id;
END;
GO

-- 4.6) Por producto y rango
CREATE OR ALTER PROCEDURE productos_sin_stock_log_get_by_producto_rango
  @producto_id NVARCHAR(20),
  @desde DATETIME,
  @hasta DATETIME
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @pid NVARCHAR(20) =
    CASE WHEN LEFT(LTRIM(RTRIM(@producto_id)),4)='prd-' THEN LTRIM(RTRIM(@producto_id))
         ELSE CONCAT('prd-', LTRIM(RTRIM(@producto_id))) END;

  SELECT producto_id, categoria_id, fecha_alerta
  FROM productos_sin_stock_log
  WHERE producto_id = @pid
    AND fecha_alerta >= @desde AND fecha_alerta <= @hasta
  ORDER BY fecha_alerta DESC;
END;
GO

/* ===========================================================
   ACTUALIZACIÓN MASIVA DE PRECIOS
   - Por MONTO: incrementar / reducir (no baja de 0.00)
   - Por PORCENTAJE: agregar descuento (p.ej. 15% => *0.85)
   - @categoria_id NULL => aplica a todas
   - @solo_activos = 1 => solo N'activo'
   =========================================================== */

-- 5.1) Incrementar por MONTO
CREATE OR ALTER PROCEDURE productos_precio_incrementar
  @monto         DECIMAL(10,2),
  @categoria_id  INT = NULL,
  @solo_activos  BIT = 1
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  BEGIN TRY
    IF @monto IS NULL OR @monto <= 0
      THROW 52021, 'Monto inválido (debe ser > 0).', 1;

    BEGIN TRAN;

      UPDATE p
         SET p.precio_unitario = ROUND(p.precio_unitario + @monto, 2)
      FROM productos p
      WHERE (@categoria_id IS NULL OR p.categoria_id = @categoria_id)
        AND (@solo_activos = 0 OR p.estado_producto = N'activo');

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs(origen, mensaje) VALUES (N'productos_precio_incrementar', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- 5.2) Reducir por MONTO (no < 0.00)
CREATE OR ALTER PROCEDURE productos_precio_reducir
  @monto         DECIMAL(10,2),
  @categoria_id  INT = NULL,
  @solo_activos  BIT = 1
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  BEGIN TRY
    IF @monto IS NULL OR @monto <= 0
      THROW 52022, 'Monto inválido (debe ser > 0).', 1;

    BEGIN TRAN;

      UPDATE p
         SET p.precio_unitario = ROUND(CASE WHEN p.precio_unitario >= @monto
                                            THEN p.precio_unitario - @monto
                                            ELSE 0.00 END, 2)
      FROM productos p
      WHERE (@categoria_id IS NULL OR p.categoria_id = @categoria_id)
        AND (@solo_activos = 0 OR p.estado_producto = N'activo');

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs(origen, mensaje) VALUES (N'productos_precio_reducir', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- 5.3) Descuento PORCENTUAL (p.ej. 15 => -15%)
CREATE OR ALTER PROCEDURE productos_agregar_descuento
  @porcentaje    DECIMAL(5,2),   -- 0 < @porcentaje < 100
  @categoria_id  INT = NULL,
  @solo_activos  BIT = 1
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  BEGIN TRY
    IF @porcentaje IS NULL OR @porcentaje <= 0 OR @porcentaje >= 100
      THROW 52023, 'Porcentaje inválido (0 < % < 100).', 1;

    DECLARE @factor DECIMAL(10,6) = 1 - (@porcentaje / 100.0);

    BEGIN TRAN;

      UPDATE p
         SET p.precio_unitario = ROUND(p.precio_unitario * @factor, 2)
      FROM productos p
      WHERE (@categoria_id IS NULL OR p.categoria_id = @categoria_id)
        AND (@solo_activos = 0 OR p.estado_producto = N'activo');

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs(origen, mensaje) VALUES (N'productos_agregar_descuento', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO
