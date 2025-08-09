-- Tablas, Triggers y procedimientos clientes y sus logs

------------------------------------------------------------------------------
-- SECUENCIA para generación de cliente_id
------------------------------------------------------------------------------
DROP SEQUENCE IF EXISTS seq_clientes;
GO
CREATE SEQUENCE seq_clientes
    AS INT
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO CYCLE;
GO

------------------------------------------------------------------------------
-- TABLA DE LOGS (errores y eventos del sistema)
------------------------------------------------------------------------------
DROP TABLE IF EXISTS logs;
GO
CREATE TABLE logs (
    log_id   INT           IDENTITY(1,1) PRIMARY KEY,
    fecha    DATETIME      DEFAULT GETDATE(),
    mensaje  NVARCHAR(MAX),
    nivel    VARCHAR(10),
    origen   NVARCHAR(100)
);
GO

------------------------------------------------------------------------------
-- TABLA PRINCIPAL DE CLIENTES
------------------------------------------------------------------------------
DROP TABLE IF EXISTS clientes;
GO
CREATE TABLE clientes (
    cliente_id     NVARCHAR(20)  NOT NULL PRIMARY KEY,       -- ID
    cuenta         NVARCHAR(20)  NOT NULL UNIQUE,            -- Identificador único de acceso
    contrasena     NVARCHAR(255) NOT NULL,                   -- Contraseña hasheada
    email          NVARCHAR(150) NOT NULL UNIQUE,            -- Correo único como dentificador de acceso
    fecha_registro DATETIME      NOT NULL DEFAULT GETDATE(), -- Fecha de registro
    ultimo_login   DATETIME      NULL,                       -- Fecha del último login
    estado         BIT           NOT NULL DEFAULT 1 CHECK (estado IN (0,1))   -- 1=activo, 0=inactivo
);
GO

------------------------------------------------------------------------------
-- TABLAS DE LOGS DE OPERACIONES EN CLIENTES
------------------------------------------------------------------------------
DROP TABLE IF EXISTS clientes_ins_log;
GO
CREATE TABLE clientes_ins_log (
    log_id         INT           IDENTITY(1,1) PRIMARY KEY,
    cliente_id     NVARCHAR(20)  NOT NULL,   -- ID del cliente insertado
    cuenta         NVARCHAR(20)  NOT NULL,   -- Cuenta del cliente
    email          NVARCHAR(150) NOT NULL,   -- Email del cliente
    fecha_registro DATETIME      NOT NULL,   -- Fecha de registro capturada
    estado         BIT           NOT NULL,   -- Estado al momento de insert
    fecha_log      DATETIME      NOT NULL 
                        DEFAULT GETDATE()    -- Timestamp del log
);
GO

DROP TABLE IF EXISTS clientes_del_log;
GO
CREATE TABLE clientes_del_log (
    log_id         INT           IDENTITY(1,1) PRIMARY KEY,
    cliente_id     NVARCHAR(20)  NOT NULL,   -- ID del cliente eliminado
    cuenta         NVARCHAR(20)  NOT NULL,
    email          NVARCHAR(150) NOT NULL,
    fecha_registro DATETIME      NOT NULL,   -- Fecha original de registro
    estado         BIT           NOT NULL,   -- Estado antes de eliminar
    fecha_log      DATETIME      NOT NULL 
                        DEFAULT GETDATE()    -- Timestamp del log
);
GO

DROP TABLE IF EXISTS clientes_upd_log;
GO
CREATE TABLE clientes_upd_log (
    log_id              INT           IDENTITY(1,1) PRIMARY KEY,
    cliente_id          NVARCHAR(20)  NOT NULL,  -- ID del cliente actualizado
    cuenta_anterior     NVARCHAR(20)  NOT NULL,
    email_anterior      NVARCHAR(150) NOT NULL,
    estado_anterior     BIT           NOT NULL,
    cuenta_nuevo        NVARCHAR(20)  NOT NULL,
    email_nuevo         NVARCHAR(150) NOT NULL,
    estado_nuevo        BIT           NOT NULL,
    fecha_log           DATETIME      NOT NULL 
                        DEFAULT GETDATE()    -- Timestamp del log
);
GO

--Tabla pa monitorear cambios de contraseña
DROP TABLE IF EXISTS clientes_pass_log;
GO
CREATE TABLE clientes_pass_log (
    log_id               INT           IDENTITY(1,1) PRIMARY KEY,
    cliente_id           NVARCHAR(20)  NOT NULL,  -- ID del cliente que cambia contraseña
    contrasena_anterior  NVARCHAR(255) NOT NULL,  -- Contraseña previa
    fecha_de_cambio      DATETIME      NOT NULL 
                         DEFAULT GETDATE(),      -- Fecha de cambio
    CONSTRAINT fk_pass_log_cliente 
        FOREIGN KEY (cliente_id) REFERENCES clientes(cliente_id)
);
GO

------------------------------------------------------------------------------
-- TRIGGERS DE AUDITORÍA PARA TABLA clientes
------------------------------------------------------------------------------
-- Inserción de clientes
CREATE OR ALTER TRIGGER trg_ins_clientes
ON clientes
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    -- Registra datos básicos del nuevo cliente
    -- Se omiten contraseñas
    INSERT INTO clientes_ins_log (cliente_id, cuenta, email, fecha_registro, estado)
    SELECT cliente_id, cuenta, email, fecha_registro, estado
    FROM inserted;
END;
GO

-- Eliminación de clientes
CREATE OR ALTER TRIGGER trg_del_clientes
ON clientes
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    -- Registra datos del cliente eliminado
    -- Se omiten contraseñas
    INSERT INTO clientes_del_log (cliente_id, cuenta, email, fecha_registro, estado)
    SELECT cliente_id, cuenta, email, fecha_registro, estado
    FROM deleted;
END;
GO

-- Actualización de clientes
CREATE OR ALTER TRIGGER trg_upd_clientes
ON clientes
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    -- Solo registra cambios en cuenta, email o estado
    -- Se omiten contraseñas
    INSERT INTO clientes_upd_log (
        cliente_id,
        cuenta_anterior, email_anterior, estado_anterior,
        cuenta_nuevo,   email_nuevo,     estado_nuevo
    )
    SELECT
        d.cliente_id,
        d.cuenta, d.email, d.estado,
        i.cuenta, i.email, i.estado
    FROM deleted AS d
    INNER JOIN inserted AS i
        ON d.cliente_id = i.cliente_id
    WHERE
        ISNULL(d.cuenta,'')    <> ISNULL(i.cuenta,'')
     OR ISNULL(d.email,'')      <> ISNULL(i.email,'')
     OR ISNULL(d.estado,-1)     <> ISNULL(i.estado,-1);
END;
GO

-- Cambio de contraseña
CREATE OR ALTER TRIGGER trg_upd_contrasena
ON clientes
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    -- Registra cuando realmente cambia la contraseña
    INSERT INTO clientes_pass_log (cliente_id, contrasena_anterior)
    SELECT d.cliente_id, d.contrasena
    FROM deleted AS d
    INNER JOIN inserted AS i
        ON d.cliente_id = i.cliente_id
    WHERE ISNULL(d.contrasena,'') <> ISNULL(i.contrasena,'');
END;
GO

------------------------------------------------------------------------------
-- PROCEDIMIENTOS ALMACENADOS PARA GESTIÓN DE CLIENTES
------------------------------------------------------------------------------
-- Inserta un nuevo cliente
CREATE OR ALTER PROCEDURE clientes_insert
    @cuenta      NVARCHAR(20),
    @contrasena  NVARCHAR(255),
    @email       NVARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Validar formato de email
        IF @email NOT LIKE '%_@__%.__%'
        BEGIN
            RAISERROR('Formato de email inválido.', 16, 1);
            RETURN;
        END;

        -- Verificar unicidad de cuenta
        IF EXISTS (SELECT 1 FROM clientes WHERE cuenta = @cuenta)
        BEGIN
            RAISERROR('La cuenta ya existe.', 16, 1);
            RETURN;
        END;

        -- Verificar unicidad de email
        IF EXISTS (SELECT 1 FROM clientes WHERE email = @email)
        BEGIN
            RAISERROR('El email ya está registrado.', 16, 1);
            RETURN;
        END;

        -- Generar nuevo ID usando la secuencia
        DECLARE @new_cliente_id NVARCHAR(20) =
            CONCAT('cl-', NEXT VALUE FOR seq_clientes);

        -- Insertar el registro con el ID generado
        INSERT INTO clientes (
            cliente_id,
            cuenta,
            contrasena,
            email
        )
        VALUES (
            @new_cliente_id,
            @cuenta,
            @contrasena,
            @email
        );

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        -- Registrar el error en la tabla de logs
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (
            ERROR_MESSAGE(),
            'ERROR',
            'clientes_insert'
        );

        THROW;
    END CATCH
END;
GO

-- Actualiza datos de un cliente
CREATE OR ALTER PROCEDURE clientes_update
    @cliente_id  NVARCHAR(20),
    @cuenta      NVARCHAR(20),
    @email       NVARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Verificar existencia del cliente
        IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cliente_id)
        BEGIN
            RAISERROR('cliente_id no existe.', 16, 1);
            RETURN;
        END;

        -- Validar unicidad de cuenta
        IF EXISTS (
            SELECT 1 FROM clientes
            WHERE cuenta = @cuenta AND cliente_id <> @cliente_id
        )
        BEGIN
            RAISERROR('La cuenta ya está en uso por otro cliente.', 16, 1);
            RETURN;
        END;

        -- Validar unicidad de email
        IF EXISTS (
            SELECT 1 FROM clientes
            WHERE email = @email AND cliente_id <> @cliente_id
        )
        BEGIN
            RAISERROR('El email ya está en uso por otro cliente.', 16, 1);
            RETURN;
        END;

        -- Actualiza cuenta y email
        UPDATE clientes
        SET cuenta = @cuenta,
            email  = @email
        WHERE cliente_id = @cliente_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'clientes_update');

        THROW;
    END CATCH
END;
GO

-- Elimina físicamente un cliente
CREATE OR ALTER PROCEDURE clientes_delete
    @cliente_id NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Verificar existencia
        IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cliente_id)
        BEGIN
            RAISERROR('cliente_id no existe.', 16, 1);
            RETURN;
        END;

        DELETE FROM clientes
        WHERE cliente_id = @cliente_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'clientes_delete');

        THROW;
    END CATCH
END;
GO

-- Desactiva (soft delete) un cliente
CREATE OR ALTER PROCEDURE clientes_soft_delete
    @cliente_id NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Verificar existencia
        IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cliente_id)
        BEGIN
            RAISERROR('cliente_id no existe.', 16, 1);
            RETURN;
        END;

        -- Verificar estado actual
        IF (SELECT estado FROM clientes WHERE cliente_id = @cliente_id) = 0
        BEGIN
            RAISERROR('El cliente ya está desactivado.', 16, 1);
            RETURN;
        END;

        -- Cambiar estado a inactivo
        UPDATE clientes
        SET estado = 0
        WHERE cliente_id = @cliente_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'clientes_soft_delete');

        THROW;
    END CATCH
END;
GO

-- Registra la hora de último acceso del cliente
CREATE OR ALTER PROCEDURE clientes_registrar_login
    @cliente_id NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- Actualiza el campo ultimo_login
        UPDATE clientes
        SET ultimo_login = GETDATE()
        WHERE cliente_id = @cliente_id;
    END TRY
    BEGIN CATCH
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'clientes_registrar_login');
    END CATCH
END;
GO

-- Obtiene la contraseña (hash) de un cliente activo
CREATE OR ALTER PROCEDURE cliente_contrasena
    @cliente_id NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT contrasena
    FROM clientes
    WHERE cliente_id = @cliente_id
      AND estado = 1;
END;
GO

------------------------------------------------------------------------------
-- FUNCIÓN para calcular días desde el último cambio de contraseña
------------------------------------------------------------------------------
CREATE OR ALTER FUNCTION dias_desde_ultimo_cambio
(
    @cliente_id NVARCHAR(20)
)
RETURNS INT
AS
BEGIN
    DECLARE @ult_fecha DATETIME;

    -- Fecha del último registro en clientes_pass_log
    SELECT @ult_fecha = MAX(fecha_de_cambio)
    FROM clientes_pass_log
    WHERE cliente_id = @cliente_id;

    IF @ult_fecha IS NULL
        RETURN NULL;  -- Sin cambios registrados

    -- Diferencia en días
    RETURN DATEDIFF(DAY, @ult_fecha, GETDATE());
END;
GO



/* ==============================================================================
   Procedimiento: Obtener cliente_id por cuenta o email 
   — Devuelve sólo el campo cliente_id para logica de login
   ============================================================================== */

CREATE OR ALTER PROCEDURE buscar_cliente
    @termino_busqueda NVARCHAR(150),  -- Puede ser parte de cuenta o email
    @solo_activos BIT = 1             -- Por defecto solo usuarios activos
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Seguridad: No mostrar contraseñas en los resultados
    SELECT 
        cliente_id
    FROM 
        clientes
    WHERE 
        (cuenta LIKE '%' + @termino_busqueda + '%' OR 
         email LIKE '%' + @termino_busqueda + '%')
        AND (@solo_activos = 0 OR estado = 1)
    ORDER BY 
        cuenta;
END;
GO

/* ==============================================================================
   Procedimiento: Obtener cliente por ID (todos los campos)
   — Devuelve todas las columnas de la tabla clientes
   ============================================================================== */
CREATE OR ALTER PROCEDURE clientes_por_id
    @cliente_id NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT
        cliente_id,
        cuenta,
        contrasena,
        email,
        fecha_registro,
        ultimo_login,
        estado
    FROM clientes
    WHERE cliente_id = @cliente_id;
END;
GO
