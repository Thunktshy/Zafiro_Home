/* ==============================================================
   Tablas, Constraints, Triggers y Procedimientos para Categorías
   ============================================================== */

-- Tabla principal de categorías
DROP TABLE IF EXISTS categorias;
GO
CREATE TABLE categorias (
    categoria_id      INT IDENTITY(1,1) PRIMARY KEY,   -- PK
    nombre_categoria  NVARCHAR(50) NOT NULL,           -- Nombre de la categoría
    descripcion       NVARCHAR(255) NULL,              -- Descripción de la categoría
    image_path        NVARCHAR(255) NULL               -- Ruta de la imagen
);
GO

-- Constraint UNIQUE en nombre_categoria
ALTER TABLE categorias
ADD CONSTRAINT UQ_categorias_nombre_categoria UNIQUE (nombre_categoria);
GO

/* ========================
   Tablas de LOG 
   ======================== */

DROP TABLE IF EXISTS categorias_insert_log;
GO
CREATE TABLE categorias_insert_log (
    log_id            INT IDENTITY(1,1) PRIMARY KEY,
    categoria_id      INT,
    nombre_categoria  NVARCHAR(50),
    descripcion       NVARCHAR(255),
    fecha_log         DATETIME    DEFAULT GETDATE(),
    usuario           NVARCHAR(50) DEFAULT SYSTEM_USER
);
GO

DROP TABLE IF EXISTS categorias_delete_log;
GO
CREATE TABLE categorias_delete_log (
    log_id            INT IDENTITY(1,1) PRIMARY KEY,
    categoria_id      INT,
    nombre_categoria  NVARCHAR(50),
    descripcion       NVARCHAR(255),
    fecha_log         DATETIME    DEFAULT GETDATE(),
    usuario           NVARCHAR(50) DEFAULT SYSTEM_USER
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
    fecha_log                 DATETIME    DEFAULT GETDATE(),
    usuario                   NVARCHAR(50) DEFAULT SYSTEM_USER
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
    INSERT INTO categorias_insert_log (
        categoria_id, nombre_categoria, descripcion
    )
    SELECT
        i.categoria_id, i.nombre_categoria, i.descripcion
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
    INSERT INTO categorias_delete_log (
        categoria_id, nombre_categoria, descripcion
    )
    SELECT
        d.categoria_id, d.nombre_categoria, d.descripcion
    FROM deleted AS d;
END;
GO

-- UPDATE (solo loggea cambios en nombre/descripcion)
CREATE OR ALTER TRIGGER trg_update_categorias
ON categorias
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO categorias_update_log (
        categoria_id,
        nombre_categoria_anterior, descripcion_anterior,
        nombre_categoria_nuevo,   descripcion_nuevo
    )
    SELECT
        d.categoria_id,
        d.nombre_categoria, d.descripcion,
        i.nombre_categoria, i.descripcion
    FROM deleted AS d
    JOIN inserted AS i
      ON d.categoria_id = i.categoria_id
    WHERE
        ISNULL(d.nombre_categoria,'') <> ISNULL(i.nombre_categoria,'')
     OR ISNULL(d.descripcion,'')       <> ISNULL(i.descripcion,'');
END;
GO

/* ==============================================================
   Procedimientos
   ============================================================== */

-- INSERT categorías 
CREATE OR ALTER PROCEDURE categorias_insert
    @nombre_categoria NVARCHAR(50),
    @descripcion      NVARCHAR(255) = NULL,
    @image_path       NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF LTRIM(RTRIM(@nombre_categoria)) = ''
            THROW 51001, 'nombre_categoria no puede estar vacío.', 1;

        IF EXISTS (SELECT 1 FROM categorias WHERE nombre_categoria = @nombre_categoria)
            THROW 51002, 'La categoría ya existe.', 1;

        INSERT INTO categorias (
            nombre_categoria, descripcion, image_path
        )
        VALUES (
            @nombre_categoria, @descripcion, @image_path
        );

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'categorias_insert');
        THROW;
    END CATCH
END;
GO

-- UPDATE categorías
CREATE OR ALTER PROCEDURE categorias_update
    @categoria_id      INT,
    @nombre_categoria  NVARCHAR(50),
    @descripcion       NVARCHAR(255) = NULL,
    @image_path        NVARCHAR(255) = NULL
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
        SET
            nombre_categoria = @nombre_categoria,
            descripcion      = @descripcion,
            image_path       = @image_path
        WHERE categoria_id = @categoria_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'categorias_update');
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
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'categorias_delete');
        THROW;
    END CATCH
END;
GO

-- Obtener todas las categorías
CREATE OR ALTER PROCEDURE categorias_get_all
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        categoria_id,
        nombre_categoria,
        descripcion,
        image_path
    FROM categorias
    ORDER BY nombre_categoria;
END;
GO

-- Obtener lista de categorías (solo id y nombre)
CREATE OR ALTER PROCEDURE categorias_get_list
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        categoria_id,
        nombre_categoria
    FROM categorias
    ORDER BY nombre_categoria;
END;
GO

/* Cobertura para categorias_get_all y get_list (ORDER BY nombre_categoria) */
CREATE NONCLUSTERED INDEX categorias_nombre_cover_all
ON categorias(nombre_categoria)
INCLUDE (categoria_id, descripcion, image_path);
GO

/* Índices para logs: buscar por categoria_id y lo más reciente */

/* INSERT LOG */
CREATE NONCLUSTERED INDEX categorias_insert_log_categoria_fecha
ON categorias_insert_log (categoria_id, fecha_log DESC)
INCLUDE (nombre_categoria, descripcion, usuario);
GO

/* DELETE LOG */

CREATE NONCLUSTERED INDEX categorias_delete_log_categoria_fecha
ON categorias_delete_log (categoria_id, fecha_log DESC)
INCLUDE (nombre_categoria, descripcion, usuario);
GO

/* UPDATE LOG */
CREATE NONCLUSTERED INDEX categorias_update_log_categoria_fecha
ON categorias_update_log (categoria_id, fecha_log DESC)
INCLUDE (nombre_categoria_anterior, descripcion_anterior, 
         nombre_categoria_nuevo, descripcion_nuevo, usuario);
GO
