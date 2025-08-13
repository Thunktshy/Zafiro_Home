/* ==============================================================
   CLIENTES – Tablas, Triggers e Índices 
   ============================================================== */

-- ==============================================
-- SECUENCIA para generación de cliente_id
-- ==============================================
DROP SEQUENCE IF EXISTS seq_clientes;
GO
CREATE SEQUENCE seq_clientes
  AS INT START WITH 1 INCREMENT BY 1 MINVALUE 1 NO CYCLE;
GO

-- ==============================================
-- TABLA DE LOGS (global, errores de procedimientos)
-- ==============================================
DROP TABLE IF EXISTS logs;
GO
CREATE TABLE logs (
  log_id  INT IDENTITY(1,1) PRIMARY KEY,
  fecha   DATETIME       NOT NULL DEFAULT GETDATE(),
  origen  NVARCHAR(100)  NOT NULL,   -- Nombre del procedimiento
  mensaje NVARCHAR(MAX)  NOT NULL    -- Texto del error SQL
);
GO

-- ==============================================
-- TABLA PRINCIPAL DE CLIENTES
-- ==============================================
DROP TABLE IF EXISTS clientes;
GO
CREATE TABLE clientes (
  cliente_id     NVARCHAR(20)  NOT NULL PRIMARY KEY,       -- ej: cl-1
  cuenta         NVARCHAR(20)  NOT NULL UNIQUE,
  contrasena     NVARCHAR(255) NOT NULL,                   -- hash
  email          NVARCHAR(150) NOT NULL UNIQUE,
  fecha_registro DATETIME      NOT NULL DEFAULT GETDATE(),
  ultimo_login   DATETIME      NULL,
  estado         BIT           NOT NULL DEFAULT 1 CHECK (estado IN (0,1))  -- 1=activo
);
GO

/* ========================
   Tablas de LOG de clientes
   ======================== */

DROP TABLE IF EXISTS clientes_ins_log;
GO
CREATE TABLE clientes_ins_log (
  log_id         INT IDENTITY(1,1) PRIMARY KEY,
  cliente_id     NVARCHAR(20)  NOT NULL,
  cuenta         NVARCHAR(20)  NOT NULL,
  email          NVARCHAR(150) NOT NULL,
  fecha_registro DATETIME      NOT NULL,
  estado         BIT           NOT NULL,
  fecha_log      DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

DROP TABLE IF EXISTS clientes_del_log;
GO
CREATE TABLE clientes_del_log (
  log_id         INT IDENTITY(1,1) PRIMARY KEY,
  cliente_id     NVARCHAR(20)  NOT NULL,
  cuenta         NVARCHAR(20)  NOT NULL,
  email          NVARCHAR(150) NOT NULL,
  fecha_registro DATETIME      NOT NULL,
  estado         BIT           NOT NULL,
  fecha_log      DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

DROP TABLE IF EXISTS clientes_upd_log;
GO
CREATE TABLE clientes_upd_log (
  log_id           INT IDENTITY(1,1) PRIMARY KEY,
  cliente_id       NVARCHAR(20)  NOT NULL,
  -- valores anteriores (no registramos contraseña)
  cuenta_ant       NVARCHAR(20),
  email_ant        NVARCHAR(150),
  estado_ant       BIT,
  ultimo_login_ant DATETIME,
  -- valores nuevos
  cuenta_nvo       NVARCHAR(20),
  email_nvo        NVARCHAR(150),
  estado_nvo       BIT,
  ultimo_login_nvo DATETIME,
  fecha_log        DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

-- Cambios de contraseña (hash antiguo -> para auditoría)
DROP TABLE IF EXISTS clientes_pass_log;
GO
CREATE TABLE clientes_pass_log (
  log_id               INT IDENTITY(1,1) PRIMARY KEY,
  cliente_id           NVARCHAR(20)  NOT NULL,
  contrasena_anterior  NVARCHAR(255) NOT NULL,  -- hash previo
  fecha_de_cambio      DATETIME      NOT NULL DEFAULT GETDATE(),
  CONSTRAINT fk_pass_log_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(cliente_id)
);
GO

/* ========================
   TRIGGERS (registran cualquier cambio)
   ======================== */

-- INSERT
CREATE OR ALTER TRIGGER trg_ins_clientes
ON clientes
AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO clientes_ins_log (cliente_id, cuenta, email, fecha_registro, estado)
  SELECT i.cliente_id, i.cuenta, i.email, i.fecha_registro, i.estado
  FROM inserted AS i;
END;
GO

-- DELETE
CREATE OR ALTER TRIGGER trg_del_clientes
ON clientes
AFTER DELETE
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO clientes_del_log (cliente_id, cuenta, email, fecha_registro, estado)
  SELECT d.cliente_id, d.cuenta, d.email, d.fecha_registro, d.estado
  FROM deleted AS d;
END;
GO

-- UPDATE (SIEMPRE registra; sin WHERE. No incluye contraseña: se registra aparte)
CREATE OR ALTER TRIGGER trg_upd_clientes
ON clientes
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO clientes_upd_log (
    cliente_id,
    cuenta_ant, email_ant, estado_ant, ultimo_login_ant,
    cuenta_nvo, email_nvo, estado_nvo, ultimo_login_nvo
  )
  SELECT
    d.cliente_id,
    d.cuenta, d.email, d.estado, d.ultimo_login,
    i.cuenta, i.email, i.estado, i.ultimo_login
  FROM deleted d
  JOIN inserted i ON i.cliente_id = d.cliente_id;
END;
GO

-- UPDATE contraseña (solo cuando cambia)
CREATE OR ALTER TRIGGER trg_upd_contrasena
ON clientes
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO clientes_pass_log (cliente_id, contrasena_anterior)
  SELECT d.cliente_id, d.contrasena
  FROM deleted d
  JOIN inserted i ON i.cliente_id = d.cliente_id
  WHERE ISNULL(d.contrasena,'') <> ISNULL(i.contrasena,'');
END;
GO

/* ========================
   PROCEDIMIENTOS
   ======================== */

-- INSERT (concatena 'cl-' + secuencia)
CREATE OR ALTER PROCEDURE clientes_insert
  @cuenta      NVARCHAR(20),
  @contrasena  NVARCHAR(255),
  @email       NVARCHAR(150)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    IF @email NOT LIKE '%_@__%.__%' THROW 56001, 'Formato de email inválido.', 1;

    IF EXISTS (SELECT 1 FROM clientes WHERE cuenta = @cuenta)
      THROW 56002, 'La cuenta ya existe.', 1;

    IF EXISTS (SELECT 1 FROM clientes WHERE email = @email)
      THROW 56003, 'El email ya está registrado.', 1;

    DECLARE @new_cliente_id NVARCHAR(20) = CONCAT('cl-', NEXT VALUE FOR seq_clientes);

    INSERT INTO clientes (cliente_id, cuenta, contrasena, email)
    VALUES (@new_cliente_id, @cuenta, @contrasena, @email);

    COMMIT;
    SELECT @new_cliente_id AS cliente_id;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'clientes_insert', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- UPDATE (acepta 'cl-123' o '123', normaliza)
CREATE OR ALTER PROCEDURE clientes_update
  @id         NVARCHAR(20),
  @cuenta     NVARCHAR(20),
  @email      NVARCHAR(150)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    DECLARE @cid NVARCHAR(20) =
      CASE WHEN LEFT(@id,3) = 'cl-' THEN @id ELSE CONCAT('cl-', @id) END;

    IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cid)
      THROW 56004, 'cliente_id no existe.', 1;

    IF EXISTS (SELECT 1 FROM clientes WHERE cuenta = @cuenta AND cliente_id <> @cid)
      THROW 56005, 'La cuenta ya está en uso por otro cliente.', 1;

    IF EXISTS (SELECT 1 FROM clientes WHERE email = @email AND cliente_id <> @cid)
      THROW 56006, 'El email ya está en uso por otro cliente.', 1;

    UPDATE clientes
    SET cuenta = @cuenta,
        email  = @email
    WHERE cliente_id = @cid;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'clientes_update', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- DELETE físico (acepta 'cl-123' o '123')
CREATE OR ALTER PROCEDURE clientes_delete
  @id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    DECLARE @cid NVARCHAR(20) =
      CASE WHEN LEFT(@id,3) = 'cl-' THEN @id ELSE CONCAT('cl-', @id) END;

    IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cid)
      THROW 56007, 'cliente_id no existe.', 1;

    DELETE FROM clientes WHERE cliente_id = @cid;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'clientes_delete', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- Soft delete (estado = 0) – acepta 'cl-123' o '123'
CREATE OR ALTER PROCEDURE clientes_soft_delete
  @id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    DECLARE @cid NVARCHAR(20) =
      CASE WHEN LEFT(@id,3) = 'cl-' THEN @id ELSE CONCAT('cl-', @id) END;

    IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cid)
      THROW 56008, 'cliente_id no existe.', 1;

    IF (SELECT estado FROM clientes WHERE cliente_id = @cid) = 0
      THROW 56009, 'El cliente ya está desactivado.', 1;

    UPDATE clientes SET estado = 0 WHERE cliente_id = @cid;

    COMMIT;

    SELECT cliente_id, estado FROM clientes WHERE cliente_id = @cid;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'clientes_soft_delete', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- REACTIVAR (estado = 1) – acepta 'cl-123' o '123'
CREATE OR ALTER PROCEDURE clientes_reactivar
  @id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    DECLARE @cid NVARCHAR(20) =
      CASE WHEN LEFT(@id,3)='cl-' THEN @id ELSE CONCAT('cl-',@id) END;

    IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cid)
      THROW 56010, 'cliente_id no existe.', 1;

    IF (SELECT estado FROM clientes WHERE cliente_id = @cid) = 1
      THROW 56011, 'El cliente ya está activo.', 1;

    UPDATE clientes SET estado = 1 WHERE cliente_id = @cid;

    COMMIT;
    SELECT cliente_id, estado FROM clientes WHERE cliente_id = @cid;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT>0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'clientes_reactivar', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO


-- Registrar último login (acepta 'cl-123' o '123')
CREATE OR ALTER PROCEDURE clientes_registrar_login
  @id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    DECLARE @cid NVARCHAR(20) =
      CASE WHEN LEFT(@id,3) = 'cl-' THEN @id ELSE CONCAT('cl-', @id) END;

    UPDATE clientes SET ultimo_login = GETDATE() WHERE cliente_id = @cid;
  END TRY
  BEGIN CATCH
    INSERT INTO logs (origen, mensaje) VALUES (N'clientes_registrar_login', ERROR_MESSAGE());
    -- sin THROW para no romper flujos de login no-críticos
  END CATCH
END;
GO

-- Buscar activos por cuenta/email (solo devuelve cliente_id)
CREATE OR ALTER PROCEDURE buscar_cliente
  @termino_busqueda NVARCHAR(150),
  @solo_activos BIT = 1
AS
BEGIN
  SET NOCOUNT ON;
  SELECT cliente_id
  FROM clientes
  WHERE (cuenta LIKE '%' + @termino_busqueda + '%' OR email LIKE '%' + @termino_busqueda + '%')
    AND (@solo_activos = 0 OR estado = 1)
  ORDER BY cuenta;
END;
GO

-- Obtener cliente por ID (acepta 'cl-123' o '123')
CREATE OR ALTER PROCEDURE cliente_por_id
  @id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @cid NVARCHAR(20) =
    CASE WHEN LEFT(@id,3) = 'cl-' THEN @id ELSE CONCAT('cl-', @id) END;

  SELECT cliente_id, cuenta, contrasena, email, fecha_registro, ultimo_login, estado
  FROM clientes
  WHERE cliente_id = @cid;
END;
GO

-- Lista completa de empleados (sin contraseñas)
CREATE OR ALTER PROCEDURE empleados_select_all
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    SELECT
      empleado_id,
      cuenta,
      email,
      puesto,
      fecha_registro,
      ultimo_login,
      estado
    FROM empleados
    ORDER BY cuenta;
  END TRY
  BEGIN CATCH
    INSERT INTO logs (origen, mensaje)
    VALUES (N'empleados_select_all', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO


/* ========================
   ÍNDICES (auditoría y lecturas)
   ======================== */

-- Logs INSERT/DELETE/UPDATE: buscar por cliente y lo más reciente
CREATE NONCLUSTERED INDEX IX_cli_ins_cliente_fecha
  ON clientes_ins_log (cliente_id, fecha_log);
GO


CREATE NONCLUSTERED INDEX IX_cli_del_cliente_fecha
  ON clientes_del_log (cliente_id, fecha_log);
GO

CREATE NONCLUSTERED INDEX IX_cli_upd_cliente_fecha
  ON clientes_upd_log (cliente_id, fecha_log);
GO

