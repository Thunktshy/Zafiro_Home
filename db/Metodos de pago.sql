-- ==============================================
-- Tabla de logs generales
-- ==============================================
DROP TABLE IF EXISTS logs;
GO
CREATE TABLE logs (
    log_id    INT           IDENTITY(1,1) PRIMARY KEY,
    fecha     DATETIME      NOT NULL DEFAULT GETDATE(),
    mensaje   NVARCHAR(MAX) NOT NULL,
    nivel     VARCHAR(10)   NOT NULL,
    origen    NVARCHAR(100) NOT NULL
);
GO

-- ==============================================
-- Tabla principal de métodos de pago
-- ==============================================
DROP TABLE IF EXISTS metodos_pago;
GO
CREATE TABLE metodos_pago (
    metodo_id       INT           IDENTITY(1,1) PRIMARY KEY,
    cliente_id      NVARCHAR(20)  NOT NULL,
    tipo            NVARCHAR(20)  NOT NULL,
    direccion      NVARCHAR(200) NULL,
    ciudad         NVARCHAR(50)  NULL,
    codigo_postal  NVARCHAR(10)  NULL,
    pais           NVARCHAR(50)  NULL,

    datos           NVARCHAR(MAX) NOT NULL,

    es_principal    BIT           NOT NULL DEFAULT 0,
    fecha_creacion  DATETIME      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_metodos_pago_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(cliente_id)
);
GO

-- ==============================================
-- Tablas de log para INSERT, DELETE y UPDATE
-- ==============================================
DROP TABLE IF EXISTS metodos_pago_insert_log;
GO
CREATE TABLE metodos_pago_insert_log (
    log_id          INT           IDENTITY(1,1) PRIMARY KEY,
    metodo_id       INT           NOT NULL,
    cliente_id      NVARCHAR(20)  NOT NULL,
    tipo            NVARCHAR(20)  NOT NULL,
    datos           NVARCHAR(MAX) NOT NULL,
    es_principal    BIT           NOT NULL,
    fecha_creacion  DATETIME      NOT NULL,
    fecha_log       DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario         NVARCHAR(50)  NOT NULL DEFAULT SYSTEM_USER
);
GO

DROP TABLE IF EXISTS metodos_pago_delete_log;
GO
CREATE TABLE metodos_pago_delete_log (
    log_id          INT           IDENTITY(1,1) PRIMARY KEY,
    metodo_id       INT           NOT NULL,
    cliente_id      NVARCHAR(20)  NOT NULL,
    tipo            NVARCHAR(20)  NOT NULL,
    datos           NVARCHAR(MAX) NOT NULL,
    es_principal    BIT           NOT NULL,
    fecha_creacion  DATETIME      NOT NULL,
    fecha_log       DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario         NVARCHAR(50)  NOT NULL DEFAULT SYSTEM_USER
);
GO

DROP TABLE IF EXISTS metodos_pago_update_log;
GO
CREATE TABLE metodos_pago_update_log (
    log_id                INT           IDENTITY(1,1) PRIMARY KEY,
    metodo_id             INT           NOT NULL,
    cliente_id            NVARCHAR(20)  NOT NULL,
    tipo_old              NVARCHAR(20)  NULL,
    datos_old             NVARCHAR(MAX) NULL,
    es_principal_old      BIT           NULL,
    tipo_new              NVARCHAR(20)  NULL,
    datos_new             NVARCHAR(MAX) NULL,
    es_principal_new      BIT           NULL,
    fecha_log             DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario               NVARCHAR(50)  NOT NULL DEFAULT SYSTEM_USER
);
GO

-- ==============================================
-- Triggers para poblar logs
-- ==============================================
CREATE OR ALTER TRIGGER trg_insert_metodos_pago
ON metodos_pago
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO metodos_pago_insert_log (
        metodo_id, cliente_id, tipo, datos, es_principal, fecha_creacion
    )
    SELECT
        i.metodo_id,
        i.cliente_id,
        i.tipo,
        i.datos,
        i.es_principal,
        i.fecha_creacion
    FROM inserted AS i;
END;
GO

CREATE OR ALTER TRIGGER trg_delete_metodos_pago
ON metodos_pago
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO metodos_pago_delete_log (
        metodo_id, cliente_id, tipo, datos, es_principal, fecha_creacion
    )
    SELECT
        d.metodo_id,
        d.cliente_id,
        d.tipo,
        d.datos,
        d.es_principal,
        d.fecha_creacion
    FROM deleted AS d;
END;
GO

CREATE OR ALTER TRIGGER trg_update_metodos_pago
ON metodos_pago
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO metodos_pago_update_log (
        metodo_id,
        cliente_id,
        tipo_old, datos_old, es_principal_old,
        tipo_new, datos_new, es_principal_new
    )
    SELECT
        d.metodo_id,
        d.cliente_id,
        d.tipo,
        d.datos,
        d.es_principal,
        i.tipo,
        i.datos,
        i.es_principal
    FROM deleted AS d
    JOIN inserted AS i
      ON d.metodo_id = i.metodo_id
    WHERE
        ISNULL(d.tipo,'')             <> ISNULL(i.tipo,'')
     OR ISNULL(d.datos,'')            <> ISNULL(i.datos,'')
     OR ISNULL(d.es_principal,0)      <> ISNULL(i.es_principal,0);
END;
GO

-- ==============================================
-- Procedimientos almacenados (CRUD completo)
-- ==============================================
-- INSERT
CREATE OR ALTER PROCEDURE metodos_pago_insert
    @cliente_id    NVARCHAR(20),
    @tipo          NVARCHAR(20),
    @datos         NVARCHAR(MAX),
    @es_principal  BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
            IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cliente_id)
                THROW 52000, 'cliente_id no existe.', 1;

            INSERT INTO metodos_pago (
                cliente_id, tipo, datos, es_principal
            )
            VALUES (
                @cliente_id, @tipo, @datos, @es_principal
            );
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK;
        INSERT INTO logs(mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'metodos_pago_insert');
        THROW;
    END CATCH
END;
GO

-- UPDATE
CREATE OR ALTER PROCEDURE metodos_pago_update
    @metodo_id     INT,
    @tipo          NVARCHAR(20),
    @datos         NVARCHAR(MAX),
    @es_principal  BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
            IF NOT EXISTS (SELECT 1 FROM metodos_pago WHERE metodo_id = @metodo_id)
                THROW 52001, 'metodo_id no existe.', 1;

            UPDATE metodos_pago
            SET
                tipo         = @tipo,
                datos        = @datos,
                es_principal = COALESCE(@es_principal, es_principal)
            WHERE metodo_id = @metodo_id;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK;
        INSERT INTO logs(mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'metodos_pago_update');
        THROW;
    END CATCH
END;
GO

-- DELETE
CREATE OR ALTER PROCEDURE metodos_pago_delete
    @metodo_id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
            IF NOT EXISTS (SELECT 1 FROM metodos_pago WHERE metodo_id = @metodo_id)
                THROW 52002, 'metodo_id no existe.', 1;

            DELETE FROM metodos_pago
            WHERE metodo_id = @metodo_id;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK;
        INSERT INTO logs(mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'metodos_pago_delete');
        THROW;
    END CATCH
END;
GO

-- SELECT por cliente
CREATE OR ALTER PROCEDURE metodos_pago_select_by_cliente
    @cliente_id NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        metodo_id,
        cliente_id,
        tipo,
        datos,
        es_principal,
        fecha_creacion
    FROM metodos_pago
    WHERE cliente_id = @cliente_id;
END;
GO

-- SELECT todos
CREATE OR ALTER PROCEDURE metodos_pago_select_all
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        metodo_id,
        cliente_id,
        tipo,
        datos,
        es_principal,
        fecha_creacion
    FROM metodos_pago;
END;
GO

-- ==============================================
-- Sugerencias de índices
-- ==============================================
-- Para búsquedas y joins por cliente_id
CREATE INDEX idx_metodos_pago_cliente_id
    ON metodos_pago (cliente_id);
GO

-- Para consultas frecuentes de método principal por cliente
CREATE INDEX idx_metodos_pago_cliente_principal
    ON metodos_pago (cliente_id, es_principal);
GO

-- Para ordenar o filtrar por fecha de creación
CREATE INDEX idx_metodos_pago_fecha_creacion
    ON metodos_pago (fecha_creacion);
GO

-- Índices en tablas de log para rangos de fecha
CREATE INDEX idx_metodos_pago_insert_log_fecha
    ON metodos_pago_insert_log (fecha_log);
CREATE INDEX idx_metodos_pago_delete_log_fecha
    ON metodos_pago_delete_log (fecha_log);
CREATE INDEX idx_metodos_pago_update_log_fecha
    ON metodos_pago_update_log (fecha_log);
GO

-- Índices en logs generales
CREATE INDEX idx_logs_fecha
    ON logs (fecha);
CREATE INDEX idx_logs_nivel_origen
    ON logs (nivel, origen);
GO
