/* ==============================================================
   Tablas, Triggers e Índices para Categorías
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

-- ==============================================
-- Tabla principal de categorías
-- ==============================================
DROP TABLE IF EXISTS categorias;
GO
CREATE TABLE categorias (
    categoria_id      INT IDENTITY(1,1) PRIMARY KEY,   -- PK
    nombre_categoria  NVARCHAR(50) UNIQUE NOT NULL,    -- Único
    descripcion       NVARCHAR(255) NULL
);
GO

/* ========================
   Tablas de LOG (auditoría)
   ======================== */

DROP TABLE IF EXISTS categorias_insert_log;
GO
CREATE TABLE categorias_insert_log (
    log_id            INT IDENTITY(1,1) PRIMARY KEY,
    categoria_id      INT,
    nombre_categoria  NVARCHAR(50),
    descripcion       NVARCHAR(255),
    fecha_log         DATETIME    NOT NULL DEFAULT GETDATE()
);
GO

DROP TABLE IF EXISTS categorias_delete_log;
GO
CREATE TABLE categorias_delete_log (
    log_id            INT IDENTITY(1,1) PRIMARY KEY,
    categoria_id      INT,
    nombre_categoria  NVARCHAR(50),
    descripcion       NVARCHAR(255),
    fecha_log         DATETIME    NOT NULL DEFAULT GETDATE()
);
GO

DROP TABLE IF EXISTS categorias_update_log;
GO
CREATE TABLE categorias_update_log (
    log_id                    INT IDENTITY(1,1) PRIMARY KEY,
    categoria_id              INT,
    nombre_categoria_anterior NVARCHAR(50),
    descripcion_anterior      NVARCHAR(255),
    nombre_categoria_nuevo    NVARCHAR(50),
    descripcion_nuevo         NVARCHAR(255),
    fecha_log                 DATETIME    NOT NULL DEFAULT GETDATE()
);
GO

/* ========================
   TRIGGERS
   ======================== */

-- INSERT
CREATE OR ALTER TRIGGER trg_insert_categorias
ON categorias
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO categorias_insert_log (categoria_id, nombre_categoria, descripcion)
    SELECT i.categoria_id, i.nombre_categoria, i.descripcion
    FROM inserted AS i;
END;
GO

-- DELETE
CREATE OR ALTER TRIGGER trg_delete_categorias
ON categorias
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO categorias_delete_log (categoria_id, nombre_categoria, descripcion)
    SELECT d.categoria_id, d.nombre_categoria, d.descripcion
    FROM deleted AS d;
END;
GO

-- UPDATE (solo log si hay cambios reales)
CREATE OR ALTER TRIGGER trg_update_categorias
ON categorias
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO categorias_update_log (
        categoria_id,
        nombre_categoria_anterior, descripcion_anterior,
        nombre_categoria_nuevo,    descripcion_nuevo
    )
    SELECT
        d.categoria_id,
        d.nombre_categoria, d.descripcion,
        i.nombre_categoria, i.descripcion
    FROM deleted  AS d
    JOIN inserted AS i
      ON d.categoria_id = i.categoria_id
    WHERE
        ISNULL(d.nombre_categoria,'') <> ISNULL(i.nombre_categoria,'')
        OR ISNULL(d.descripcion,'')  <> ISNULL(i.descripcion,'');
END;
GO

/* ========================
   PROCEDIMIENTOS
   ======================== */

-- INSERT categorías 
CREATE OR ALTER PROCEDURE categorias_insert
    @nombre_categoria NVARCHAR(50),
    @descripcion      NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF LTRIM(RTRIM(@nombre_categoria)) = ''
            THROW 51001, 'nombre_categoria no puede estar vacío.', 1;

        IF EXISTS (SELECT 1 FROM categorias WHERE nombre_categoria = @nombre_categoria)
            THROW 51002, 'La categoría ya existe.', 1;

        INSERT INTO categorias (nombre_categoria, descripcion)
        VALUES (@nombre_categoria, @descripcion);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (origen, mensaje)
        VALUES (N'categorias_insert', ERROR_MESSAGE());
        THROW;
    END CATCH
END;
GO

-- UPDATE categorías
CREATE OR ALTER PROCEDURE categorias_update
    @categoria_id      INT,
    @nombre_categoria  NVARCHAR(50),
    @descripcion       NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM categorias WHERE categoria_id = @categoria_id)
            THROW 51003, 'La categoría ya no se encuentra en la base de datos.', 1;

        IF LTRIM(RTRIM(@nombre_categoria)) = ''
            THROW 51004, 'nombre_categoria no puede estar vacío.', 1;

        IF EXISTS (
            SELECT 1 FROM categorias
            WHERE nombre_categoria = @nombre_categoria
              AND categoria_id <> @categoria_id
        )
            THROW 51005, 'Otra categoría ya usa ese nombre.', 1;

        UPDATE categorias
        SET nombre_categoria = @nombre_categoria,
            descripcion      = @descripcion
        WHERE categoria_id = @categoria_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (origen, mensaje)
        VALUES (N'categorias_update', ERROR_MESSAGE());
        THROW;
    END CATCH
END;
GO

-- DELETE categorías
CREATE OR ALTER PROCEDURE categorias_delete
    @categoria_id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM categorias WHERE categoria_id = @categoria_id)
            THROW 51006, 'La categoría ya no se encuentra en la base de datos.', 1;

        DELETE FROM categorias
        WHERE categoria_id = @categoria_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (origen, mensaje)
        VALUES (N'categorias_delete', ERROR_MESSAGE());
        THROW;
    END CATCH
END;
GO

-- Obtener todas las categorías
CREATE OR ALTER PROCEDURE categorias_get_all
AS
BEGIN
    SET NOCOUNT ON;
    SELECT categoria_id, nombre_categoria, descripcion
    FROM categorias
    ORDER BY nombre_categoria;
END;
GO

-- Obtener lista de categorías (solo id y nombre)
CREATE OR ALTER PROCEDURE categorias_get_list
AS
BEGIN
    SET NOCOUNT ON;
    SELECT categoria_id, nombre_categoria
    FROM categorias
    ORDER BY nombre_categoria;
END;
GO

-- Obtener categoría por id
CREATE OR ALTER PROCEDURE categorias_por_id
  @categoria_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT categoria_id, nombre_categoria, descripcion
  FROM categorias
  WHERE categoria_id = @categoria_id;
END;
GO

/* ========================
   ÍNDICES
   ======================== */

-- 1) Cubre consultas que ordenan por nombre y devuelven id/descripcion
CREATE NONCLUSTERED INDEX IX_categorias_nombre_cover_all
ON categorias(nombre_categoria)
INCLUDE (categoria_id, descripcion);
GO

-- 2) Logs de INSERT: buscar por categoria y traer lo más reciente
CREATE NONCLUSTERED INDEX IX_cat_insert_categoria_fecha
ON categorias_insert_log (categoria_id, fecha_log)
INCLUDE (nombre_categoria, descripcion);
GO

-- 3) Logs de DELETE: buscar por categoria y traer lo más reciente
CREATE NONCLUSTERED INDEX IX_cat_delete_categoria_fecha
ON categorias_delete_log (categoria_id, fecha_log)
INCLUDE (nombre_categoria, descripcion);
GO

-- 4) Logs de UPDATE: buscar por categoria y traer lo más reciente
CREATE NONCLUSTERED INDEX IX_cat_update_categoria_fecha
ON categorias_update_log (categoria_id, fecha_log)
INCLUDE (
    nombre_categoria_anterior, descripcion_anterior,
    nombre_categoria_nuevo,    descripcion_nuevo
);
GO

