/* ==============================================================
   Tablas, Triggers y Procedimientos para Métodos de Pago y sus logs
   ============================================================== */

-- Tabla de logs
CREATE TABLE Logs (
    log_id INT IDENTITY PRIMARY KEY,
    fecha DATETIME     DEFAULT GETDATE(),
    mensaje NVARCHAR(MAX),
    nivel VARCHAR(10),
    origen NVARCHAR(100)
);

-- Tabla principal de metodos_pago
DROP TABLE IF EXISTS metodos_pago;
GO
CREATE TABLE metodos_pago (
    metodo_id        INT IDENTITY(1,1) PRIMARY KEY,
    cliente_id       NVARCHAR(20)    NOT NULL,    -- Almacenar varios métodos de pago por cliente
    tipo             NVARCHAR(20)    NOT NULL,    -- 'tarjeta', 'paypal', 'transferencia', etc.
    datos            NVARCHAR(MAX)   NOT NULL,    -- JSON con detalles del método
    es_principal     BIT             DEFAULT 0,   -- Indica si es el método principal
    fecha_creacion   DATETIME        DEFAULT GETDATE(),
    CONSTRAINT fk_metodos_pago_clientes
        FOREIGN KEY (cliente_id) REFERENCES clientes(cliente_id)
);
GO

-- Tabla INSERT de metodos_pago
DROP TABLE IF EXISTS metodos_pago_ins_log;
GO
CREATE TABLE metodos_pago_ins_log (
    log_id          INT IDENTITY(1,1) PRIMARY KEY,
    metodo_id       INT,
    cliente_id      NVARCHAR(20),
    tipo            NVARCHAR(20),
    datos           NVARCHAR(MAX),
    es_principal    BIT,
    fecha_creacion  DATETIME,
    fecha_log       DATETIME DEFAULT GETDATE(),
    usuario         NVARCHAR(50) DEFAULT SYSTEM_USER
);
GO

-- Tabla DELETE de metodos_pago
DROP TABLE IF EXISTS metodos_pago_del_log;
GO
CREATE TABLE metodos_pago_del_log (
    log_id          INT IDENTITY(1,1) PRIMARY KEY,
    metodo_id       INT,
    cliente_id      NVARCHAR(20),
    tipo            NVARCHAR(20),
    datos           NVARCHAR(MAX),
    es_principal    BIT,
    fecha_creacion  DATETIME,
    fecha_log       DATETIME DEFAULT GETDATE(),
    usuario         NVARCHAR(50) DEFAULT SYSTEM_USER
);
GO

-- Tabla UPDATE de metodos_pago
DROP TABLE IF EXISTS metodos_pago_upd_log;
GO
CREATE TABLE metodos_pago_upd_log (
    log_id                  INT IDENTITY(1,1) PRIMARY KEY,
    metodo_id               INT,
    cliente_id              NVARCHAR(20),
    tipo_anterior           NVARCHAR(20),
    datos_anterior          NVARCHAR(MAX),
    es_principal_anterior   BIT,
    tipo_nuevo              NVARCHAR(20),
    datos_nuevo             NVARCHAR(MAX),
    es_principal_nuevo      BIT,
    fecha_log               DATETIME DEFAULT GETDATE(),
    usuario                 NVARCHAR(50) DEFAULT SYSTEM_USER
);
GO

-- TRIGGER INSERT metodos_pago
CREATE OR ALTER TRIGGER trg_ins_metodos_pago
ON metodos_pago
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO metodos_pago_ins_log (
        metodo_id, cliente_id, tipo, datos, es_principal, fecha_creacion
    )
    SELECT
        i.metodo_id, i.cliente_id, i.tipo, i.datos, i.es_principal, i.fecha_creacion
    FROM inserted AS i;
END;
GO

-- TRIGGER DELETE metodos_pago
CREATE OR ALTER TRIGGER trg_del_metodos_pago
ON metodos_pago
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO metodos_pago_del_log (
        metodo_id, cliente_id, tipo, datos, es_principal, fecha_creacion
    )
    SELECT
        d.metodo_id, d.cliente_id, d.tipo, d.datos, d.es_principal, d.fecha_creacion
    FROM deleted AS d;
END;
GO

-- TRIGGER UPDATE metodos_pago
CREATE OR ALTER TRIGGER trg_upd_metodos_pago
ON metodos_pago
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO metodos_pago_upd_log (
        metodo_id, cliente_id,
        tipo_anterior, datos_anterior, es_principal_anterior,
        tipo_nuevo, datos_nuevo, es_principal_nuevo
    )
    SELECT
        d.metodo_id, d.cliente_id,
        d.tipo, d.datos, d.es_principal,
        i.tipo, i.datos, i.es_principal
    FROM deleted AS d
    JOIN inserted AS i
      ON d.metodo_id = i.metodo_id
    WHERE
        ISNULL(d.tipo,'')           <> ISNULL(i.tipo,'')
     OR ISNULL(d.datos,'')          <> ISNULL(i.datos,'')
     OR ISNULL(d.es_principal,0)    <> ISNULL(i.es_principal,0);
END;
GO

-- Procedimiento INSERT metodos_pago
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
        -- Validar que el cliente existe
        IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cliente_id)
        BEGIN
            RAISERROR('cliente_id no existe.', 16, 1);
            RETURN;
        END
        INSERT INTO metodos_pago (
            cliente_id, tipo, datos, es_principal
        ) VALUES (
            @cliente_id, @tipo, @datos, @es_principal
        );
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (
            ERROR_MESSAGE(),
            'ERROR',
            'metodos_pago_insert'
        );
        THROW;
    END CATCH
END;
GO

-- Procedimiento UPDATE metodos_pago
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
        -- Validar que el método existe
        IF NOT EXISTS (SELECT 1 FROM metodos_pago WHERE metodo_id = @metodo_id)
        BEGIN
            RAISERROR('metodo_id no existe.', 16, 1);
            RETURN;
        END
        UPDATE metodos_pago
        SET
            tipo         = @tipo,
            datos        = @datos,
            es_principal = COALESCE(@es_principal, es_principal)
        WHERE metodo_id = @metodo_id;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (
            ERROR_MESSAGE(),
            'ERROR',
            'metodos_pago_update'
        );
        THROW;
    END CATCH
END;
GO

-- Procedimiento DELETE metodos_pago
CREATE OR ALTER PROCEDURE metodos_pago_delete
    @metodo_id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        -- Validar que el método existe
        IF NOT EXISTS (SELECT 1 FROM metodos_pago WHERE metodo_id = @metodo_id)
        BEGIN
            RAISERROR('metodo_id no existe.', 16, 1);
            RETURN;
        END
        DELETE FROM metodos_pago
        WHERE metodo_id = @metodo_id;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (
            ERROR_MESSAGE(),
            'ERROR',
            'metodos_pago_delete'
        );
        THROW;
    END CATCH
END;
GO
