/* ==============================================================
   Productos (alineado a Categorías)
   ============================================================== */

-- ==============================================
-- Tabla de logs (errores de procedimientos)
-- ==============================================
DROP TABLE IF EXISTS logs;
GO
CREATE TABLE logs (
    log_id  INT IDENTITY(1,1) PRIMARY KEY,
    fecha   DATETIME       NOT NULL DEFAULT GETDATE(),
    origen  NVARCHAR(100)  NOT NULL, -- Nombre del procedimiento
    mensaje NVARCHAR(MAX)  NOT NULL  -- Texto del error SQL
);
GO

/* ========================
   Secuencia para producto_id numérico
   ======================== */
DROP SEQUENCE IF EXISTS seq_productos;
GO
CREATE SEQUENCE seq_productos
    AS INT
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    CYCLE;
GO

/* ========================
   Tabla principal
   ======================== */
DROP TABLE IF EXISTS productos;
GO
CREATE TABLE productos (
    producto_id      NVARCHAR(20)  PRIMARY KEY, --Recibe prefijo prd-
    nombre_producto  NVARCHAR(50)  NOT NULL,
    descripcion      NVARCHAR(150) NULL,
    precio_unitario  DECIMAL(10,2) NOT NULL,
    stock            INT           NOT NULL DEFAULT 0,
    categoria_id     INT           NOT NULL,
    fecha_creacion   DATETIME      NOT NULL DEFAULT GETDATE(),
    estado_producto  NVARCHAR(20)  NOT NULL DEFAULT N'activo',
    CONSTRAINT fk_productos_categoria
        FOREIGN KEY (categoria_id) REFERENCES categorias(categoria_id)
);
GO

/* ========================
   Tablas de LOG (auditoría)
   ======================== */

DROP TABLE IF EXISTS productos_insert_log;
GO
CREATE TABLE productos_insert_log (
    log_id           INT IDENTITY(1,1) PRIMARY KEY,
    producto_id      NVARCHAR(20),
    nombre_producto  NVARCHAR(50),
    descripcion      NVARCHAR(150),
    precio_unitario  DECIMAL(10,2),
    stock            INT,
    categoria_id     INT,
    fecha_creacion   DATETIME,
    estado_producto  NVARCHAR(20),
    fecha_log        DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

DROP TABLE IF EXISTS productos_delete_log;
GO
CREATE TABLE productos_delete_log (
    log_id           INT IDENTITY(1,1) PRIMARY KEY,
    producto_id      NVARCHAR(20),
    nombre_producto  NVARCHAR(50),
    descripcion      NVARCHAR(150),
    precio_unitario  DECIMAL(10,2),
    stock            INT,
    categoria_id     INT,
    fecha_creacion   DATETIME,
    estado_producto  NVARCHAR(20),
    fecha_log        DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

DROP TABLE IF EXISTS productos_update_log;
GO
CREATE TABLE productos_update_log (
    log_id                 INT IDENTITY(1,1) PRIMARY KEY,
    producto_id            NVARCHAR(20),
    -- valores anteriores
    nombre_producto_ant    NVARCHAR(50),
    descripcion_ant        NVARCHAR(150),
    precio_unitario_ant    DECIMAL(10,2),
    stock_ant              INT,
    categoria_id_ant       INT,
    estado_producto_ant    NVARCHAR(20),
    -- valores nuevos
    nombre_producto_nvo    NVARCHAR(50),
    descripcion_nvo        NVARCHAR(150),
    precio_unitario_nvo    DECIMAL(10,2),
    stock_nvo              INT,
    categoria_id_nvo       INT,
    estado_producto_nvo    NVARCHAR(20),
    fecha_log              DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

/* ========================
   TRIGGERS
   ======================== */

-- INSERT
CREATE OR ALTER TRIGGER trg_insert_productos
ON productos
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO productos_insert_log (
        producto_id, nombre_producto, descripcion, precio_unitario, stock,
        categoria_id, fecha_creacion, estado_producto
    )
    SELECT
        i.producto_id, i.nombre_producto, i.descripcion, i.precio_unitario, i.stock,
        i.categoria_id, i.fecha_creacion, i.estado_producto
    FROM inserted AS i;
END;
GO

-- DELETE
CREATE OR ALTER TRIGGER trg_delete_productos
ON productos
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO productos_delete_log (
        producto_id, nombre_producto, descripcion, precio_unitario, stock,
        categoria_id, fecha_creacion, estado_producto
    )
    SELECT
        d.producto_id, d.nombre_producto, d.descripcion, d.precio_unitario, d.stock,
        d.categoria_id, d.fecha_creacion, d.estado_producto
    FROM deleted AS d;
END;
GO

-- UPDATE (registrar cualquier cambio)
CREATE OR ALTER TRIGGER trg_update_productos
ON productos
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO productos_update_log (
        producto_id,
        nombre_producto_ant, descripcion_ant, precio_unitario_ant, stock_ant,
        categoria_id_ant, estado_producto_ant,
        nombre_producto_nvo, descripcion_nvo, precio_unitario_nvo, stock_nvo,
        categoria_id_nvo, estado_producto_nvo
    )
    SELECT
        d.producto_id,
        d.nombre_producto, d.descripcion, d.precio_unitario, d.stock,
        d.categoria_id, d.estado_producto,
        i.nombre_producto, i.descripcion, i.precio_unitario, i.stock,
        i.categoria_id, i.estado_producto
    FROM deleted AS d
    JOIN inserted AS i
      ON d.producto_id = i.producto_id;
END;
GO

/* ========================
   PROCEDIMIENTOS
   ======================== */

-- INSERT (concatena 'prd-' + secuencia)
CREATE OR ALTER PROCEDURE productos_insert
    @nombre_producto  NVARCHAR(50),
    @descripcion      NVARCHAR(150) = NULL, --Opcional
    @precio_unitario  DECIMAL(10,2),
    @stock            INT,
    @categoria_id     INT,
    @estado_producto  NVARCHAR(20) = N'activo'
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM categorias WHERE categoria_id = @categoria_id)
            THROW 52001, 'La categoría no existe.', 1;

        DECLARE @nuevo_id NVARCHAR(20) = CONCAT('prd-', NEXT VALUE FOR seq_productos);

        INSERT INTO productos (
            producto_id, nombre_producto, descripcion, precio_unitario, stock,
            categoria_id, estado_producto
        )
        VALUES (
            @nuevo_id, @nombre_producto, @descripcion, @precio_unitario, @stock,
            @categoria_id, @estado_producto
        );

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (origen, mensaje)
        VALUES (N'productos_insert', ERROR_MESSAGE());
        THROW;
    END CATCH
END;
GO

-- UPDATE
CREATE OR ALTER PROCEDURE productos_update
    @producto_id      NVARCHAR(20),
    @nombre_producto  NVARCHAR(50),
    @descripcion      NVARCHAR(150) = NULL,
    @precio_unitario  DECIMAL(10,2),
    @stock            INT,
    @categoria_id     INT,
    @estado_producto  NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM productos WHERE producto_id = @producto_id)
            THROW 52002, 'El producto no existe.', 1;

        IF NOT EXISTS (SELECT 1 FROM categorias WHERE categoria_id = @categoria_id)
            THROW 52003, 'La categoría no existe.', 1;

        UPDATE productos
        SET nombre_producto = @nombre_producto,
            descripcion     = @descripcion,
            precio_unitario = @precio_unitario,
            stock           = @stock,
            categoria_id    = @categoria_id,
            estado_producto = @estado_producto
        WHERE producto_id = @producto_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (origen, mensaje)
        VALUES (N'productos_update', ERROR_MESSAGE());
        THROW;
    END CATCH
END;
GO

-- DELETE
CREATE OR ALTER PROCEDURE productos_delete
    @producto_id NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM productos WHERE producto_id = @producto_id)
            THROW 52004, 'El producto no existe.', 1;

        DELETE FROM productos
        WHERE producto_id = @producto_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (origen, mensaje)
        VALUES (N'productos_delete', ERROR_MESSAGE());
        THROW;
    END CATCH
END;
GO

-- GET ALL (Devuelve todos los campos)
CREATE OR ALTER PROCEDURE productos_get_all
AS
BEGIN
    SET NOCOUNT ON;
    SELECT producto_id, nombre_producto, descripcion, precio_unitario,
           stock, categoria_id, fecha_creacion, estado_producto
    FROM productos
    ORDER BY nombre_producto;
END;
GO

-- GET LIST (Devuelve solo id y nombre)
CREATE OR ALTER PROCEDURE productos_get_list
AS
BEGIN
    SET NOCOUNT ON;
    SELECT producto_id, nombre_producto
    FROM productos
    ORDER BY nombre_producto;
END;
GO

/* =========================
   PRODUCTOS: GET por id 
   ========================= */

-- A) Recibe NVARCHAR (acepta 'prd-123' o '123')
CREATE OR ALTER PROCEDURE productos_get_by_id
  @id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @pid NVARCHAR(20) =
      CASE WHEN LEFT(@id,4) = 'prd-' THEN @id ELSE CONCAT('prd-', @id) END;

  SELECT producto_id, nombre_producto, descripcion, precio_unitario,
         stock, categoria_id, fecha_creacion, estado_producto
  FROM productos
  WHERE producto_id = @pid;
END;
GO

-- B) Recibe INT y concatena 'prd-' + @id
CREATE OR ALTER PROCEDURE productos_get_by_id_int
  @id INT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @pid NVARCHAR(20) = CONCAT('prd-', @id);

  SELECT producto_id, nombre_producto, descripcion, precio_unitario,
         stock, categoria_id, fecha_creacion, estado_producto
  FROM productos
  WHERE producto_id = @pid;
END;
GO

/* =========================
   PRODUCTOS: GET por nombre y por categoría
   ========================= */

-- Nombre exacto
CREATE OR ALTER PROCEDURE productos_get_by_name
  @nombre NVARCHAR(50)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT producto_id, nombre_producto, descripcion, precio_unitario,
         stock, categoria_id, fecha_creacion, estado_producto
  FROM productos
  WHERE nombre_producto = @nombre
  ORDER BY nombre_producto;
END;
GO

-- Por categoría (ordenado por nombre)
CREATE OR ALTER PROCEDURE productos_get_by_categoria
  @categoria_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT producto_id, nombre_producto, descripcion, precio_unitario,
         stock, categoria_id, fecha_creacion, estado_producto
  FROM productos
  WHERE categoria_id = @categoria_id
  ORDER BY nombre_producto;
END;
GO

/* ==============================================================
   PRODUCTOS:  (estado -> 'inactivo')
   ============================================================== */

CREATE OR ALTER PROCEDURE productos_soft_delete
  @id NVARCHAR(20)   -- admite 'prd-123' o '123'
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    BEGIN TRANSACTION;

    -- Normaliza el ID al formato 'prd-<n>'
    DECLARE @pid NVARCHAR(20) =
      CASE WHEN LEFT(@id, 4) = 'prd-' THEN @id ELSE CONCAT('prd-', @id) END;

    -- Validación de existencia
    IF NOT EXISTS (SELECT 1 FROM productos WHERE producto_id = @pid)
      THROW 52005, 'El producto no existe.', 1;

    -- Soft delete 
    UPDATE productos
    SET estado_producto = N'inactivo'
    WHERE producto_id = @pid;

    COMMIT TRANSACTION;

  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    INSERT INTO logs (origen, mensaje)
    VALUES (N'productos_soft_delete', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

/* ==============================================================
   PRODUCTOS: Restore (estado -> 'activo')
   ============================================================== */

CREATE OR ALTER PROCEDURE productos_restore
  @id NVARCHAR(20)   -- admite 'prd-123' o '123'
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    BEGIN TRANSACTION;

    -- Normaliza el ID al formato 'prd-<n>'
    DECLARE @pid NVARCHAR(20) =
      CASE WHEN LEFT(@id, 4) = 'prd-' THEN @id ELSE CONCAT('prd-', @id) END;

    -- Validación de existencia
    IF NOT EXISTS (SELECT 1 FROM productos WHERE producto_id = @pid)
      THROW 52006, 'El producto no existe.', 1;

    -- Restore
    UPDATE productos
    SET estado_producto = N'activo'
    WHERE producto_id = @pid;

    COMMIT TRANSACTION;

  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    INSERT INTO logs (origen, mensaje)
    VALUES (N'productos_restore', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO


/* ========================
   ÍNDICES
   ======================== */

-- 1) Cobertura de lecturas y ORDER BY por nombre (get_all / get_list)
CREATE NONCLUSTERED INDEX IX_productos_nombre_cover_all
ON productos (nombre_producto)
INCLUDE (producto_id, precio_unitario, stock, categoria_id, estado_producto, descripcion);
GO


-- 2) Búsqueda por categoría + orden por nombre (get_by_categoria)
CREATE NONCLUSTERED INDEX IX_productos_categoria_nombre_cover
ON productos (categoria_id, nombre_producto)
INCLUDE (producto_id, precio_unitario, stock, estado_producto, descripcion);
GO

-- 3) Logs INSERT: buscar por producto y traer lo más reciente
CREATE NONCLUSTERED INDEX IX_prod_insert_producto_fecha
ON productos_insert_log (producto_id, fecha_log)
INCLUDE (nombre_producto, descripcion, precio_unitario, stock, categoria_id);
GO

-- 4) Logs DELETE: buscar por producto y traer lo más reciente
CREATE NONCLUSTERED INDEX IX_prod_delete_producto_fecha
ON productos_delete_log (producto_id, fecha_log)
INCLUDE (nombre_producto, descripcion, precio_unitario, stock, categoria_id);
GO

-- 5) Logs UPDATE: buscar por producto y traer lo más reciente
CREATE NONCLUSTERED INDEX IX_prod_update_producto_fecha
ON productos_update_log (producto_id, fecha_log)
INCLUDE (
  nombre_producto_ant, descripcion_ant, precio_unitario_ant, stock_ant, categoria_id_ant,
  nombre_producto_nvo, descripcion_nvo, precio_unitario_nvo, stock_nvo, categoria_id_nvo
);
GO


