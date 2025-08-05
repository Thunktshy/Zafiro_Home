/* ==============================================================
   Tablas, Triggers y Procedimientos para Categorías y sus logs
   ============================================================== */

-- Tabla principal de categorías
DROP TABLE IF EXISTS categorias;
GO
CREATE TABLE categorias (
    categoria_id      INT IDENTITY(1,1) PRIMARY KEY,   -- PK
    nombre_categoria  NVARCHAR(50) NOT NULL,          -- Nombre de la categoría
    descripcion       NVARCHAR(255) NULL               -- Descripción de la categoría
);
GO

-- Tabla INSERT de categorías
DROP TABLE IF EXISTS categorias_ins_log;
GO
CREATE TABLE categorias_ins_log (
    log_id            INT IDENTITY(1,1) PRIMARY KEY,
    categoria_id      INT,                             -- FK a categorías
    nombre_categoria  NVARCHAR(50),
    descripcion       NVARCHAR(255),
    fecha_log         DATETIME    DEFAULT GETDATE(),
    usuario           NVARCHAR(50) DEFAULT SYSTEM_USER
);
GO

-- Tabla DELETE de categorías
DROP TABLE IF EXISTS categorias_del_log;
GO
CREATE TABLE categorias_del_log (
    log_id            INT IDENTITY(1,1) PRIMARY KEY,
    categoria_id      INT,
    nombre_categoria  NVARCHAR(50),
    descripcion       NVARCHAR(255),
    fecha_log         DATETIME    DEFAULT GETDATE(),
    usuario           NVARCHAR(50) DEFAULT SYSTEM_USER
);
GO

-- Tabla UPDATE de categorías
DROP TABLE IF EXISTS categorias_upd_log;
GO
CREATE TABLE categorias_upd_log (
    log_id                  INT IDENTITY(1,1) PRIMARY KEY,
    categoria_id            INT,
    nombre_categoria_anterior NVARCHAR(50),
    descripcion_anterior    NVARCHAR(255),
    nombre_categoria_nuevo  NVARCHAR(50),
    descripcion_nuevo       NVARCHAR(255),
    fecha_log               DATETIME    DEFAULT GETDATE(),
    usuario                 NVARCHAR(50) DEFAULT SYSTEM_USER
);
GO

-- TRIGGER INSERT categorías
CREATE OR ALTER TRIGGER trg_ins_categorias
ON categorias
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO categorias_ins_log (
        categoria_id, nombre_categoria, descripcion
    )
    SELECT
        i.categoria_id, i.nombre_categoria, i.descripcion
    FROM inserted AS i;
END;
GO

-- TRIGGER DELETE categorías
CREATE OR ALTER TRIGGER trg_del_categorias
ON categorias
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO categorias_del_log (
        categoria_id, nombre_categoria, descripcion
    )
    SELECT
        d.categoria_id, d.nombre_categoria, d.descripcion
    FROM deleted AS d;
END;
GO

-- TRIGGER UPDATE categorías
CREATE OR ALTER TRIGGER trg_upd_categorias
ON categorias
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO categorias_upd_log (
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

-- Procedimiento INSERT categorías
CREATE OR ALTER PROCEDURE categorias_insert
    @nombre_categoria NVARCHAR(50),
    @descripcion      NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        -- Validar duplicados por nombre
        IF EXISTS (SELECT 1 FROM categorias WHERE nombre_categoria = @nombre_categoria)
        BEGIN
            RAISERROR('La categoría ya existe.', 16, 1);
            RETURN;
        END
        INSERT INTO categorias (nombre_categoria, descripcion)
        VALUES (@nombre_categoria, @descripcion);
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO Logs (mensaje, nivel, origen)
        VALUES (
            ERROR_MESSAGE(),
            'ERROR',
            'categorias_insert'
        );
        THROW;
    END CATCH
END;
GO

-- Procedimiento UPDATE categorías
CREATE OR ALTER PROCEDURE categorias_update
    @categoria_id      INT,
    @nombre_categoria  NVARCHAR(50),
    @descripcion       NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        -- Validar existencia
        IF NOT EXISTS (SELECT 1 FROM categorias WHERE categoria_id = @categoria_id)
        BEGIN
            RAISERROR('categoria_id no existe.', 16, 1);
            RETURN;
        END
        -- Validar duplicado de nombre en otro registro
        IF EXISTS (
            SELECT 1 FROM categorias
            WHERE nombre_categoria = @nombre_categoria
              AND categoria_id <> @categoria_id
        )
        BEGIN
            RAISERROR('Otra categoría ya usa ese nombre.', 16, 1);
            RETURN;
        END
        UPDATE categorias
        SET
            nombre_categoria = @nombre_categoria,
            descripcion      = @descripcion
        WHERE categoria_id = @categoria_id;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO Logs (mensaje, nivel, origen)
        VALUES (
            ERROR_MESSAGE(),
            'ERROR',
            'categorias_update'
        );
        THROW;
    END CATCH
END;
GO

-- Procedimiento DELETE categorías
CREATE OR ALTER PROCEDURE categorias_delete
    @categoria_id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        -- Validar existencia
        IF NOT EXISTS (SELECT 1 FROM categorias WHERE categoria_id = @categoria_id)
        BEGIN
            RAISERROR('categoria_id no existe.', 16, 1);
            RETURN;
        END
        DELETE FROM categorias
        WHERE categoria_id = @categoria_id;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO Logs (mensaje, nivel, origen)
        VALUES (
            ERROR_MESSAGE(),
            'ERROR',
            'categorias_delete'
        );
        THROW;
    END CATCH
END;
GO
