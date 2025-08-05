-- Tablas, Triggers y procedimientos para datos personales y sus logs

-- Tabla de logs
CREATE TABLE Logs (
    log_id INT IDENTITY PRIMARY KEY,
    fecha DATETIME     DEFAULT GETDATE(),
    mensaje NVARCHAR(MAX),
    nivel VARCHAR(10),
    origen NVARCHAR(100)
);

-- Tabla principal de DatosPersonales

DROP TABLE IF EXISTS DatosPersonales;
GO

CREATE TABLE DatosPersonales (
    datos_id       INT IDENTITY(1,1) PRIMARY KEY,
    cliente_id     NVARCHAR(20)    UNIQUE NOT NULL,
    nombre         NVARCHAR(50)    NOT NULL,
    apellidos      NVARCHAR(100)   NOT NULL,
    telefono       NVARCHAR(20),
    direccion      NVARCHAR(200),
    ciudad         NVARCHAR(50),
    codigo_postal  NVARCHAR(10),
    pais           NVARCHAR(50),
    CONSTRAINT FK_DatosPersonales_Clientes
    FOREIGN KEY (cliente_id) REFERENCES Clientes(cliente_id)
);
GO

-- Tabla INSERT de Datos Personales

DROP TABLE IF EXISTS datos_personales_ins_log;
CREATE TABLE datos_personales_ins_log (
    log_id        INT IDENTITY(1,1) PRIMARY KEY,
    datos_id      INT,
    cliente_id    NVARCHAR(20),
    nombre        NVARCHAR(50),
    apellidos     NVARCHAR(100),
    fecha_log     DATETIME DEFAULT GETDATE(),
    usuario       NVARCHAR(50) DEFAULT SYSTEM_USER
);

-- Tabla DELETE de Datos Personales

DROP TABLE IF EXISTS datos_personales_del_log;
CREATE TABLE datos_personales_del_log (
    log_id        INT IDENTITY(1,1) PRIMARY KEY,
    datos_id      INT,
    cliente_id    NVARCHAR(20),
    nombre        NVARCHAR(50),
    apellidos     NVARCHAR(100),
    telefono      NVARCHAR(20),
    fecha_log     DATETIME DEFAULT GETDATE(),
    usuario       NVARCHAR(50) DEFAULT SYSTEM_USER
);

-- Tabla UPDATE de Datos Personales

DROP TABLE IF EXISTS datos_personales_upd_log;
CREATE TABLE datos_personales_upd_log (
    log_id             INT IDENTITY(1,1) PRIMARY KEY,
    datos_id           INT,
    cliente_id         NVARCHAR(20),
    nombre_anterior    NVARCHAR(50),
    apellidos_anterior NVARCHAR(100),
    telefono_anterior  NVARCHAR(20),
    direccion_anterior NVARCHAR(200),
    ciudad_anterior    NVARCHAR(50),
    codigo_postal_ant  NVARCHAR(10),
    pais_ant           NVARCHAR(50),
    nombre_nuevo       NVARCHAR(50),
    apellidos_nuevo    NVARCHAR(100),
    telefono_nuevo     NVARCHAR(20),
    direccion_nueva    NVARCHAR(200),
    ciudad_nueva       NVARCHAR(50),
    codigo_postal_new  NVARCHAR(10),
    pais_new           NVARCHAR(50),
    fecha_log          DATETIME DEFAULT GETDATE(),
    usuario            NVARCHAR(50) DEFAULT SYSTEM_USER
);

-- Triggers

-- TRIGGER INSERT Datos Personales

CREATE OR ALTER TRIGGER trg_ins_datos_personales
ON datos_personales
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO datos_personales_ins_log (datos_id, cliente_id, nombre, apellidos)
    SELECT i.datos_id, i.cliente_id, i.nombre, i.apellidos
    FROM inserted AS i;
END;
GO

-- TRIGGER DELETE Datos Personales

CREATE OR ALTER TRIGGER trg_del_datos_personales
ON datos_personales
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO datos_personales_del_log (datos_id, cliente_id, nombre, apellidos, telefono)
    SELECT d.datos_id, d.cliente_id, d.nombre, d.apellidos, d.telefono
    FROM deleted AS d;
END;
GO

-- TRIGGER UPDATE Datos Personales

CREATE OR ALTER TRIGGER trg_upd_datos_personales
ON datos_personales
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO datos_personales_upd_log (
        datos_id, cliente_id,
        nombre_anterior, apellidos_anterior, telefono_anterior,
        direccion_anterior, ciudad_anterior, codigo_postal_ant, pais_ant,
        nombre_nuevo, apellidos_nuevo, telefono_nuevo,
        direccion_nueva, ciudad_nueva, codigo_postal_new, pais_new
    )
    SELECT
        d.datos_id, d.cliente_id,
        d.nombre, d.apellidos, d.telefono,
        d.direccion, d.ciudad, d.codigo_postal, d.pais,
        i.nombre, i.apellidos, i.telefono,
        i.direccion, i.ciudad, i.codigo_postal, i.pais
    FROM deleted AS d
    JOIN inserted AS i
      ON d.datos_id = i.datos_id
    WHERE
        ISNULL(d.nombre,'')        <> ISNULL(i.nombre,'')
     OR ISNULL(d.apellidos,'')    <> ISNULL(i.apellidos,'')
     OR ISNULL(d.telefono,'')     <> ISNULL(i.telefono,'')
     OR ISNULL(d.direccion,'')    <> ISNULL(i.direccion,'')
     OR ISNULL(d.ciudad,'')       <> ISNULL(i.ciudad,'')
     OR ISNULL(d.codigo_postal,'')<> ISNULL(i.codigo_postal,'')
     OR ISNULL(d.pais,'')         <> ISNULL(i.pais,'');
END;
GO

-- Procedimientos

-- Procedimiento INSERT Datos Personales

CREATE OR ALTER PROCEDURE datos_personales_insert
    @cliente_id     NVARCHAR(20),
    @nombre         NVARCHAR(50),
    @apellidos      NVARCHAR(100),
    @telefono       NVARCHAR(20)  = NULL,
    @direccion      NVARCHAR(200) = NULL,
    @ciudad         NVARCHAR(50)  = NULL,
    @codigo_postal  NVARCHAR(10)  = NULL,
    @pais           NVARCHAR(50)  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cliente_id)
        BEGIN
            RAISERROR('cliente_id no existe.',16,1); RETURN;
        END
        IF EXISTS (SELECT 1 FROM datos_personales WHERE cliente_id = @cliente_id)
        BEGIN
            RAISERROR('Ya hay datos_personales para este cliente.',16,1); RETURN;
        END
        INSERT INTO datos_personales (
            cliente_id, nombre, apellidos, telefono,
            direccion, ciudad, codigo_postal, pais
        ) VALUES (
            @cliente_id, @nombre, @apellidos, @telefono,
            @direccion, @ciudad, @codigo_postal, @pais
        );
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK;
        INSERT INTO logs(mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(),'ERROR','datos_personales_insert');
        THROW;
    END CATCH
END;
GO


-- Procedimiento UPDATE Datos Personales

CREATE OR ALTER PROCEDURE datos_personales_update
    @cliente_id     NVARCHAR(20),
    @nombre         NVARCHAR(50),
    @apellidos      NVARCHAR(100),
    @telefono       NVARCHAR(20)  = NULL,
    @direccion      NVARCHAR(200) = NULL,
    @ciudad         NVARCHAR(50)  = NULL,
    @codigo_postal  NVARCHAR(10)  = NULL,
    @pais           NVARCHAR(50)  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM datos_personales WHERE cliente_id = @cliente_id)
        BEGIN
            RAISERROR('No hay datos_personales para este cliente.',16,1); RETURN;
        END
        UPDATE datos_personales
        SET
            nombre        = @nombre,
            apellidos     = @apellidos,
            telefono      = @telefono,
            direccion     = @direccion,
            ciudad        = @ciudad,
            codigo_postal = @codigo_postal,
            pais          = @pais
        WHERE cliente_id = @cliente_id;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK;
        INSERT INTO logs(mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(),'ERROR','datos_personales_update');
        THROW;
    END CATCH
END;
GO

-- Procedimiento DELETE Datos Personales

CREATE OR ALTER PROCEDURE datos_personales_delete
    @cliente_id NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM datos_personales WHERE cliente_id = @cliente_id)
        BEGIN
            RAISERROR('No hay datos_personales para este cliente.',16,1); RETURN;
        END
        DELETE FROM datos_personales WHERE cliente_id = @cliente_id;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK;
        INSERT INTO logs(mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(),'ERROR','datos_personales_delete');
        THROW;
    END CATCH
END;
GO

