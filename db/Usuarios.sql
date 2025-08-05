/* ==============================================================
   Tablas, Triggers y Procedimientos para Usuarios y sus logs
   ============================================================== */

-- Tabla principal de usuarios
DROP TABLE IF EXISTS usuarios;
GO
CREATE TABLE usuarios (
    usuario_id   INT IDENTITY(1,1) PRIMARY KEY,
    cuenta       NVARCHAR(10)  UNIQUE NOT NULL,       -- identificador de acceso
    contrasena   NVARCHAR(255) NOT NULL,              -- contraseña (hashed)
    puesto       NVARCHAR(10)  NOT NULL DEFAULT 'Administrador'  -- rol o cargo
);
GO

-- Tabla INSERT de usuarios
DROP TABLE IF EXISTS usuarios_ins_log;
GO
CREATE TABLE usuarios_ins_log (
    log_id        INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id    INT,
    cuenta        NVARCHAR(10),
    contrasena    NVARCHAR(255),
    puesto        NVARCHAR(10),
    fecha_log     DATETIME DEFAULT GETDATE(),
    usuario       NVARCHAR(50) DEFAULT SYSTEM_USER
);
GO

-- Tabla DELETE de usuarios
DROP TABLE IF EXISTS usuarios_del_log;
GO
CREATE TABLE usuarios_del_log (
    log_id        INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id    INT,
    cuenta        NVARCHAR(10),
    contrasena    NVARCHAR(255),
    puesto        NVARCHAR(10),
    fecha_log     DATETIME DEFAULT GETDATE(),
    usuario       NVARCHAR(50) DEFAULT SYSTEM_USER
);
GO

-- Tabla UPDATE de usuarios
DROP TABLE IF EXISTS usuarios_upd_log;
GO
CREATE TABLE usuarios_upd_log (
    log_id              INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id          INT,
    cuenta_anterior     NVARCHAR(10),
    contrasena_anterior NVARCHAR(255),
    puesto_anterior     NVARCHAR(10),
    cuenta_nuevo        NVARCHAR(10),
    contrasena_nuevo    NVARCHAR(255),
    puesto_nuevo        NVARCHAR(10),
    fecha_log           DATETIME DEFAULT GETDATE(),
    usuario             NVARCHAR(50) DEFAULT SYSTEM_USER
);
GO

-- TRIGGER INSERT usuarios
CREATE OR ALTER TRIGGER trg_ins_usuarios
ON usuarios
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO usuarios_ins_log (usuario_id, cuenta, contrasena, puesto)
    SELECT i.usuario_id, i.cuenta, i.contrasena, i.puesto
    FROM inserted AS i;
END;
GO

-- TRIGGER DELETE usuarios
CREATE OR ALTER TRIGGER trg_del_usuarios
ON usuarios
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO usuarios_del_log (usuario_id, cuenta, contrasena, puesto)
    SELECT d.usuario_id, d.cuenta, d.contrasena, d.puesto
    FROM deleted AS d;
END;
GO

-- TRIGGER UPDATE usuarios
CREATE OR ALTER TRIGGER trg_upd_usuarios
ON usuarios
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO usuarios_upd_log (
        usuario_id,
        cuenta_anterior, contrasena_anterior, puesto_anterior,
        cuenta_nuevo,    contrasena_nuevo,    puesto_nuevo
    )
    SELECT
        d.usuario_id,
        d.cuenta, d.contrasena, d.puesto,
        i.cuenta, i.contrasena, i.puesto
    FROM deleted AS d
    JOIN inserted AS i
      ON d.usuario_id = i.usuario_id
    WHERE
        ISNULL(d.cuenta,'')      <> ISNULL(i.cuenta,'')
     OR ISNULL(d.contrasena,'')<> ISNULL(i.contrasena,'')
     OR ISNULL(d.puesto,'')     <> ISNULL(i.puesto,'');
END;
GO

-- Procedimiento INSERT usuarios
CREATE OR ALTER PROCEDURE usuarios_insert
    @cuenta      NVARCHAR(10),
    @contrasena  NVARCHAR(255),
    @puesto      NVARCHAR(10) = 'Administrador'
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        -- Validar unicidad de cuenta
        IF EXISTS (SELECT 1 FROM usuarios WHERE cuenta = @cuenta)
        BEGIN
            RAISERROR('La cuenta ya existe.', 16, 1);
            RETURN;
        END
        INSERT INTO usuarios (cuenta, contrasena, puesto)
        VALUES (@cuenta, @contrasena, @puesto);
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (
            ERROR_MESSAGE(),
            'ERROR',
            'usuarios_insert'
        );
        THROW;
    END CATCH
END;
GO

-- Procedimiento UPDATE usuarios
CREATE OR ALTER PROCEDURE usuarios_update
    @usuario_id  INT,
    @cuenta      NVARCHAR(10),
    @contrasena  NVARCHAR(255),
    @puesto      NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        -- Validar existencia
        IF NOT EXISTS (SELECT 1 FROM usuarios WHERE usuario_id = @usuario_id)
        BEGIN
            RAISERROR('usuario_id no existe.', 16, 1);
            RETURN;
        END
        -- Validar unicidad de cuenta
        IF EXISTS (
            SELECT 1 FROM usuarios
            WHERE cuenta = @cuenta
              AND usuario_id <> @usuario_id
        )
        BEGIN
            RAISERROR('La cuenta ya está en uso por otro usuario.', 16, 1);
            RETURN;
        END
        UPDATE usuarios
        SET
            cuenta     = @cuenta,
            contrasena = @contrasena,
            puesto     = @puesto
        WHERE usuario_id = @usuario_id;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (
            ERROR_MESSAGE(),
            'ERROR',
            'usuarios_update'
        );
        THROW;
    END CATCH
END;
GO

-- Procedimiento DELETE usuarios
CREATE OR ALTER PROCEDURE usuarios_delete
    @usuario_id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        -- Validar existencia
        IF NOT EXISTS (SELECT 1 FROM usuarios WHERE usuario_id = @usuario_id)
        BEGIN
            RAISERROR('usuario_id no existe.', 16, 1);
            RETURN;
        END
        DELETE FROM usuarios
        WHERE usuario_id = @usuario_id;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (
            ERROR_MESSAGE(),
            'ERROR',
            'usuarios_delete'
        );
        THROW;
    END CATCH
END;
GO
