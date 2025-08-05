-- Tablas, Triggers y procedimientos para DatosFiscales y sus logs 

-- Tabla de logs
CREATE TABLE Logs (
    log_id INT IDENTITY PRIMARY KEY,
    fecha DATETIME     DEFAULT GETDATE(),
    mensaje NVARCHAR(MAX),
    nivel VARCHAR(10),
    origen NVARCHAR(100)
);

-- Tabla principal de Datos fiscales

DROP TABLE IF EXISTS DatosFiscales;
GO

CREATE TABLE DatosFiscales (
    datos_fiscales_id   INT IDENTITY(1,1) PRIMARY KEY,
    cliente_id          NVARCHAR(20)    UNIQUE NOT NULL,
    rfc                 NVARCHAR(13),
    razon_social        NVARCHAR(100),
    direccion_fiscal    NVARCHAR(200),
    FOREIGN KEY (cliente_id)
        REFERENCES Clientes(cliente_id)
);
GO

-- Tabla INSERT Datos Fiscales

DROP TABLE IF EXISTS datos_fiscales_ins_log;
CREATE TABLE datos_fiscales_ins_log (
    log_id              INT IDENTITY(1,1) PRIMARY KEY,
    datos_fiscales_id   INT,
    cliente_id          NVARCHAR(20),
    rfc                 NVARCHAR(13),
    razon_social        NVARCHAR(100),
    direccion_fiscal    NVARCHAR(200),
    fecha_log           DATETIME DEFAULT GETDATE(),
    usuario             NVARCHAR(50) DEFAULT SYSTEM_USER
);

-- Tabla DELETE Datos Fiscales

DROP TABLE IF EXISTS datos_fiscales_del_log;
CREATE TABLE datos_fiscales_del_log (
    log_id              INT IDENTITY(1,1) PRIMARY KEY,
    datos_fiscales_id   INT,
    cliente_id          NVARCHAR(20),
    rfc                 NVARCHAR(13),
    razon_social        NVARCHAR(100),
    fecha_log           DATETIME DEFAULT GETDATE(),
    usuario             NVARCHAR(50) DEFAULT SYSTEM_USER
);

-- Tabla UPDATE Datos Fiscales

DROP TABLE IF EXISTS datos_fiscales_upd_log;
CREATE TABLE datos_fiscales_upd_log (
    log_id                 INT IDENTITY(1,1) PRIMARY KEY,
    datos_fiscales_id      INT,
    cliente_id             NVARCHAR(20),
    rfc_anterior           NVARCHAR(13),
    razon_social_anterior  NVARCHAR(100),
    direccion_fiscal_ant   NVARCHAR(200),
    rfc_nuevo              NVARCHAR(13),
    razon_social_nuevo     NVARCHAR(100),
    direccion_fiscal_new   NVARCHAR(200),
    fecha_log              DATETIME DEFAULT GETDATE(),
    usuario                NVARCHAR(50) DEFAULT SYSTEM_USER
);

-- Triggers

-- Trigger INSERT Datos Fiscales

CREATE OR ALTER TRIGGER trg_ins_datos_fiscales
ON datos_fiscales
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO datos_fiscales_ins_log (
        datos_fiscales_id, cliente_id, rfc, razon_social, direccion_fiscal
    )
    SELECT i.datos_fiscales_id, i.cliente_id, i.rfc, i.razon_social, i.direccion_fiscal
    FROM inserted AS i;
END;
GO

-- Trigger DELETE Datos Fiscales

CREATE OR ALTER TRIGGER trg_del_datos_fiscales
ON datos_fiscales
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO datos_fiscales_del_log (
        datos_fiscales_id, cliente_id, rfc, razon_social
    )
    SELECT d.datos_fiscales_id, d.cliente_id, d.rfc, d.razon_social
    FROM deleted AS d;
END;
GO

-- Trigger UPDATE Datos Fiscales

CREATE OR ALTER TRIGGER trg_upd_datos_fiscales
ON datos_fiscales
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO datos_fiscales_upd_log (
        datos_fiscales_id, cliente_id,
        rfc_anterior, razon_social_anterior, direccion_fiscal_ant,
        rfc_nuevo, razon_social_nuevo, direccion_fiscal_new
    )
    SELECT
        d.datos_fiscales_id, d.cliente_id,
        d.rfc, d.razon_social, d.direccion_fiscal,
        i.rfc, i.razon_social, i.direccion_fiscal
    FROM deleted AS d
    JOIN inserted AS i
      ON d.datos_fiscales_id = i.datos_fiscales_id
    WHERE
        ISNULL(d.rfc,'')             <> ISNULL(i.rfc,'')
     OR ISNULL(d.razon_social,'')   <> ISNULL(i.razon_social,'')
     OR ISNULL(d.direccion_fiscal,'')<> ISNULL(i.direccion_fiscal,'');
END;
GO

-- Procedimientos

-- Procedimiento INSERT Datos Fiscales

CREATE OR ALTER PROCEDURE datos_fiscales_insert
    @cliente_id          NVARCHAR(20),
    @rfc                 NVARCHAR(13),
    @razon_social        NVARCHAR(100),
    @direccion_fiscal    NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cliente_id)
        BEGIN
            RAISERROR('cliente_id no existe.',16,1); RETURN;
        END
        IF EXISTS (SELECT 1 FROM datos_fiscales WHERE cliente_id = @cliente_id)
        BEGIN
            RAISERROR('Ya hay datos_fiscales para este cliente.',16,1); RETURN;
        END
        INSERT INTO datos_fiscales (
            cliente_id, rfc, razon_social, direccion_fiscal
        ) VALUES (
            @cliente_id, @rfc, @razon_social, @direccion_fiscal
        );
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK;
        INSERT INTO logs(mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(),'ERROR','datos_fiscales_insert');
        THROW;
    END CATCH
END;
GO

-- Procedimiento UPDATE Datos Fiscales

CREATE OR ALTER PROCEDURE datos_fiscales_update
    @cliente_id          NVARCHAR(20),
    @rfc                 NVARCHAR(13),
    @razon_social        NVARCHAR(100),
    @direccion_fiscal    NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM datos_fiscales WHERE cliente_id = @cliente_id)
        BEGIN
            RAISERROR('No hay datos_fiscales para este cliente.',16,1); RETURN;
        END
        UPDATE datos_fiscales
        SET
            rfc              = @rfc,
            razon_social     = @razon_social,
            direccion_fiscal = @direccion_fiscal
        WHERE cliente_id = @cliente_id;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK;
        INSERT INTO logs(mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(),'ERROR','datos_fiscales_update');
        THROW;
    END CATCH
END;
GO

-- Procedimiento DELETE Datos Fiscales

CREATE OR ALTER PROCEDURE datos_fiscales_delete
    @cliente_id NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM datos_fiscales WHERE cliente_id = @cliente_id)
        BEGIN
            RAISERROR('No hay datos_fiscales para este cliente.',16,1); RETURN;
        END
        DELETE FROM datos_fiscales WHERE cliente_id = @cliente_id;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK;
        INSERT INTO logs(mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(),'ERROR','datos_fiscales_delete');
        THROW;
    END CATCH
END;
GO