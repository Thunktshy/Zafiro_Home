-- ==============================================
-- Tabla de logs generales
-- ==============================================
DROP TABLE IF EXISTS logs;
GO
CREATE TABLE logs (
    log_id          INT IDENTITY(1,1) PRIMARY KEY,
    fecha           DATETIME     NOT NULL DEFAULT GETDATE(),
    mensaje         NVARCHAR(MAX) NOT NULL,
    nivel           VARCHAR(10)  NOT NULL,
    origen          NVARCHAR(100) NOT NULL
);
GO

-- ==============================================
-- Tabla principal de datos de facturación
-- ==============================================
DROP TABLE IF EXISTS datos_facturacion;
GO
CREATE TABLE datos_facturacion (
    datos_facturacion_id INT           IDENTITY(1,1) PRIMARY KEY,
    cliente_id          NVARCHAR(20)   NOT NULL,
    rfc                 NVARCHAR(13)   NOT NULL,
    razon_social        NVARCHAR(100)  NOT NULL,
    direccion_fiscal    NVARCHAR(200)  NULL,
    CONSTRAINT fk_datos_facturacion_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(cliente_id)
);
GO

-- ==============================================
-- Tablas de log para INSERT, DELETE y UPDATE
-- ==============================================
DROP TABLE IF EXISTS datos_facturacion_insert_log;
GO
CREATE TABLE datos_facturacion_insert_log (
    log_id               INT           IDENTITY(1,1) PRIMARY KEY,
    datos_facturacion_id INT           NOT NULL,
    cliente_id           NVARCHAR(20)  NOT NULL,
    rfc                  NVARCHAR(13)  NOT NULL,
    razon_social         NVARCHAR(100) NOT NULL,
    direccion_fiscal     NVARCHAR(200) NULL,
    fecha_log            DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario              NVARCHAR(50)  NOT NULL DEFAULT SYSTEM_USER
);
GO

DROP TABLE IF EXISTS datos_facturacion_delete_log;
GO
CREATE TABLE datos_facturacion_delete_log (
    log_id               INT           IDENTITY(1,1) PRIMARY KEY,
    datos_facturacion_id INT           NOT NULL,
    cliente_id           NVARCHAR(20)  NOT NULL,
    rfc                  NVARCHAR(13)  NOT NULL,
    razon_social         NVARCHAR(100) NOT NULL,
    direccion_fiscal     NVARCHAR(200) NULL,
    fecha_log            DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario              NVARCHAR(50)  NOT NULL DEFAULT SYSTEM_USER
);
GO

DROP TABLE IF EXISTS datos_facturacion_update_log;
GO
CREATE TABLE datos_facturacion_update_log (
    log_id               INT           IDENTITY(1,1) PRIMARY KEY,
    datos_facturacion_id INT           NOT NULL,
    cliente_id           NVARCHAR(20)  NOT NULL,
    rfc_old              NVARCHAR(13)  NULL,
    razon_social_old     NVARCHAR(100) NULL,
    direccion_fiscal_old NVARCHAR(200) NULL,
    rfc_new              NVARCHAR(13)  NULL,
    razon_social_new     NVARCHAR(100) NULL,
    direccion_fiscal_new NVARCHAR(200) NULL,
    fecha_log            DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario              NVARCHAR(50)  NOT NULL DEFAULT SYSTEM_USER
);
GO

-- ==============================================
-- Triggers para poblar logs
-- ==============================================
CREATE OR ALTER TRIGGER trg_insert_datos_facturacion
ON datos_facturacion
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO datos_facturacion_insert_log (
        datos_facturacion_id,
        cliente_id,
        rfc,
        razon_social,
        direccion_fiscal
    )
    SELECT
        i.datos_facturacion_id,
        i.cliente_id,
        i.rfc,
        i.razon_social,
        i.direccion_fiscal
    FROM inserted AS i;
END;
GO

CREATE OR ALTER TRIGGER trg_delete_datos_facturacion
ON datos_facturacion
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO datos_facturacion_delete_log (
        datos_facturacion_id,
        cliente_id,
        rfc,
        razon_social,
        direccion_fiscal
    )
    SELECT
        d.datos_facturacion_id,
        d.cliente_id,
        d.rfc,
        d.razon_social,
        d.direccion_fiscal
    FROM deleted AS d;
END;
GO

CREATE OR ALTER TRIGGER trg_update_datos_facturacion
ON datos_facturacion
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO datos_facturacion_update_log (
        datos_facturacion_id,
        cliente_id,
        rfc_old,
        razon_social_old,
        direccion_fiscal_old,
        rfc_new,
        razon_social_new,
        direccion_fiscal_new
    )
    SELECT
        d.datos_facturacion_id,
        d.cliente_id,
        d.rfc,
        d.razon_social,
        d.direccion_fiscal,
        i.rfc,
        i.razon_social,
        i.direccion_fiscal
    FROM deleted AS d
    JOIN inserted AS i
      ON d.datos_facturacion_id = i.datos_facturacion_id
    WHERE
        ISNULL(d.rfc, '')             <> ISNULL(i.rfc, '')
     OR ISNULL(d.razon_social, '')   <> ISNULL(i.razon_social, '')
     OR ISNULL(d.direccion_fiscal,'') <> ISNULL(i.direccion_fiscal,'');
END;
GO

-- ==============================================
-- Procedimientos almacenados (CRUD completo)
-- ==============================================
-- INSERT
CREATE OR ALTER PROCEDURE datos_facturacion_insert
    @cliente_id       NVARCHAR(20),
    @rfc              NVARCHAR(13),
    @razon_social     NVARCHAR(100),
    @direccion_fiscal NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cliente_id)
            THROW 51000, 'El cliente_id no existe.', 1;

        IF EXISTS (SELECT 1 FROM datos_facturacion WHERE cliente_id = @cliente_id)
            THROW 51001, 'Ya existe datos_facturacion para este cliente.', 1;

        INSERT INTO datos_facturacion (
            cliente_id, rfc, razon_social, direccion_fiscal
        )
        VALUES (
            @cliente_id, @rfc, @razon_social, @direccion_fiscal
        );

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'datos_facturacion_insert');
        THROW;
    END CATCH
END;
GO

-- UPDATE
CREATE OR ALTER PROCEDURE datos_facturacion_update
    @cliente_id       NVARCHAR(20),
    @rfc              NVARCHAR(13),
    @razon_social     NVARCHAR(100),
    @direccion_fiscal NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM datos_facturacion WHERE cliente_id = @cliente_id)
            THROW 51002, 'No existe datos_facturacion para este cliente.', 1;

        UPDATE datos_facturacion
        SET
            rfc              = @rfc,
            razon_social     = @razon_social,
            direccion_fiscal = @direccion_fiscal
        WHERE cliente_id = @cliente_id;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'datos_facturacion_update');
        THROW;
    END CATCH
END;
GO

-- DELETE
CREATE OR ALTER PROCEDURE datos_facturacion_delete
    @cliente_id NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM datos_facturacion WHERE cliente_id = @cliente_id)
            THROW 51003, 'No existe datos_facturacion para este cliente.', 1;

        DELETE FROM datos_facturacion
        WHERE cliente_id = @cliente_id;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'datos_facturacion_delete');
        THROW;
    END CATCH
END;
GO

-- SELECT por cliente
CREATE OR ALTER PROCEDURE datos_facturacion_select_by_cliente
    @cliente_id NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        datos_facturacion_id,
        cliente_id,
        rfc,
        razon_social,
        direccion_fiscal
    FROM datos_facturacion
    WHERE cliente_id = @cliente_id;
END;
GO

-- SELECT todos
CREATE OR ALTER PROCEDURE datos_facturacion_select_all
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        datos_facturacion_id,
        cliente_id,
        rfc,
        razon_social,
        direccion_fiscal
    FROM datos_facturacion;
END;
GO

/* =========================
   DATOS FACTURACIÓN: datos_facturacion_por_id
   ========================= */
CREATE OR ALTER PROCEDURE datos_facturacion_por_id
  @datos_facturacion_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    datos_facturacion_id, cliente_id, rfc, razon_social, direccion_fiscal
  FROM datos_facturacion
  WHERE datos_facturacion_id = @datos_facturacion_id;
END;
GO

-- ==============================================
-- Sugerencias de índices para optimizar consultas
-- ==============================================
-- En la tabla principal, el índice UNIQUE en cliente_id (ya implícito por UNIQUE) acelera JOINs y búsquedas frecuentes:
CREATE UNIQUE INDEX idx_datos_facturacion_cliente_id
    ON datos_facturacion (cliente_id);
GO

-- Índices en tablas de log sobre la columna fecha_log para consultas por rango de fecha:
CREATE INDEX idx_datos_facturacion_insert_log_fecha_log
    ON datos_facturacion_insert_log (fecha_log);
CREATE INDEX idx_datos_facturacion_delete_log_fecha_log
    ON datos_facturacion_delete_log (fecha_log);
CREATE INDEX idx_datos_facturacion_update_log_fecha_log
    ON datos_facturacion_update_log (fecha_log);
GO

-- Índices en logs generales para búsquedas por nivel y origen:
CREATE INDEX idx_logs_fecha
    ON logs (fecha);
CREATE INDEX idx_logs_nivel_origen
    ON logs (nivel, origen);
GO

