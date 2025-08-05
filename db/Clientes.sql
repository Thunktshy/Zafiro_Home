-- Tablas, Triggers y procedimientos clientes y sus logs

-- Tabla de logs
CREATE TABLE Logs (
    log_id INT IDENTITY PRIMARY KEY,
    fecha DATETIME     DEFAULT GETDATE(),
    mensaje NVARCHAR(MAX),
    nivel VARCHAR(10),
    origen NVARCHAR(100)
);

-- Tabla principal de clientes
DROP TABLE IF EXISTS Clientes;
CREATE TABLE Clientes (
    cliente_id        NVARCHAR(20)  PRIMARY KEY,
    nombre_cliente    NVARCHAR(50)  UNIQUE NOT NULL,
    password          NVARCHAR(255) NOT NULL,
    email             NVARCHAR(100) UNIQUE NOT NULL,
    fecha_registro    DATETIME      DEFAULT GETDATE() NOT NULL,
    ultimo_login      DATETIME      NULL,
    estado            TINYINT       DEFAULT 1 NOT NULL CHECK (estado IN (0,1))
);

-- Secuencia para cliente_id
CREATE SEQUENCE seq_clientes
    AS INT
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO CYCLE;
GO

-- Tabla INSERT en Clientes
DROP TABLE IF EXISTS Clientes_Ins_Log;
CREATE TABLE Clientes_Ins_Log (
    log_id           INT IDENTITY(1,1) PRIMARY KEY,
    cliente_id       NVARCHAR(20),
    nombre_cliente   NVARCHAR(50),
    email            NVARCHAR(100),
    fecha_registro   DATETIME,
    fecha_log        DATETIME DEFAULT GETDATE()
);

-- Tabla DELETE en Clientes
DROP TABLE IF EXISTS Clientes_Del_Log;
CREATE TABLE Clientes_Del_Log (
    log_id           INT IDENTITY(1,1) PRIMARY KEY,
    cliente_id       NVARCHAR(20),
    nombre_cliente   NVARCHAR(50),
    email            NVARCHAR(100),
    estado           TINYINT,
    fecha_registro   DATETIME,
    fecha_log        DATETIME DEFAULT GETDATE()
);

-- Tabla UPDATE en Clientes
DROP TABLE IF EXISTS Clientes_Upd_Log;
CREATE TABLE Clientes_Upd_Log (
    log_id                    INT IDENTITY(1,1) PRIMARY KEY,
    cliente_id                NVARCHAR(20),
    
    -- valores anteriores
    nombre_cliente_anterior   NVARCHAR(50),
    email_anterior            NVARCHAR(100),
    estado_anterior           TINYINT,
    
    -- valores nuevos
    nombre_cliente_nuevo      NVARCHAR(50),
    email_nuevo               NVARCHAR(100),
    estado_nuevo              TINYINT,
    
    fecha_log                 DATETIME DEFAULT GETDATE()
);

-- Trigger para INSERT en Clientes
CREATE OR ALTER TRIGGER trg_ins_clientes
ON Clientes
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Clientes_Ins_Log (
        cliente_id,
        nombre_cliente,
        email,
        fecha_registro
    )
    SELECT
        cliente_id,
        nombre_cliente,
        email,
        fecha_registro
    FROM inserted;
END;
GO

-- Trigger para DELETE en Clientes
CREATE OR ALTER TRIGGER trg_del_clientes
ON Clientes
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Clientes_Del_Log (
        cliente_id,
        nombre_cliente,
        email,
        estado,
        fecha_registro
    )
    SELECT
        cliente_id,
        nombre_cliente,
        email,
        estado,
        fecha_registro
    FROM deleted;
END;
GO

-- Trigger para UPDATE en Clientes
CREATE OR ALTER TRIGGER trg_upd_clientes
ON Clientes
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Clientes_Upd_Log (
        cliente_id,
        nombre_cliente_anterior, email_anterior, estado_anterior,
        nombre_cliente_nuevo,    email_nuevo,     estado_nuevo
    )
    SELECT
        d.cliente_id,
        d.nombre_cliente, d.email, d.estado,
        i.nombre_cliente, i.email, i.estado
    FROM deleted AS d
    JOIN inserted AS i
      ON d.cliente_id = i.cliente_id
    WHERE
        d.nombre_cliente <> i.nombre_cliente
        OR d.email         <> i.email
        OR d.estado        <> i.estado;
END;
GO

-- Procedimiento de insert de cliente
CREATE OR ALTER PROCEDURE Clientes_Insert
    @nombre_cliente NVARCHAR(50),
    @password       NVARCHAR(255),
    @email          NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Validación básica de email
        IF @email NOT LIKE '%_@__%.__%'
        BEGIN
            RAISERROR('Formato de email inválido.', 16, 1);
            RETURN;
        END;

        -- Duplicado de email
        IF EXISTS (SELECT 1 FROM Clientes WHERE email = @email)
        BEGIN
            RAISERROR('El email ya está registrado.', 16, 1);
            RETURN;
        END;

        -- Duplicado de nombre
        IF EXISTS (SELECT 1 FROM Clientes WHERE nombre_cliente = @nombre_cliente)
        BEGIN
            RAISERROR('El nombre de cliente ya está en uso.', 16, 1);
            RETURN;
        END;

        INSERT INTO Clientes (cliente_id, nombre_cliente, password, email)
        VALUES (
            CONCAT('cl-', NEXT VALUE FOR seq_clientes),
            @nombre_cliente,
            @password,
            @email
        );

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        INSERT INTO Logs (mensaje, nivel, origen)
        VALUES (
            ERROR_MESSAGE(),
            'ERROR',
            'error_al_insertar_cliente'
        );
        THROW;
    END CATCH
END;
GO

-- Ejecución
EXECUTE Clientes_Insert
    @nombre_cliente = '',
    @password       = '',
    @email          = '';
GO

-- Procedimiento de actualización de cliente
CREATE OR ALTER PROCEDURE Clientes_Update
    @cliente_id     NVARCHAR(20),
    @nombre_cliente NVARCHAR(50),
    @password       NVARCHAR(255),
    @email          NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF @email NOT LIKE '%_@__%.__%'
        BEGIN
            RAISERROR('Formato de email inválido.', 16, 1);
            RETURN;
        END;

        IF NOT EXISTS (SELECT 1 FROM Clientes WHERE cliente_id = @cliente_id)
        BEGIN
            RAISERROR('Cliente no encontrado.', 16, 1);
            RETURN;
        END;

        IF EXISTS (
            SELECT 1 FROM Clientes
            WHERE nombre_cliente = @nombre_cliente
              AND cliente_id <> @cliente_id
        )
        BEGIN
            RAISERROR('El nombre de cliente ya está en uso.', 16, 1);
            RETURN;
        END;

        IF EXISTS (
            SELECT 1 FROM Clientes
            WHERE email = @email
              AND cliente_id <> @cliente_id
        )
        BEGIN
            RAISERROR('El email ya está registrado por otro cliente.', 16, 1);
            RETURN;
        END;

        UPDATE Clientes
        SET
            nombre_cliente = @nombre_cliente,
            password       = @password,
            email          = @email
        WHERE cliente_id = @cliente_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        INSERT INTO Logs (mensaje, nivel, origen)
        VALUES (
            ERROR_MESSAGE(),
            'ERROR',
            'error_al_actualizar_cliente'
        );
        THROW;
    END CATCH
END;
GO

-- Ejecución
EXECUTE Clientes_Update
    @cliente_id     = '',
    @nombre_cliente = '',
    @password       = '',
    @email          = '';
GO

-- Procedimiento para desactivar cliente
CREATE OR ALTER PROCEDURE Clientes_Desactivar
    @cliente_id NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM Clientes WHERE cliente_id = @cliente_id)
        BEGIN
            RAISERROR('Cliente no encontrado.', 16, 1);
            RETURN;
        END;

        IF EXISTS (
            SELECT 1 FROM Clientes
            WHERE cliente_id = @cliente_id
              AND estado = 0
        )
        BEGIN
            RAISERROR('El cliente ya está desactivado.', 16, 1);
            RETURN;
        END;

        UPDATE Clientes
        SET estado = 0
        WHERE cliente_id = @cliente_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        INSERT INTO Logs (mensaje, nivel, origen)
        VALUES (
            ERROR_MESSAGE(),
            'ERROR',
            'error_al_desactivar_cliente'
        );
        THROW;
    END CATCH
END;
GO

-- Ejecución
EXECUTE Clientes_Desactivar
    @cliente_id = '';
GO

-- Tabla de auditoría de cambios de contraseña
DROP TABLE IF EXISTS Clientes_Pass_Log;
GO
CREATE TABLE Clientes_Pass_Log (
    log_id               INT IDENTITY(1,1) PRIMARY KEY,
    cliente_id           NVARCHAR(20)    NOT NULL,
    password_anterior    NVARCHAR(255)   NOT NULL,
    fecha_de_cambio      DATETIME        NOT NULL
    CONSTRAINT PassLog_Fecha DEFAULT GETDATE(),
    CONSTRAINT FK_PassLog_Clientes FOREIGN KEY(cliente_id)
    REFERENCES Clientes(cliente_id)
);
GO

-- Trigger que registra el cambio de contraseña
CREATE OR ALTER TRIGGER trg_upd_password
ON Clientes
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Clientes_Pass_Log (cliente_id, password_anterior)
    SELECT d.cliente_id, d.password
    FROM deleted AS d
    INNER JOIN inserted AS i
        ON d.cliente_id = i.cliente_id
    WHERE
        -- Sólo cuando realmente cambió la contraseña
        ISNULL(d.password, '') <> ISNULL(i.password, '');
END;
GO

--  Función para calcular días desde el último cambio de contraseña
CREATE OR ALTER FUNCTION DiasDesdeUltimoCambio
(
    @cliente_id NVARCHAR(20)
)
RETURNS INT
AS
BEGIN
    DECLARE @ult_fecha DATETIME;

    SELECT @ult_fecha = MAX(fecha_de_cambio)
    FROM Clientes_Pass_Log
    WHERE cliente_id = @cliente_id;

    IF @ult_fecha IS NULL
        RETURN NULL;  -- o 0, según convenga

    RETURN DATEDIFF(DAY, @ult_fecha, GETDATE());
END;
GO

EXECUTE DiasDesdeUltimoCambio @cliente_id = " ";