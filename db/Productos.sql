/* ==============================================================
   Productos
   ============================================================== */

-- Secuencia
DROP SEQUENCE IF EXISTS seq_productos;
GO
CREATE SEQUENCE seq_productos
    AS INT
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    CYCLE;
GO

-- Tabla principal
DROP TABLE IF EXISTS productos;
GO
CREATE TABLE productos (
    producto_id      NVARCHAR(20)  PRIMARY KEY, 
    nombre_producto  NVARCHAR(50)  NOT NULL,
    descripcion      NVARCHAR(150) NULL,
    precio_unitario  DECIMAL(10,2) NOT NULL,
    stock            INT           NOT NULL DEFAULT 0,
    categoria_id     INT           NOT NULL,
    fecha_creacion   DATETIME      DEFAULT GETDATE(), 
    estado_producto  NVARCHAR(20)  NOT NULL DEFAULT N'activo',
    CONSTRAINT fk_productos_categoria
        FOREIGN KEY (categoria_id) REFERENCES categorias(categoria_id)
);
GO

/* ========================
   Tablas de LOG
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
    fecha_log        DATETIME       DEFAULT GETDATE(),
    usuario          NVARCHAR(50)   DEFAULT SYSTEM_USER
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
    fecha_log        DATETIME       DEFAULT GETDATE(),
    usuario          NVARCHAR(50)   DEFAULT SYSTEM_USER
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
    fecha_log              DATETIME     DEFAULT GETDATE(),
    usuario                NVARCHAR(50) DEFAULT SYSTEM_USER
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

-- UPDATE (loggea solo si cambió algo relevante)
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
      ON d.producto_id = i.producto_id
    WHERE
           ISNULL(d.nombre_producto,'')  <> ISNULL(i.nombre_producto,'')
        OR ISNULL(d.descripcion,'')      <> ISNULL(i.descripcion,'')
        OR ISNULL(d.precio_unitario,0)   <> ISNULL(i.precio_unitario,0)
        OR ISNULL(d.stock,0)             <> ISNULL(i.stock,0)
        OR ISNULL(d.categoria_id,0)      <> ISNULL(i.categoria_id,0)
        OR ISNULL(d.estado_producto,'')  <> ISNULL(i.estado_producto,'');
END;
GO

/* ========================
   PROCEDIMIENTOS
   ======================== */

-- INSERT
CREATE OR ALTER PROCEDURE productos_insert
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
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'productos_insert');
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

        IF NOT EXISTS (SELECT 1 FROM productos  WHERE producto_id  = @producto_id)
            THROW 52002, 'El producto no existe.', 1;

        IF NOT EXISTS (SELECT 1 FROM categorias WHERE categoria_id = @categoria_id)
            THROW 52003, 'La categoría no existe.', 1;

        UPDATE productos
        SET
            nombre_producto = @nombre_producto,
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
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'productos_update');
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
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'productos_delete');
        THROW;
    END CATCH
END;
GO

-- GET ALL (orden por nombre, como categorias_get_all)
CREATE OR ALTER PROCEDURE productos_get_all
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        producto_id, nombre_producto, descripcion, precio_unitario, stock,
        categoria_id, fecha_creacion, estado_producto
    FROM productos
    ORDER BY nombre_producto;
END;
GO

/* ========================
   Índices para logs
   ======================== */

CREATE NONCLUSTERED INDEX productos_insert_log_producto_fecha
ON productos_insert_log (producto_id, fecha_log DESC)
INCLUDE (nombre_producto, descripcion, precio_unitario, stock, categoria_id, usuario);
GO

CREATE NONCLUSTERED INDEX productos_delete_log_producto_fecha
ON productos_delete_log (producto_id, fecha_log DESC)
INCLUDE (nombre_producto, descripcion, precio_unitario, stock, categoria_id, usuario);
GO

CREATE NONCLUSTERED INDEX productos_update_log_producto_fecha
ON productos_update_log (producto_id, fecha_log DESC)
INCLUDE (nombre_producto_ant, descripcion_ant, precio_unitario_ant, stock_ant, categoria_id_ant,
         nombre_producto_nvo, descripcion_nvo, precio_unitario_nvo, stock_nvo, categoria_id_nvo, usuario);
GO

