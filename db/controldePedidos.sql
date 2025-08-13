/* ===========================================================
   CONTROL DE PEDIDOS – SPs de manipulación
   Requiere tablas: pedidos, detalle_pedidos, productos
   Nota:
   - IDs con prefijo: pedido => 'ped-#', producto => 'prd-#'
   - Los triggers existentes recalculan total_pedido
   - Estados soportados: 'Por confirmar' | 'Confirmado' | 'Cancelado'
   =========================================================== */

SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------
   Helpers de normalización de ID
   ------------------------------ */
CREATE OR ALTER FUNCTION dbo.fn_norm_pedido_id(@id NVARCHAR(50))
RETURNS NVARCHAR(20)
AS
BEGIN
  DECLARE @s NVARCHAR(50) = LTRIM(RTRIM(@id));
  IF @s LIKE N'ped-%' RETURN @s;
  RETURN CONCAT(N'ped-', @s);
END;
GO

CREATE OR ALTER FUNCTION dbo.fn_norm_producto_id(@id NVARCHAR(50))
RETURNS NVARCHAR(20)
AS
BEGIN
  DECLARE @s NVARCHAR(50) = LTRIM(RTRIM(@id));
  IF @s LIKE N'prd-%' RETURN @s;
  RETURN CONCAT(N'prd-', @s);
END;
GO

/* ===========================================================
   SP: pedido_add_item
   Agrega (o incrementa) línea de detalle
   Params:
     @pedido_id    NVARCHAR(20)  -- 'ped-#' o '#'
     @producto_id  NVARCHAR(20)  -- 'prd-#' o '#'
     @cantidad     INT = 1       -- opcional
     @precio_unitario DECIMAL(10,2) = NULL -- opcional; si NULL usa precio de productos
   Reglas:
     - Pedido debe existir y estar 'Por confirmar'
     - Producto debe existir y estar activo
     - Stock disponible (ya_pedido + @cantidad) <= stock
   Errores (THROW):
     53002: Pedido no existe
     53008: Pedido no editable (estado ≠ 'Por confirmar')
     53009: Producto no existe o inactivo
     53010: Cantidad inválida
     53012: Stock insuficiente
   =========================================================== */
CREATE OR ALTER PROCEDURE pedido_add_item
  @pedido_id       NVARCHAR(20),
  @producto_id     NVARCHAR(20),
  @cantidad        INT = 1,
  @precio_unitario DECIMAL(10,2) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @pid  NVARCHAR(20) = dbo.fn_norm_pedido_id(@pedido_id);
  DECLARE @prid NVARCHAR(20) = dbo.fn_norm_producto_id(@producto_id);

  IF @cantidad IS NULL OR @cantidad <= 0
    THROW 53010, 'Cantidad debe ser > 0', 1;

  IF NOT EXISTS (SELECT 1 FROM pedidos WHERE pedido_id = @pid)
    THROW 53002, 'El pedido no existe', 1;

  DECLARE @estado NVARCHAR(20);
  SELECT @estado = estado_pedido FROM pedidos WHERE pedido_id = @pid;

  IF @estado <> N'Por confirmar'
    THROW 53008, 'El pedido no es editable en su estado actual', 1;

  -- Producto vigente (no inactivo)
  IF NOT EXISTS (
    SELECT 1
    FROM productos
    WHERE producto_id = @prid
      AND (estado_producto IS NULL OR estado_producto <> N'inactivo')
  )
    THROW 53009, 'El producto no existe o está inactivo', 1;

  -- Precio por default tomado del producto si no viene especificado
  DECLARE @precio DECIMAL(10,2);
  SELECT @precio = COALESCE(@precio_unitario, precio_unitario)
  FROM productos WHERE producto_id = @prid;

  BEGIN TRAN;

    DECLARE @stock_actual INT;
    SELECT @stock_actual = p.stock
    FROM productos p WITH (UPDLOCK, HOLDLOCK)
    WHERE p.producto_id = @prid;

    DECLARE @ya_pedido INT = 0;
    SELECT @ya_pedido = ISNULL(cantidad, 0)
    FROM detalle_pedidos
    WHERE pedido_id = @pid AND producto_id = @prid;

    IF (@stock_actual IS NULL) OR (@stock_actual < (@ya_pedido + @cantidad))
      THROW 53012, 'Stock insuficiente para agregar la cantidad solicitada', 1;

    -- Inserta o incrementa la línea
    IF @ya_pedido > 0
    BEGIN
      UPDATE detalle_pedidos
         SET cantidad = cantidad + @cantidad,
             precio_unitario = @precio
       WHERE pedido_id = @pid AND producto_id = @prid;
    END
    ELSE
    BEGIN
      INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario)
      VALUES (@pid, @prid, @cantidad, @precio);
    END
  COMMIT;

  -- Devuelve el estado del detalle
  SELECT dp.pedido_id, dp.producto_id, dp.cantidad, dp.precio_unitario
  FROM detalle_pedidos dp
  WHERE dp.pedido_id = @pid
  ORDER BY dp.producto_id;
END;
GO

/* ===========================================================
   SP: pedido_remove_item
   Elimina o decrementa cantidad de una línea
   Params:
     @pedido_id    NVARCHAR(20)
     @producto_id  NVARCHAR(20)
     @cantidad     INT = NULL  -- NULL => elimina toda la línea; >0 => resta cantidad
   Errores:
     53002: Pedido no existe
     53008: Pedido no editable (estado ≠ 'Por confirmar')
     53011: Detalle no existe
     53010: Cantidad inválida
   =========================================================== */
CREATE OR ALTER PROCEDURE pedido_remove_item
  @pedido_id   NVARCHAR(20),
  @producto_id NVARCHAR(20),
  @cantidad    INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @pid NVARCHAR(20) = dbo.fn_norm_pedido_id(@pedido_id);
  DECLARE @prid NVARCHAR(20) = dbo.fn_norm_producto_id(@producto_id);

  IF NOT EXISTS (SELECT 1 FROM pedidos WHERE pedido_id = @pid)
    THROW 53002, 'El pedido no existe', 1;

  DECLARE @estado NVARCHAR(20);
  SELECT @estado = estado_pedido FROM pedidos WHERE pedido_id = @pid;
  IF @estado <> N'Por confirmar'
    THROW 53008, 'El pedido no es editable en su estado actual', 1;

  IF NOT EXISTS (SELECT 1 FROM detalle_pedidos WHERE pedido_id = @pid AND producto_id = @prid)
    THROW 53011, 'El producto no está en el pedido', 1;

  BEGIN TRAN;
    IF @cantidad IS NULL
    BEGIN
      DELETE FROM detalle_pedidos WHERE pedido_id = @pid AND producto_id = @prid;
    END
    ELSE
    BEGIN
      IF @cantidad <= 0 THROW 53010, 'Cantidad debe ser > 0', 1;

      DECLARE @actual INT;
      SELECT @actual = cantidad FROM detalle_pedidos WHERE pedido_id = @pid AND producto_id = @prid;

      IF @actual <= @cantidad
        DELETE FROM detalle_pedidos WHERE pedido_id = @pid AND producto_id = @prid;
      ELSE
        UPDATE detalle_pedidos SET cantidad = cantidad - @cantidad WHERE pedido_id = @pid AND producto_id = @prid;
    END
  COMMIT;

  SELECT dp.pedido_id, dp.producto_id, dp.cantidad, dp.precio_unitario
  FROM detalle_pedidos dp
  WHERE dp.pedido_id = @pid
  ORDER BY dp.producto_id;
END;
GO

/* ===========================================================
   SP: pedidos_set_estado
   Despacha a confirmar/cancelar; restringe estados permitidos.
   Params:
     @pedido_id NVARCHAR(20)
     @estado    NVARCHAR(20)  -- 'Por confirmar'|'Confirmado'|'Cancelado'
   Errores:
     53002: Pedido no existe
     53006: Estado no soportado
   =========================================================== */
CREATE OR ALTER PROCEDURE pedidos_set_estado
  @pedido_id NVARCHAR(20),
  @estado    NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @pid NVARCHAR(20) = dbo.fn_norm_pedido_id(@pedido_id);
  IF NOT EXISTS (SELECT 1 FROM pedidos WHERE pedido_id = @pid)
    THROW 53002, 'El pedido no existe', 1;

  IF @estado = N'Confirmado'
  BEGIN
    EXEC pedidos_confirmar @id = @pid; -- asume SP existente
    RETURN;
  END
  ELSE IF @estado = N'Cancelado'
  BEGIN
    EXEC pedidos_cancelar @id = @pid;  -- asume SP existente
    RETURN;
  END
  ELSE IF @estado = N'Por confirmar'
  BEGIN
    -- Solo permitir si no está cancelado; (si volvió de confirmado -> política aparte)
    UPDATE pedidos SET estado_pedido = N'Por confirmar' WHERE pedido_id = @pid AND estado_pedido <> N'Cancelado';
    RETURN;
  END

  THROW 53006, 'Estado no soportado', 1;
END;
GO

/* ===========================================================
   SP: pedidos_verificar_productos
   Lista líneas con stock insuficiente (al momento de la verificación)
   Params:
     @pedido_id NVARCHAR(20)
   Devuelve: producto_id, requerido, stock_disponible, deficit
   Errores:
     53002: Pedido no existe
   =========================================================== */
CREATE OR ALTER PROCEDURE pedidos_verificar_productos
  @pedido_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @pid NVARCHAR(20) = dbo.fn_norm_pedido_id(@pedido_id);

  IF NOT EXISTS (SELECT 1 FROM pedidos WHERE pedido_id = @pid)
    THROW 53002, 'El pedido no existe', 1;

  ;WITH req AS (
    SELECT dp.producto_id, SUM(dp.cantidad) AS requerido
    FROM detalle_pedidos dp
    WHERE dp.pedido_id = @pid
    GROUP BY dp.producto_id
  )
  SELECT r.producto_id,
         r.requerido,
         p.stock AS stock_disponible,
         CASE WHEN p.stock < r.requerido THEN (r.requerido - p.stock) ELSE 0 END AS deficit
  FROM req r
  JOIN productos p ON p.producto_id = r.producto_id
  WHERE p.stock < r.requerido
  ORDER BY r.producto_id;
END;
GO
