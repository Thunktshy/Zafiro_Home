-- ==============================================
-- Tabla de logs generales
-- ==============================================
DROP TABLE IF EXISTS logs;
GO
CREATE TABLE logs (
    log_id    INT IDENTITY(1,1) PRIMARY KEY,
    fecha     DATETIME     NOT NULL DEFAULT GETDATE(),
    mensaje   NVARCHAR(MAX) NOT NULL,
    nivel     VARCHAR(10)  NOT NULL,
    origen    NVARCHAR(100) NOT NULL
);
GO

-- ==============================================
-- Tabla principal de datos personales
-- ==============================================
DROP TABLE IF EXISTS datos_personales;
GO
CREATE TABLE datos_personales (
    datos_id       INT           IDENTITY(1,1) PRIMARY KEY,
    cliente_id     NVARCHAR(20)  NOT NULL,
    nombre         NVARCHAR(50)  NOT NULL,
    apellidos      NVARCHAR(100) NOT NULL,
    telefono       NVARCHAR(20)  NULL,
    direccion      NVARCHAR(200) NULL,
    ciudad         NVARCHAR(50)  NULL,
    codigo_postal  NVARCHAR(10)  NULL,
    pais           NVARCHAR(50)  NULL,
    CONSTRAINT fk_datos_personales_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(cliente_id)
);
GO

-- ==============================================
-- Tablas de log para INSERT, DELETE y UPDATE
-- ==============================================
DROP TABLE IF EXISTS datos_personales_insert_log;
GO
CREATE TABLE datos_personales_insert_log (
    log_id     INT           IDENTITY(1,1) PRIMARY KEY,
    datos_id   INT           NOT NULL,
    cliente_id NVARCHAR(20)  NOT NULL,
    nombre     NVARCHAR(50)  NOT NULL,
    apellidos  NVARCHAR(100) NOT NULL,
    fecha_log  DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario    NVARCHAR(50)  NOT NULL DEFAULT SYSTEM_USER
);
GO

DROP TABLE IF EXISTS datos_personales_delete_log;
GO
CREATE TABLE datos_personales_delete_log (
    log_id     INT           IDENTITY(1,1) PRIMARY KEY,
    datos_id   INT           NOT NULL,
    cliente_id NVARCHAR(20)  NOT NULL,
    nombre     NVARCHAR(50)  NOT NULL,
    apellidos  NVARCHAR(100) NOT NULL,
    telefono   NVARCHAR(20)  NULL,
    fecha_log  DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario    NVARCHAR(50)  NOT NULL DEFAULT SYSTEM_USER
);
GO

DROP TABLE IF EXISTS datos_personales_update_log;
GO
CREATE TABLE datos_personales_update_log (
    log_id            INT           IDENTITY(1,1) PRIMARY KEY,
    datos_id          INT           NOT NULL,
    cliente_id        NVARCHAR(20)  NOT NULL,
    nombre_old        NVARCHAR(50)  NULL,
    apellidos_old     NVARCHAR(100) NULL,
    telefono_old      NVARCHAR(20)  NULL,
    direccion_old     NVARCHAR(200) NULL,
    ciudad_old        NVARCHAR(50)  NULL,
    codigo_postal_old NVARCHAR(10)  NULL,
    pais_old          NVARCHAR(50)  NULL,
    nombre_new        NVARCHAR(50)  NULL,
    apellidos_new     NVARCHAR(100) NULL,
    telefono_new      NVARCHAR(20)  NULL,
    direccion_new     NVARCHAR(200) NULL,
    ciudad_new        NVARCHAR(50)  NULL,
    codigo_postal_new NVARCHAR(10)  NULL,
    pais_new          NVARCHAR(50)  NULL,
    fecha_log         DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario           NVARCHAR(50)  NOT NULL DEFAULT SYSTEM_USER
);
GO

-- ==============================================
-- Triggers para poblar logs
-- ==============================================
CREATE OR ALTER TRIGGER trg_insert_datos_personales
ON datos_personales
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO datos_personales_insert_log (
        datos_id, cliente_id, nombre, apellidos
    )
    SELECT
        i.datos_id,
        i.cliente_id,
        i.nombre,
        i.apellidos
    FROM inserted AS i;
END;
GO

CREATE OR ALTER TRIGGER trg_delete_datos_personales
ON datos_personales
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO datos_personales_delete_log (
        datos_id, cliente_id, nombre, apellidos, telefono
    )
    SELECT
        d.datos_id,
        d.cliente_id,
        d.nombre,
        d.apellidos,
        d.telefono
    FROM deleted AS d;
END;
GO

CREATE OR ALTER TRIGGER trg_update_datos_personales
ON datos_personales
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO datos_personales_update_log (
        datos_id,
        cliente_id,
        nombre_old, apellidos_old, telefono_old,
        direccion_old, ciudad_old, codigo_postal_old, pais_old,
        nombre_new, apellidos_new, telefono_new,
        direccion_new, ciudad_new, codigo_postal_new, pais_new
    )
    SELECT
        d.datos_id,
        d.cliente_id,
        d.nombre,        d.apellidos,        d.telefono,
        d.direccion,     d.ciudad,           d.codigo_postal,      d.pais,
        i.nombre,        i.apellidos,        i.telefono,
        i.direccion,     i.ciudad,           i.codigo_postal,      i.pais
    FROM deleted AS d
    JOIN inserted AS i
      ON d.datos_id = i.datos_id
    WHERE
        ISNULL(d.nombre,'')           <> ISNULL(i.nombre,'')
     OR ISNULL(d.apellidos,'')       <> ISNULL(i.apellidos,'')
     OR ISNULL(d.telefono,'')        <> ISNULL(i.telefono,'')
     OR ISNULL(d.direccion,'')       <> ISNULL(i.direccion,'')
     OR ISNULL(d.ciudad,'')          <> ISNULL(i.ciudad,'')
     OR ISNULL(d.codigo_postal,'')   <> ISNULL(i.codigo_postal,'')
     OR ISNULL(d.pais,'')            <> ISNULL(i.pais,'');
END;
GO

-- ==============================================
-- Procedimientos almacenados (CRUD completo)
-- ==============================================
-- INSERT
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
            THROW 51010, 'cliente_id no existe.', 1;

        IF EXISTS (SELECT 1 FROM datos_personales WHERE cliente_id = @cliente_id)
            THROW 51011, 'Ya existe datos_personales para este cliente.', 1;

        INSERT INTO datos_personales (
            cliente_id,
            nombre,
            apellidos,
            telefono,
            direccion,
            ciudad,
            codigo_postal,
            pais
        )
        VALUES (
            @cliente_id,
            @nombre,
            @apellidos,
            @telefono,
            @direccion,
            @ciudad,
            @codigo_postal,
            @pais
        );

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'datos_personales_insert');
        THROW;
    END CATCH
END;
GO

-- UPDATE
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
            THROW 51012, 'No existe datos_personales para este cliente.', 1;

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
        IF @@TRANCOUNT > 0 ROLLBACK;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'datos_personales_update');
        THROW;
    END CATCH
END;
GO

-- DELETE
CREATE OR ALTER PROCEDURE datos_personales_delete
    @cliente_id NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM datos_personales WHERE cliente_id = @cliente_id)
            THROW 51013, 'No existe datos_personales para este cliente.', 1;

        DELETE FROM datos_personales
        WHERE cliente_id = @cliente_id;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'datos_personales_delete');
        THROW;
    END CATCH
END;
GO

-- SELECT por cliente
CREATE OR ALTER PROCEDURE datos_personales_select_by_cliente
    @cliente_id NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        datos_id,
        cliente_id,
        nombre,
        apellidos,
        telefono,
        direccion,
        ciudad,
        codigo_postal,
        pais
    FROM datos_personales
    WHERE cliente_id = @cliente_id;
END;
GO

-- SELECT todos
CREATE OR ALTER PROCEDURE datos_personales_select_all
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        datos_id,
        cliente_id,
        nombre,
        apellidos,
        telefono,
        direccion,
        ciudad,
        codigo_postal,
        pais
    FROM datos_personales;
END;
GO

-- ==============================================
-- Sugerencias de índices
-- ==============================================
-- Índice UNIQUE para búsquedas y JOINs por cliente_id
CREATE UNIQUE INDEX idx_datos_personales_cliente_id
    ON datos_personales (cliente_id);
GO

-- Índices en tablas de log sobre fecha_log para consultas por rango de fechas
CREATE INDEX idx_datos_personales_insert_log_fecha
    ON datos_personales_insert_log (fecha_log);
CREATE INDEX idx_datos_personales_delete_log_fecha
    ON datos_personales_delete_log (fecha_log);
CREATE INDEX idx_datos_personales_update_log_fecha
    ON datos_personales_update_log (fecha_log);
GO

-- Índices en logs generales para búsquedas por nivel y origen
CREATE INDEX idx_logs_fecha
    ON logs (fecha);
CREATE INDEX idx_logs_nivel_origen
    ON logs (nivel, origen);
GO

-- (Opcional) Verificar índice en clientes(cliente_id) para mejorar integridad referencial
-- IF NOT EXISTS (
--     SELECT 1 FROM sys.indexes 
--     WHERE name = 'idx_clientes_cliente_id' 
--       AND object_id = OBJECT_ID('clientes')
-- )
-- BEGIN
--     CREATE INDEX idx_clientes_cliente_id ON clientes (cliente_id);
-- END;
-- GO

