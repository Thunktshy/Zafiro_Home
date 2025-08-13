CREATE DATABASE tiendaonline;
GO

USE tiendaonline;
GO

/* ==============================================================
   Tablas, Triggers e Índices para Categorías
   ============================================================== */

-- ==============================================
-- Tabla de logs (errores de procedimientos)
-- ==============================================
DROP TABLE IF EXISTS logs;
GO
CREATE TABLE logs (
    log_id  INT IDENTITY(1,1) PRIMARY KEY,
    fecha   DATETIME       NOT NULL DEFAULT GETDATE(),
    origen  NVARCHAR(100)  NOT NULL, -- Nombre del procedimiento
    mensaje NVARCHAR(MAX)  NOT NULL,  -- Texto del error SQL
    usuario NVARCHAR(100)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

-- ==============================================
-- Tabla principal de categorías
-- ==============================================
DROP TABLE IF EXISTS categorias;
GO
CREATE TABLE categorias (
    categoria_id      INT IDENTITY(1,1) PRIMARY KEY,   -- PK
    nombre_categoria  NVARCHAR(50) UNIQUE NOT NULL,    -- Único
    descripcion       NVARCHAR(255) NULL
);
GO

/* ========================
   Tablas de LOG (auditoría)
   ======================== */

DROP TABLE IF EXISTS categorias_insert_log;
GO
CREATE TABLE categorias_insert_log (
    log_id            INT IDENTITY(1,1) PRIMARY KEY,
    categoria_id      INT,
    nombre_categoria  NVARCHAR(50),
    descripcion       NVARCHAR(255),
    fecha_log         DATETIME    NOT NULL DEFAULT GETDATE(),
    usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS categorias_delete_log;
GO
CREATE TABLE categorias_delete_log (
    log_id            INT IDENTITY(1,1) PRIMARY KEY,
    categoria_id      INT,
    nombre_categoria  NVARCHAR(50),
    descripcion       NVARCHAR(255),
    fecha_log         DATETIME    NOT NULL DEFAULT GETDATE(),
    usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS categorias_update_log;
GO
CREATE TABLE categorias_update_log (
    log_id                    INT IDENTITY(1,1) PRIMARY KEY,
    categoria_id              INT,
    nombre_categoria_anterior NVARCHAR(50),
    descripcion_anterior      NVARCHAR(255),
    nombre_categoria_nuevo    NVARCHAR(50),
    descripcion_nuevo         NVARCHAR(255),
    fecha_log                 DATETIME    NOT NULL DEFAULT GETDATE(),
    usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

/* ========================
   TRIGGERS
   ======================== */

-- INSERT
CREATE OR ALTER TRIGGER trg_insert_categorias
ON categorias
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO categorias_insert_log (categoria_id, nombre_categoria, descripcion)
    SELECT i.categoria_id, i.nombre_categoria, i.descripcion
    FROM inserted AS i;
END;
GO

-- DELETE
CREATE OR ALTER TRIGGER trg_delete_categorias
ON categorias
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO categorias_delete_log (categoria_id, nombre_categoria, descripcion)
    SELECT d.categoria_id, d.nombre_categoria, d.descripcion
    FROM deleted AS d;
END;
GO

-- UPDATE (solo log si hay cambios reales)
CREATE OR ALTER TRIGGER trg_update_categorias
ON categorias
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO categorias_update_log (
        categoria_id,
        nombre_categoria_anterior, descripcion_anterior,
        nombre_categoria_nuevo,    descripcion_nuevo
    )
    SELECT
        d.categoria_id,
        d.nombre_categoria, d.descripcion,
        i.nombre_categoria, i.descripcion
    FROM deleted  AS d
    JOIN inserted AS i
      ON d.categoria_id = i.categoria_id
    WHERE
        ISNULL(d.nombre_categoria,'') <> ISNULL(i.nombre_categoria,'')
        OR ISNULL(d.descripcion,'')  <> ISNULL(i.descripcion,'');
END;
GO

/* ========================
   PROCEDIMIENTOS
   ======================== */

-- INSERT categorías 
CREATE OR ALTER PROCEDURE categorias_insert
    @nombre_categoria NVARCHAR(50),
    @descripcion      NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF LTRIM(RTRIM(@nombre_categoria)) = ''
            THROW 51001, 'nombre_categoria no puede estar vacío.', 1;

        IF EXISTS (SELECT 1 FROM categorias WHERE nombre_categoria = @nombre_categoria)
            THROW 51002, 'La categoría ya existe.', 1;

        INSERT INTO categorias (nombre_categoria, descripcion)
        VALUES (@nombre_categoria, @descripcion);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (origen, mensaje)
        VALUES (N'categorias_insert', ERROR_MESSAGE());
        THROW;
    END CATCH
END;
GO

-- UPDATE categorías
CREATE OR ALTER PROCEDURE categorias_update
    @categoria_id      INT,
    @nombre_categoria  NVARCHAR(50),
    @descripcion       NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM categorias WHERE categoria_id = @categoria_id)
            THROW 51003, 'La categoría ya no se encuentra en la base de datos.', 1;

        IF LTRIM(RTRIM(@nombre_categoria)) = ''
            THROW 51004, 'nombre_categoria no puede estar vacío.', 1;

        IF EXISTS (
            SELECT 1 FROM categorias
            WHERE nombre_categoria = @nombre_categoria
              AND categoria_id <> @categoria_id
        )
            THROW 51005, 'Otra categoría ya usa ese nombre.', 1;

        UPDATE categorias
        SET nombre_categoria = @nombre_categoria,
            descripcion      = @descripcion
        WHERE categoria_id = @categoria_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (origen, mensaje)
        VALUES (N'categorias_update', ERROR_MESSAGE());
        THROW;
    END CATCH
END;
GO

-- DELETE categorías
CREATE OR ALTER PROCEDURE categorias_delete
    @categoria_id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM categorias WHERE categoria_id = @categoria_id)
            THROW 51006, 'La categoría ya no se encuentra en la base de datos.', 1;

        DELETE FROM categorias
        WHERE categoria_id = @categoria_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (origen, mensaje)
        VALUES (N'categorias_delete', ERROR_MESSAGE());
        THROW;
    END CATCH
END;
GO

-- Obtener todas las categorías
CREATE OR ALTER PROCEDURE categorias_get_all
AS
BEGIN
    SET NOCOUNT ON;
    SELECT categoria_id, nombre_categoria, descripcion
    FROM categorias
    ORDER BY nombre_categoria;
END;
GO

-- Obtener lista de categorías (solo id y nombre)
CREATE OR ALTER PROCEDURE categorias_get_list
AS
BEGIN
    SET NOCOUNT ON;
    SELECT categoria_id, nombre_categoria
    FROM categorias
    ORDER BY nombre_categoria;
END;
GO

-- Obtener categoría por id
CREATE OR ALTER PROCEDURE categorias_por_id
  @categoria_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT categoria_id, nombre_categoria, descripcion
  FROM categorias
  WHERE categoria_id = @categoria_id;
END;
GO

/* ========================
   ÍNDICES
   ======================== */

-- 1) Cubre consultas que ordenan por nombre y devuelven id/descripcion
CREATE NONCLUSTERED INDEX IX_categorias_nombre_cover_all
ON categorias(nombre_categoria)
INCLUDE (categoria_id, descripcion);
GO

-- 2) Logs de INSERT: buscar por categoria y traer lo más reciente
CREATE NONCLUSTERED INDEX IX_cat_insert_categoria_fecha
ON categorias_insert_log (categoria_id, fecha_log)
INCLUDE (nombre_categoria, descripcion);
GO

-- 3) Logs de DELETE: buscar por categoria y traer lo más reciente
CREATE NONCLUSTERED INDEX IX_cat_delete_categoria_fecha
ON categorias_delete_log (categoria_id, fecha_log)
INCLUDE (nombre_categoria, descripcion);
GO

-- 4) Logs de UPDATE: buscar por categoria y traer lo más reciente
CREATE NONCLUSTERED INDEX IX_cat_update_categoria_fecha
ON categorias_update_log (categoria_id, fecha_log)
INCLUDE (
    nombre_categoria_anterior, descripcion_anterior,
    nombre_categoria_nuevo,    descripcion_nuevo
);
GO

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
  fecha_log      DATETIME      NOT NULL DEFAULT GETDATE(),
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
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
  fecha_log      DATETIME      NOT NULL DEFAULT GETDATE(),
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
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
  fecha_log        DATETIME      NOT NULL DEFAULT GETDATE(),
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
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
  CONSTRAINT fk_pass_log_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(cliente_id),
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
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

/* ==============================================================
   EMPLEADOS – Tablas, Triggers, Procedimientos e Índices
   ============================================================== */

-- ==============================================
-- Tabla principal de empleados
-- ==============================================
DROP TABLE IF EXISTS empleados;
GO
CREATE TABLE empleados (
  empleado_id    INT IDENTITY(1,1) PRIMARY KEY,
  cuenta         NVARCHAR(20)  NOT NULL UNIQUE,
  contrasena     NVARCHAR(255) NOT NULL,                 -- hash
  email          NVARCHAR(150) NOT NULL UNIQUE,
  puesto         NVARCHAR(30)  NOT NULL DEFAULT N'Administrador',
  fecha_registro DATETIME      NOT NULL DEFAULT GETDATE(),
  ultimo_login   DATETIME      NULL,
  estado         BIT           NOT NULL DEFAULT 1 CHECK (estado IN (0,1))  -- 1=activo
);
GO

/* ========================
   Tablas de LOG de empleados
   ======================== */
DROP TABLE IF EXISTS empleados_ins_log;
GO
CREATE TABLE empleados_ins_log (
  log_id         INT IDENTITY(1,1) PRIMARY KEY,
  empleado_id    INT,
  cuenta         NVARCHAR(20),
  email          NVARCHAR(150),
  puesto         NVARCHAR(30),
  fecha_registro DATETIME,
  estado         BIT,
  fecha_log      DATETIME NOT NULL DEFAULT GETDATE(),
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS empleados_del_log;
GO
CREATE TABLE empleados_del_log (
  log_id         INT IDENTITY(1,1) PRIMARY KEY,
  empleado_id    INT,
  cuenta         NVARCHAR(20),
  email          NVARCHAR(150),
  puesto         NVARCHAR(30),
  fecha_registro DATETIME,
  estado         BIT,
  fecha_log      DATETIME NOT NULL DEFAULT GETDATE(),
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS empleados_upd_log;
GO
CREATE TABLE empleados_upd_log (
  log_id            INT IDENTITY(1,1) PRIMARY KEY,
  empleado_id       INT,
  -- valores anteriores (nunca contraseña)
  cuenta_ant        NVARCHAR(20),
  email_ant         NVARCHAR(150),
  puesto_ant        NVARCHAR(30),
  estado_ant        BIT,
  ultimo_login_ant  DATETIME,
  -- valores nuevos
  cuenta_nvo        NVARCHAR(20),
  email_nvo         NVARCHAR(150),
  puesto_nvo        NVARCHAR(30),
  estado_nvo        BIT,
  ultimo_login_nvo  DATETIME,
  fecha_log         DATETIME NOT NULL DEFAULT GETDATE(),
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

-- Cambios de contraseña (almacena el hash previo)
DROP TABLE IF EXISTS empleados_pass_log;
GO
CREATE TABLE empleados_pass_log (
  log_id              INT IDENTITY(1,1) PRIMARY KEY,
  empleado_id         INT NOT NULL,
  contrasena_anterior NVARCHAR(255) NOT NULL,   -- hash previo
  fecha_de_cambio     DATETIME      NOT NULL DEFAULT GETDATE(),
  CONSTRAINT fk_emppass_emp FOREIGN KEY (empleado_id) REFERENCES empleados(empleado_id),
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

/* ========================
   TRIGGERS (registran cualquier cambio)
   ======================== */

-- INSERT
CREATE OR ALTER TRIGGER trg_ins_empleados
ON empleados
AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO empleados_ins_log (empleado_id, cuenta, email, puesto, fecha_registro, estado)
  SELECT i.empleado_id, i.cuenta, i.email, i.puesto, i.fecha_registro, i.estado
  FROM inserted i;
END;
GO

-- DELETE
CREATE OR ALTER TRIGGER trg_del_empleados
ON empleados
AFTER DELETE
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO empleados_del_log (empleado_id, cuenta, email, puesto, fecha_registro, estado)
  SELECT d.empleado_id, d.cuenta, d.email, d.puesto, d.fecha_registro, d.estado
  FROM deleted d;
END;
GO

-- UPDATE (SIEMPRE registra; sin WHERE. Contraseña se registra aparte)
CREATE OR ALTER TRIGGER trg_upd_empleados
ON empleados
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO empleados_upd_log (
    empleado_id,
    cuenta_ant, email_ant, puesto_ant, estado_ant, ultimo_login_ant,
    cuenta_nvo, email_nvo, puesto_nvo, estado_nvo, ultimo_login_nvo
  )
  SELECT
    d.empleado_id,
    d.cuenta, d.email, d.puesto, d.estado, d.ultimo_login,
    i.cuenta, i.email, i.puesto, i.estado, i.ultimo_login
  FROM deleted d
  JOIN inserted i ON i.empleado_id = d.empleado_id;
END;
GO

-- UPDATE de contraseña (solo cuando cambia)
CREATE OR ALTER TRIGGER trg_upd_empleados_password
ON empleados
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO empleados_pass_log (empleado_id, contrasena_anterior)
  SELECT d.empleado_id, d.contrasena
  FROM deleted d
  JOIN inserted i ON i.empleado_id = d.empleado_id
  WHERE ISNULL(d.contrasena,'') <> ISNULL(i.contrasena,'');
END;
GO

/* ========================
   PROCEDIMIENTOS
   ======================== */

-- INSERT
CREATE OR ALTER PROCEDURE empleados_insert
  @cuenta     NVARCHAR(20),
  @contrasena NVARCHAR(255),
  @email      NVARCHAR(150),
  @puesto     NVARCHAR(30) = N'Administrador'
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    IF EXISTS (SELECT 1 FROM empleados WHERE cuenta = @cuenta)
      THROW 57001, 'La cuenta ya existe.', 1;

    IF EXISTS (SELECT 1 FROM empleados WHERE email = @email)
      THROW 57002, 'El email ya está registrado.', 1;

    INSERT INTO empleados (cuenta, contrasena, email, puesto)
    VALUES (@cuenta, @contrasena, @email, @puesto);

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'empleados_insert', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- UPDATE
CREATE OR ALTER PROCEDURE empleados_update
  @empleado_id INT,
  @cuenta      NVARCHAR(20),
  @email       NVARCHAR(150),
  @puesto      NVARCHAR(30)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    IF NOT EXISTS (SELECT 1 FROM empleados WHERE empleado_id = @empleado_id)
      THROW 57003, 'empleado_id no existe.', 1;

    IF EXISTS (SELECT 1 FROM empleados WHERE cuenta = @cuenta AND empleado_id <> @empleado_id)
      THROW 57004, 'La cuenta ya está en uso por otro empleado.', 1;

    IF EXISTS (SELECT 1 FROM empleados WHERE email = @email AND empleado_id <> @empleado_id)
      THROW 57005, 'El email ya está en uso por otro empleado.', 1;

    UPDATE empleados
    SET cuenta = @cuenta,
        email  = @email,
        puesto = @puesto
    WHERE empleado_id = @empleado_id;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'empleados_update', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- DELETE físico
CREATE OR ALTER PROCEDURE empleados_delete
  @empleado_id INT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    IF NOT EXISTS (SELECT 1 FROM empleados WHERE empleado_id = @empleado_id)
      THROW 57006, 'empleado_id no existe.', 1;

    DELETE FROM empleados WHERE empleado_id = @empleado_id;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'empleados_delete', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- SOFT DELETE (estado = 0)
CREATE OR ALTER PROCEDURE empleados_soft_delete
  @empleado_id INT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    IF NOT EXISTS (SELECT 1 FROM empleados WHERE empleado_id = @empleado_id)
      THROW 57007, 'empleado_id no existe.', 1;

    IF (SELECT estado FROM empleados WHERE empleado_id = @empleado_id) = 0
      THROW 57008, 'El empleado ya está desactivado.', 1;

    UPDATE empleados SET estado = 0 WHERE empleado_id = @empleado_id;

    COMMIT;

    SELECT empleado_id, estado FROM empleados WHERE empleado_id = @empleado_id;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'empleados_soft_delete', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- REACTIVAR (estado = 1)
CREATE OR ALTER PROCEDURE empleados_reactivar
  @empleado_id INT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    IF NOT EXISTS (SELECT 1 FROM empleados WHERE empleado_id = @empleado_id)
      THROW 57009, 'empleado_id no existe.', 1;

    IF (SELECT estado FROM empleados WHERE empleado_id = @empleado_id) = 1
      THROW 57010, 'El empleado ya está activo.', 1;

    UPDATE empleados SET estado = 1 WHERE empleado_id = @empleado_id;

    COMMIT;

    SELECT empleado_id, estado FROM empleados WHERE empleado_id = @empleado_id;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'empleados_reactivar', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- Registrar último login
CREATE OR ALTER PROCEDURE empleados_registrar_login
  @empleado_id INT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    UPDATE empleados SET ultimo_login = GETDATE() WHERE empleado_id = @empleado_id;
  END TRY
  BEGIN CATCH
    INSERT INTO logs (origen, mensaje) VALUES (N'empleados_registrar_login', ERROR_MESSAGE());
    -- sin THROW, para no romper flujos no críticos
  END CATCH
END;
GO

-- Obtener empleado por ID (datos visibles; no devuelve contraseña)
CREATE OR ALTER PROCEDURE empleados_por_id
  @empleado_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    empleado_id,
    cuenta,
    email,
    puesto,
    fecha_registro,
    ultimo_login,
    estado,
    CASE estado WHEN 1 THEN N'Activo' ELSE N'Inactivo' END AS estado_descripcion
  FROM empleados
  WHERE empleado_id = @empleado_id;
END;
GO

-- Buscar empleados (solo IDs, no contraseñas)
CREATE OR ALTER PROCEDURE buscar_empleado
  @termino_busqueda NVARCHAR(150),
  @solo_activos BIT = 1
AS
BEGIN
  SET NOCOUNT ON;
  SELECT empleado_id
  FROM empleados
  WHERE (cuenta LIKE '%' + @termino_busqueda + '%' OR email LIKE '%' + @termino_busqueda + '%')
    AND (@solo_activos = 0 OR estado = 1)
  ORDER BY cuenta;
END;
GO

-- Obtener contraseña (hash) para autenticación interna
CREATE OR ALTER PROCEDURE empleados_contrasena
  @empleado_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT contrasena
  FROM empleados
  WHERE empleado_id = @empleado_id AND estado = 1;
END;
GO

/* ========================
   ÍNDICES
   ======================== */

-- Lecturas frecuentes
CREATE NONCLUSTERED INDEX IX_empleados_estado_cuenta ON empleados (estado, cuenta);
CREATE NONCLUSTERED INDEX IX_empleados_estado_email  ON empleados (estado, email);
CREATE NONCLUSTERED INDEX IX_empleados_ultimo_login  ON empleados (ultimo_login);
CREATE NONCLUSTERED INDEX IX_empleados_fecha_reg     ON empleados (fecha_registro);
GO

-- Logs globales (para consultas por origen / cronología)
CREATE NONCLUSTERED INDEX IX_logs_origen_fecha ON logs (origen, fecha);
CREATE NONCLUSTERED INDEX IX_logs_fecha        ON logs (fecha);
GO

-- Logs de empleados: auditoría por empleado y lo más reciente
CREATE NONCLUSTERED INDEX IX_emp_ins_emp_fecha ON empleados_ins_log (empleado_id, fecha_log);
CREATE NONCLUSTERED INDEX IX_emp_del_emp_fecha ON empleados_del_log (empleado_id, fecha_log);
CREATE NONCLUSTERED INDEX IX_emp_upd_emp_fecha ON empleados_upd_log (empleado_id, fecha_log);
GO

/* ==============================================================
   Productos
   ============================================================== */

/* ========================
   Secuencia para producto_id numérico
   ======================== */
DROP SEQUENCE IF EXISTS seq_productos;
GO
CREATE SEQUENCE seq_productos
    AS INT
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    CYCLE;
GO

/* ========================
   Tabla principal
   ======================== */
DROP TABLE IF EXISTS productos;
GO
CREATE TABLE productos (
    producto_id      NVARCHAR(20)  PRIMARY KEY, --Recibe prefijo prd-
    nombre_producto  NVARCHAR(50)  NOT NULL,
    descripcion      NVARCHAR(150) NULL,
    precio_unitario  DECIMAL(10,2) NOT NULL,
    stock            INT           NOT NULL DEFAULT 0,
    categoria_id     INT           NOT NULL,
    fecha_creacion   DATETIME      NOT NULL DEFAULT GETDATE(),
    estado_producto  NVARCHAR(20)  NOT NULL DEFAULT N'activo',
    CONSTRAINT fk_productos_categoria
        FOREIGN KEY (categoria_id) REFERENCES categorias(categoria_id)
);
GO

/* ========================
   Tablas de LOG (auditoría)
   ======================== */

DROP TABLE IF EXISTS productos_insert_log;
GO
CREATE TABLE productos_insert_log (
    log_id           INT IDENTITY(1,1) PRIMARY KEY,
    producto_id      NVARCHAR(20),
    nombre_producto  NVARCHAR(50),
    descripcion      NVARCHAR(150),
    precio_unitario  DECIMAL(10,2),
    stock            INT,
    categoria_id     INT,
    fecha_creacion   DATETIME,
    estado_producto  NVARCHAR(20),
    fecha_log        DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS productos_delete_log;
GO
CREATE TABLE productos_delete_log (
    log_id           INT IDENTITY(1,1) PRIMARY KEY,
    producto_id      NVARCHAR(20),
    nombre_producto  NVARCHAR(50),
    descripcion      NVARCHAR(150),
    precio_unitario  DECIMAL(10,2),
    stock            INT,
    categoria_id     INT,
    fecha_creacion   DATETIME,
    estado_producto  NVARCHAR(20),
    fecha_log        DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS productos_update_log;
GO
CREATE TABLE productos_update_log (
    log_id                 INT IDENTITY(1,1) PRIMARY KEY,
    producto_id            NVARCHAR(20),
    -- valores anteriores
    nombre_producto_ant    NVARCHAR(50),
    descripcion_ant        NVARCHAR(150),
    precio_unitario_ant    DECIMAL(10,2),
    stock_ant              INT,
    categoria_id_ant       INT,
    estado_producto_ant    NVARCHAR(20),
    -- valores nuevos
    nombre_producto_nvo    NVARCHAR(50),
    descripcion_nvo        NVARCHAR(150),
    precio_unitario_nvo    DECIMAL(10,2),
    stock_nvo              INT,
    categoria_id_nvo       INT,
    estado_producto_nvo    NVARCHAR(20),
    fecha_log              DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

/* ========================
   TRIGGERS
   ======================== */

-- INSERT
CREATE OR ALTER TRIGGER trg_insert_productos
ON productos
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO productos_insert_log (
        producto_id, nombre_producto, descripcion, precio_unitario, stock,
        categoria_id, fecha_creacion, estado_producto
    )
    SELECT
        i.producto_id, i.nombre_producto, i.descripcion, i.precio_unitario, i.stock,
        i.categoria_id, i.fecha_creacion, i.estado_producto
    FROM inserted AS i;
END;
GO

-- DELETE
CREATE OR ALTER TRIGGER trg_delete_productos
ON productos
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO productos_delete_log (
        producto_id, nombre_producto, descripcion, precio_unitario, stock,
        categoria_id, fecha_creacion, estado_producto
    )
    SELECT
        d.producto_id, d.nombre_producto, d.descripcion, d.precio_unitario, d.stock,
        d.categoria_id, d.fecha_creacion, d.estado_producto
    FROM deleted AS d;
END;
GO

-- UPDATE (registrar cualquier cambio)
CREATE OR ALTER TRIGGER trg_update_productos
ON productos
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO productos_update_log (
        producto_id,
        nombre_producto_ant, descripcion_ant, precio_unitario_ant, stock_ant,
        categoria_id_ant, estado_producto_ant,
        nombre_producto_nvo, descripcion_nvo, precio_unitario_nvo, stock_nvo,
        categoria_id_nvo, estado_producto_nvo
    )
    SELECT
        d.producto_id,
        d.nombre_producto, d.descripcion, d.precio_unitario, d.stock,
        d.categoria_id, d.estado_producto,
        i.nombre_producto, i.descripcion, i.precio_unitario, i.stock,
        i.categoria_id, i.estado_producto
    FROM deleted AS d
    JOIN inserted AS i
      ON d.producto_id = i.producto_id;
END;
GO

/* ========================
   PROCEDIMIENTOS
   ======================== */

-- INSERT (concatena 'prd-' + secuencia)
CREATE OR ALTER PROCEDURE productos_insert
    @nombre_producto  NVARCHAR(50),
    @descripcion      NVARCHAR(150) = NULL, --Opcional
    @precio_unitario  DECIMAL(10,2),
    @stock            INT,
    @categoria_id     INT,
    @estado_producto  NVARCHAR(20) = N'activo'
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM categorias WHERE categoria_id = @categoria_id)
            THROW 52001, 'La categoría no existe.', 1;

        DECLARE @nuevo_id NVARCHAR(20) = CONCAT('prd-', NEXT VALUE FOR seq_productos);

        INSERT INTO productos (
            producto_id, nombre_producto, descripcion, precio_unitario, stock,
            categoria_id, estado_producto
        )
        VALUES (
            @nuevo_id, @nombre_producto, @descripcion, @precio_unitario, @stock,
            @categoria_id, @estado_producto
        );

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (origen, mensaje)
        VALUES (N'productos_insert', ERROR_MESSAGE());
        THROW;
    END CATCH
END;
GO

-- UPDATE
CREATE OR ALTER PROCEDURE productos_update
    @producto_id      NVARCHAR(20),
    @nombre_producto  NVARCHAR(50),
    @descripcion      NVARCHAR(150) = NULL,
    @precio_unitario  DECIMAL(10,2),
    @stock            INT,
    @categoria_id     INT,
    @estado_producto  NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM productos WHERE producto_id = @producto_id)
            THROW 52002, 'El producto no existe.', 1;

        IF NOT EXISTS (SELECT 1 FROM categorias WHERE categoria_id = @categoria_id)
            THROW 52003, 'La categoría no existe.', 1;

        UPDATE productos
        SET nombre_producto = @nombre_producto,
            descripcion     = @descripcion,
            precio_unitario = @precio_unitario,
            stock           = @stock,
            categoria_id    = @categoria_id,
            estado_producto = @estado_producto
        WHERE producto_id = @producto_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (origen, mensaje)
        VALUES (N'productos_update', ERROR_MESSAGE());
        THROW;
    END CATCH
END;
GO

-- DELETE
CREATE OR ALTER PROCEDURE productos_delete
    @producto_id NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM productos WHERE producto_id = @producto_id)
            THROW 52004, 'El producto no existe.', 1;

        DELETE FROM productos
        WHERE producto_id = @producto_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (origen, mensaje)
        VALUES (N'productos_delete', ERROR_MESSAGE());
        THROW;
    END CATCH
END;
GO

-- GET ALL (Devuelve todos los campos)
CREATE OR ALTER PROCEDURE productos_get_all
AS
BEGIN
    SET NOCOUNT ON;
    SELECT producto_id, nombre_producto, descripcion, precio_unitario,
           stock, categoria_id, fecha_creacion, estado_producto
    FROM productos
    ORDER BY nombre_producto;
END;
GO

-- GET LIST (Devuelve solo id y nombre)
CREATE OR ALTER PROCEDURE productos_get_list
AS
BEGIN
    SET NOCOUNT ON;
    SELECT producto_id, nombre_producto
    FROM productos
    ORDER BY nombre_producto;
END;
GO

/* =========================
   PRODUCTOS: GET por id 
   ========================= */

-- A) Recibe NVARCHAR (acepta 'prd-123' o '123')
CREATE OR ALTER PROCEDURE productos_get_by_id
  @id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @pid NVARCHAR(20) =
      CASE WHEN LEFT(@id,4) = 'prd-' THEN @id ELSE CONCAT('prd-', @id) END;

  SELECT producto_id, nombre_producto, descripcion, precio_unitario,
         stock, categoria_id, fecha_creacion, estado_producto
  FROM productos
  WHERE producto_id = @pid;
END;
GO

-- B) Recibe INT y concatena 'prd-' + @id
CREATE OR ALTER PROCEDURE productos_get_by_id_int
  @id INT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @pid NVARCHAR(20) = CONCAT('prd-', @id);

  SELECT producto_id, nombre_producto, descripcion, precio_unitario,
         stock, categoria_id, fecha_creacion, estado_producto
  FROM productos
  WHERE producto_id = @pid;
END;
GO

/* =========================
   PRODUCTOS: GET por nombre y por categoría
   ========================= */

-- Nombre exacto
CREATE OR ALTER PROCEDURE productos_get_by_name
  @nombre NVARCHAR(50)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT producto_id, nombre_producto, descripcion, precio_unitario,
         stock, categoria_id, fecha_creacion, estado_producto
  FROM productos
  WHERE nombre_producto = @nombre
  ORDER BY nombre_producto;
END;
GO

-- Por categoría (ordenado por nombre)
CREATE OR ALTER PROCEDURE productos_get_by_categoria
  @categoria_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT producto_id, nombre_producto, descripcion, precio_unitario,
         stock, categoria_id, fecha_creacion, estado_producto
  FROM productos
  WHERE categoria_id = @categoria_id
  ORDER BY nombre_producto;
END;
GO

/* ==============================================================
   PRODUCTOS:  (estado -> 'inactivo')
   ============================================================== */

CREATE OR ALTER PROCEDURE productos_soft_delete
  @id NVARCHAR(20)   -- admite 'prd-123' o '123'
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    BEGIN TRANSACTION;

    -- Normaliza el ID al formato 'prd-<n>'
    DECLARE @pid NVARCHAR(20) =
      CASE WHEN LEFT(@id, 4) = 'prd-' THEN @id ELSE CONCAT('prd-', @id) END;

    -- Validación de existencia
    IF NOT EXISTS (SELECT 1 FROM productos WHERE producto_id = @pid)
      THROW 52005, 'El producto no existe.', 1;

    -- Soft delete 
    UPDATE productos
    SET estado_producto = N'inactivo'
    WHERE producto_id = @pid;

    COMMIT TRANSACTION;

  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    INSERT INTO logs (origen, mensaje)
    VALUES (N'productos_soft_delete', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

/* ==============================================================
   PRODUCTOS: Restore (estado -> 'activo')
   ============================================================== */

CREATE OR ALTER PROCEDURE productos_restore
  @id NVARCHAR(20)   -- admite 'prd-123' o '123'
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    BEGIN TRANSACTION;

    -- Normaliza el ID al formato 'prd-<n>'
    DECLARE @pid NVARCHAR(20) =
      CASE WHEN LEFT(@id, 4) = 'prd-' THEN @id ELSE CONCAT('prd-', @id) END;

    -- Validación de existencia
    IF NOT EXISTS (SELECT 1 FROM productos WHERE producto_id = @pid)
      THROW 52006, 'El producto no existe.', 1;

    -- Restore
    UPDATE productos
    SET estado_producto = N'activo'
    WHERE producto_id = @pid;

    COMMIT TRANSACTION;

  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    INSERT INTO logs (origen, mensaje)
    VALUES (N'productos_restore', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

/* ================================
   1) PRODUCTOS INACTIVOS
   ================================ */
DROP TABLE IF EXISTS productos_inactivos;
GO
CREATE TABLE productos_inactivos (
  producto_id      NVARCHAR(20)  NOT NULL PRIMARY KEY,   -- mismo id que productos
  nombre_producto  NVARCHAR(255) NOT NULL,
  categoria_id     INT           NOT NULL,
  precio_unitario  DECIMAL(10,2) NULL,
  fecha_inactivacion DATETIME2   NOT NULL DEFAULT SYSUTCDATETIME(),
  estado_anterior  NVARCHAR(20)  NOT NULL,               -- p. ej. 'activo'
  observaciones    NVARCHAR(255) NULL
);
GO

/* =============================================================
   TRIGGER: sincroniza productos_inactivos con cambios de estado
   - INSERTA cuando cambia a 'inactivo'
   - ELIMINA si sale de 'inactivo'
   ============================================================= */

DROP TRIGGER IF EXISTS trg_productos_inactivos_sync;
GO
CREATE TRIGGER trg_productos_inactivos_sync
ON productos
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;

  -- 1) Pasan a INACTIVO -> insertar/actualizar snapshot
  ;WITH t AS (
    SELECT i.producto_id, i.nombre_producto, i.categoria_id, i.precio_unitario,
           i.estado_producto AS estado_nuevo, d.estado_producto AS estado_viejo
    FROM inserted i
    JOIN deleted  d ON d.producto_id = i.producto_id
    WHERE (d.estado_producto <> N'inactivo' OR d.estado_producto IS NULL)
      AND  i.estado_producto  = N'inactivo'
  )
  MERGE productos_inactivos AS dst
  USING t AS src
  ON (dst.producto_id = src.producto_id)
  WHEN MATCHED THEN
    UPDATE SET nombre_producto   = src.nombre_producto,
               categoria_id      = src.categoria_id,
               precio_unitario   = src.precio_unitario,
               fecha_inactivacion= SYSUTCDATETIME(),
               estado_anterior   = src.estado_viejo
  WHEN NOT MATCHED THEN
    INSERT (producto_id, nombre_producto, categoria_id, precio_unitario, fecha_inactivacion, estado_anterior)
    VALUES (src.producto_id, src.nombre_producto, src.categoria_id, src.precio_unitario, SYSUTCDATETIME(), src.estado_viejo);

  -- 2) Salen de INACTIVO -> eliminar de snapshot
  DELETE pi
  FROM productos_inactivos pi
  JOIN inserted i ON i.producto_id = pi.producto_id
  JOIN deleted  d ON d.producto_id = i.producto_id
  WHERE d.estado_producto = N'inactivo'
    AND (i.estado_producto <> N'inactivo' OR i.estado_producto IS NULL);
END
GO



/* ========================
   ÍNDICES
   ======================== */

-- 1) Cobertura de lecturas y ORDER BY por nombre (get_all / get_list)
CREATE NONCLUSTERED INDEX IX_productos_nombre_cover_all
ON productos (nombre_producto)
INCLUDE (producto_id, precio_unitario, stock, categoria_id, estado_producto, descripcion);
GO


-- 2) Búsqueda por categoría + orden por nombre (get_by_categoria)
CREATE NONCLUSTERED INDEX IX_productos_categoria_nombre_cover
ON productos (categoria_id, nombre_producto)
INCLUDE (producto_id, precio_unitario, stock, estado_producto, descripcion);
GO

-- 3) Logs INSERT: buscar por producto y traer lo más reciente
CREATE NONCLUSTERED INDEX IX_prod_insert_producto_fecha
ON productos_insert_log (producto_id, fecha_log)
INCLUDE (nombre_producto, descripcion, precio_unitario, stock, categoria_id);
GO

-- 4) Logs DELETE: buscar por producto y traer lo más reciente
CREATE NONCLUSTERED INDEX IX_prod_delete_producto_fecha
ON productos_delete_log (producto_id, fecha_log)
INCLUDE (nombre_producto, descripcion, precio_unitario, stock, categoria_id);
GO

-- 5) Logs UPDATE: buscar por producto y traer lo más reciente
CREATE NONCLUSTERED INDEX IX_prod_update_producto_fecha
ON productos_update_log (producto_id, fecha_log)
INCLUDE (
  nombre_producto_ant, descripcion_ant, precio_unitario_ant, stock_ant, categoria_id_ant,
  nombre_producto_nvo, descripcion_nvo, precio_unitario_nvo, stock_nvo, categoria_id_nvo
);
GO

/* ==============================================================
   PEDIDOS y DETALLE_PEDIDOS – triggers y procedimientos
   ============================================================== */

/* ========================
   SECUENCIA PARA PEDIDOS
   ======================== */
DROP SEQUENCE IF EXISTS seq_pedidos;
GO
CREATE SEQUENCE seq_pedidos
    AS INT
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    CYCLE;
GO

/* ========================
   TABLA: PEDIDOS
   ======================== */
DROP TABLE IF EXISTS pedidos;
GO
CREATE TABLE pedidos (
    pedido_id      NVARCHAR(10)  PRIMARY KEY, --Prefijo ped-1
    cliente_id     NVARCHAR(20)  NOT NULL,
    fecha_pedido   DATETIME      NOT NULL DEFAULT GETDATE(),
    estado_pedido  NVARCHAR(20)  NOT NULL DEFAULT N'Por confirmar',
    total_pedido   DECIMAL(10,2) NOT NULL DEFAULT 0,

    metodo_pago    NVARCHAR(20)  NULL,
    CONSTRAINT fk_pedidos_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(cliente_id)
);
GO

/* ========================
   TABLA: DETALLE_PEDIDOS
   ======================== */
DROP TABLE IF EXISTS detalle_pedidos;
GO
CREATE TABLE detalle_pedidos (
    detalle_id       INT IDENTITY(1,1) PRIMARY KEY,
    pedido_id        NVARCHAR(10)  NOT NULL,
    producto_id      NVARCHAR(20)  NOT NULL,
    cantidad         INT           NOT NULL,
    precio_unitario  DECIMAL(10,2) NOT NULL,
    subtotal         AS (cantidad * precio_unitario) PERSISTED,
    CONSTRAINT fk_detalle_pedido
        FOREIGN KEY (pedido_id) REFERENCES pedidos(pedido_id),
    CONSTRAINT fk_detalle_producto
        FOREIGN KEY (producto_id) REFERENCES productos(producto_id),
    CONSTRAINT ck_detalle_cantidad_pos
        CHECK (cantidad > 0),
    CONSTRAINT ck_detalle_precio_pos
        CHECK (precio_unitario >= 0)
);
GO

/* ========================
   Tablas de LOG (auditoría)
   ======================== */
DROP TABLE IF EXISTS pedidos_insert_log;
GO
CREATE TABLE pedidos_insert_log (
    log_id         INT IDENTITY(1,1) PRIMARY KEY,
    pedido_id      NVARCHAR(10),
    cliente_id     NVARCHAR(20),
    fecha_pedido   DATETIME,
    estado_pedido  NVARCHAR(20),
    total_pedido   DECIMAL(10,2),
    metodo_pago    NVARCHAR(20),
    fecha_log      DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS pedidos_delete_log;
GO
CREATE TABLE pedidos_delete_log (
    log_id         INT IDENTITY(1,1) PRIMARY KEY,
    pedido_id      NVARCHAR(10),
    cliente_id     NVARCHAR(20),
    fecha_pedido   DATETIME,
    estado_pedido  NVARCHAR(20),
    total_pedido   DECIMAL(10,2),
    metodo_pago    NVARCHAR(20),
    fecha_log      DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS pedidos_update_log;
GO
CREATE TABLE pedidos_update_log (
    log_id              INT IDENTITY(1,1) PRIMARY KEY,
    pedido_id           NVARCHAR(10),
    -- valores anteriores
    cliente_id_ant      NVARCHAR(20),
    fecha_pedido_ant    DATETIME,
    estado_pedido_ant   NVARCHAR(20),
    total_pedido_ant    DECIMAL(10,2),
    metodo_pago_ant     NVARCHAR(20),
    -- valores nuevos
    cliente_id_nvo      NVARCHAR(20),
    fecha_pedido_nvo    DATETIME,
    estado_pedido_nvo   NVARCHAR(20),
    total_pedido_nvo    DECIMAL(10,2),
    metodo_pago_nvo     NVARCHAR(20),
    fecha_log           DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS detalle_pedidos_insert_log;
GO
CREATE TABLE detalle_pedidos_insert_log (
    log_id          INT IDENTITY(1,1) PRIMARY KEY,
    detalle_id      INT,
    pedido_id       NVARCHAR(10),
    producto_id     NVARCHAR(20),
    cantidad        INT,
    precio_unitario DECIMAL(10,2),
    fecha_log       DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS detalle_pedidos_delete_log;
GO
CREATE TABLE detalle_pedidos_delete_log (
    log_id          INT IDENTITY(1,1) PRIMARY KEY,
    detalle_id      INT,
    pedido_id       NVARCHAR(10),
    producto_id     NVARCHAR(20),
    cantidad        INT,
    precio_unitario DECIMAL(10,2),
    fecha_log       DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS detalle_pedidos_update_log;
GO
CREATE TABLE detalle_pedidos_update_log (
    log_id              INT IDENTITY(1,1) PRIMARY KEY,
    detalle_id          INT,
    pedido_id           NVARCHAR(10),
    producto_id         NVARCHAR(20),
    cantidad_ant        INT,
    precio_unitario_ant DECIMAL(10,2),
    cantidad_nvo        INT,
    precio_unitario_nvo DECIMAL(10,2),
    fecha_log           DATETIME      NOT NULL DEFAULT GETDATE(),
    usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

/* ========================
   TRIGGERS PEDIDOS (registran cualquier cambio)
   ======================== */
CREATE OR ALTER TRIGGER trg_insert_pedidos
ON pedidos
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO pedidos_insert_log (pedido_id, cliente_id, fecha_pedido, estado_pedido, total_pedido, metodo_pago)
    SELECT i.pedido_id, i.cliente_id, i.fecha_pedido, i.estado_pedido, i.total_pedido, i.metodo_pago
    FROM inserted AS i;
END;
GO

CREATE OR ALTER TRIGGER trg_delete_pedidos
ON pedidos
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO pedidos_delete_log (pedido_id, cliente_id, fecha_pedido, estado_pedido, total_pedido, metodo_pago)
    SELECT d.pedido_id, d.cliente_id, d.fecha_pedido, d.estado_pedido, d.total_pedido, d.metodo_pago
    FROM deleted AS d;
END;
GO

-- UPDATE: registra cualquier columna cambiada
CREATE OR ALTER TRIGGER trg_update_pedidos
ON pedidos
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO pedidos_update_log (
        pedido_id,
        cliente_id_ant, fecha_pedido_ant, estado_pedido_ant, total_pedido_ant, metodo_pago_ant,
        cliente_id_nvo, fecha_pedido_nvo, estado_pedido_nvo, total_pedido_nvo, metodo_pago_nvo
    )
    SELECT
        d.pedido_id,
        d.cliente_id, d.fecha_pedido, d.estado_pedido, d.total_pedido, d.metodo_pago,
        i.cliente_id, i.fecha_pedido, i.estado_pedido, i.total_pedido, i.metodo_pago
    FROM deleted AS d
    JOIN inserted AS i ON i.pedido_id = d.pedido_id;
END;
GO

/* ========================
   TRIGGERS DETALLE_PEDIDOS (registran cualquier cambio)
   ======================== */
CREATE OR ALTER TRIGGER trg_insert_detalle_pedidos
ON detalle_pedidos
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO detalle_pedidos_insert_log (detalle_id, pedido_id, producto_id, cantidad, precio_unitario)
    SELECT i.detalle_id, i.pedido_id, i.producto_id, i.cantidad, i.precio_unitario
    FROM inserted AS i;

    ;WITH afectado AS (
        SELECT DISTINCT pedido_id FROM inserted
    )
    UPDATE p
    SET total_pedido = x.suma
    FROM pedidos p
    JOIN (
        SELECT d.pedido_id, SUM(d.cantidad * d.precio_unitario) AS suma
        FROM detalle_pedidos d
        JOIN afectado a ON a.pedido_id = d.pedido_id
        GROUP BY d.pedido_id
    ) x ON x.pedido_id = p.pedido_id;
END;
GO

CREATE OR ALTER TRIGGER trg_delete_detalle_pedidos
ON detalle_pedidos
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO detalle_pedidos_delete_log (detalle_id, pedido_id, producto_id, cantidad, precio_unitario)
    SELECT d.detalle_id, d.pedido_id, d.producto_id, d.cantidad, d.precio_unitario
    FROM deleted AS d;

    ;WITH afectado AS (
        SELECT DISTINCT pedido_id FROM deleted
    )
    UPDATE p
    SET total_pedido = ISNULL(x.suma,0)
    FROM pedidos p
    LEFT JOIN (
        SELECT d.pedido_id, SUM(d.cantidad * d.precio_unitario) AS suma
        FROM detalle_pedidos d
        JOIN afectado a ON a.pedido_id = d.pedido_id
        GROUP BY d.pedido_id
    ) x ON x.pedido_id = p.pedido_id
    WHERE p.pedido_id IN (SELECT pedido_id FROM afectado);
END;
GO

CREATE OR ALTER TRIGGER trg_update_detalle_pedidos
ON detalle_pedidos
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO detalle_pedidos_update_log (
        detalle_id, pedido_id, producto_id,
        cantidad_ant, precio_unitario_ant,
        cantidad_nvo, precio_unitario_nvo
    )
    SELECT
        d.detalle_id, d.pedido_id, d.producto_id,
        d.cantidad, d.precio_unitario,
        i.cantidad, i.precio_unitario
    FROM deleted AS d
    JOIN inserted AS i ON i.detalle_id = d.detalle_id;

    ;WITH afectado AS (
        SELECT DISTINCT pedido_id FROM inserted
        UNION
        SELECT DISTINCT pedido_id FROM deleted
    )
    UPDATE p
    SET total_pedido = x.suma
    FROM pedidos p
    JOIN (
        SELECT d.pedido_id, SUM(d.cantidad * d.precio_unitario) AS suma
        FROM detalle_pedidos d
        JOIN afectado a ON a.pedido_id = d.pedido_id
        GROUP BY d.pedido_id
    ) x ON x.pedido_id = p.pedido_id;
END;
GO

/* ========================
   PROCEDIMIENTOS – INSERT y cambios de estado
   ======================== */

-- Crear pedido (concatena 'ped-' + secuencia)
CREATE OR ALTER PROCEDURE pedidos_insert
    @cliente_id  NVARCHAR(20),
    @metodo_pago NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cliente_id)
            THROW 53001, 'El cliente no existe.', 1;

        DECLARE @nuevo_id NVARCHAR(10) = CONCAT('ped-', NEXT VALUE FOR seq_pedidos);

        INSERT INTO pedidos (pedido_id, cliente_id, metodo_pago)
        VALUES (@nuevo_id, @cliente_id, @metodo_pago);

        COMMIT;
        SELECT @nuevo_id AS pedido_id;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        INSERT INTO logs(origen, mensaje)
        VALUES (N'pedidos_insert', ERROR_MESSAGE());
        THROW;
    END CATCH
END;
GO

-- Confirmar pedido por id (revalida stock y descuenta existencias)
CREATE OR ALTER PROCEDURE pedidos_confirmar
  @id NVARCHAR(20)  -- admite 'ped-123' o '123'
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  BEGIN TRY
    BEGIN TRAN;

    DECLARE @pid NVARCHAR(20) =
      CASE WHEN LEFT(@id,4)='ped-' THEN @id ELSE CONCAT('ped-',@id) END;

    -- 1) Validaciones básicas
    IF NOT EXISTS (SELECT 1 FROM pedidos WHERE pedido_id = @pid)
      THROW 53002, 'El pedido no existe.', 1;

    DECLARE @estado NVARCHAR(20);
    SELECT @estado = estado_pedido FROM pedidos WHERE pedido_id = @pid;

    IF @estado <> N'Por confirmar'
      THROW 53008, 'Solo se pueden confirmar pedidos en estado ''Por confirmar''.', 1;

    IF NOT EXISTS (SELECT 1 FROM detalle_pedidos WHERE pedido_id = @pid)
      THROW 53003, 'No se puede confirmar un pedido sin artículos.', 1;

    IF (SELECT total_pedido FROM pedidos WHERE pedido_id = @pid) <= 0
      THROW 53004, 'El total debe ser > 0 para confirmar.', 1;

    -- 2) Recolecta cantidades requeridas por producto (bloqueo para consistencia)
    DECLARE @req TABLE (
      producto_id NVARCHAR(20) PRIMARY KEY,
      requerido   INT NOT NULL
    );

    INSERT INTO @req (producto_id, requerido)
    SELECT dp.producto_id, SUM(dp.cantidad) AS requerido
    FROM detalle_pedidos dp WITH (HOLDLOCK)
    WHERE dp.pedido_id = @pid
    GROUP BY dp.producto_id;

    -- 2a) Verifica productos inactivos entre agregado y confirmación
    IF EXISTS (
      SELECT 1
      FROM @req r
      JOIN productos p WITH (UPDLOCK, HOLDLOCK)
        ON p.producto_id = r.producto_id
      WHERE p.estado_producto = N'inactivo'
    )
      THROW 53009, 'Hay productos inactivos en el pedido.', 1;

    -- 2b) Verifica stock suficiente en todos los productos (con bloqueos de actualización)
    IF EXISTS (
      SELECT 1
      FROM @req r
      JOIN productos p WITH (UPDLOCK, HOLDLOCK)
        ON p.producto_id = r.producto_id
      WHERE p.stock < r.requerido
    )
    BEGIN
      -- Diagnóstico detallado para el cliente/API
      SELECT r.producto_id,
             r.requerido,
             p.stock AS stock_disponible,
             (r.requerido - p.stock) AS deficit
      FROM @req r
      JOIN productos p ON p.producto_id = r.producto_id
      WHERE p.stock < r.requerido;

      THROW 53012, 'Stock insuficiente para confirmar el pedido.', 1;
    END

    -- 3) Descuenta stock (protegiendo filas con UPDLOCK/ROWLOCK)
    UPDATE p WITH (UPDLOCK, ROWLOCK)
      SET p.stock = p.stock - r.requerido
    FROM productos p
    JOIN @req r ON r.producto_id = p.producto_id;

    -- 4) Confirma el pedido
    UPDATE pedidos
      SET estado_pedido = N'Confirmado'
    WHERE pedido_id = @pid;

    COMMIT;

    SELECT pedido_id, estado_pedido
    FROM pedidos
    WHERE pedido_id = @pid;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs(origen, mensaje)
      VALUES (N'pedidos_confirmar', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO


-- Cancelar pedido por id (reintegra stock)
CREATE OR ALTER PROCEDURE pedidos_cancelar
  @id NVARCHAR(20)  -- admite 'ped-123' o '123'
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    DECLARE @pid NVARCHAR(20) = CASE WHEN LEFT(@id,4)='ped-' THEN @id ELSE CONCAT('ped-',@id) END;

    IF NOT EXISTS (SELECT 1 FROM pedidos WHERE pedido_id = @pid)
      THROW 53005, 'El pedido no existe.', 1;

    -- Reintegrar stock de todas las líneas del pedido
    ;WITH lineas AS (
      SELECT producto_id, SUM(cantidad) AS cant
      FROM detalle_pedidos WITH (HOLDLOCK)
      WHERE pedido_id = @pid
      GROUP BY producto_id
    )
    UPDATE p WITH (UPDLOCK, ROWLOCK)
    SET p.stock = p.stock + l.cant
    FROM productos p
    JOIN lineas l ON l.producto_id = p.producto_id;

    UPDATE pedidos
    SET estado_pedido = N'Cancelado'
    WHERE pedido_id = @pid;

    COMMIT;

    SELECT pedido_id, estado_pedido FROM pedidos WHERE pedido_id = @pid;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs(origen, mensaje)
    VALUES (N'pedidos_cancelar', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

/* ========================
   PROCEDIMIENTOS – GETs
   ======================== */

-- 1) Obtener todos (ORDER BY cliente_id, fecha_pedido DESC)
CREATE OR ALTER PROCEDURE pedidos_get_all
AS
BEGIN
  SET NOCOUNT ON;
  SELECT pedido_id, cliente_id, fecha_pedido, estado_pedido, total_pedido, metodo_pago
  FROM pedidos
  ORDER BY cliente_id, fecha_pedido DESC;
END;
GO

-- 2) Get by client id (ORDER BY fecha DESC)
CREATE OR ALTER PROCEDURE pedidos_get_by_cliente_id
  @cliente_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT pedido_id, cliente_id, fecha_pedido, estado_pedido, total_pedido, metodo_pago
  FROM pedidos
  WHERE cliente_id = @cliente_id
  ORDER BY fecha_pedido DESC;
END;
GO

-- 3) Get by pedido id (acepta 'ped-123' o '123')
CREATE OR ALTER PROCEDURE pedidos_get_by_id
  @id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @pid NVARCHAR(20) = CASE WHEN LEFT(@id,4)='ped-' THEN @id ELSE CONCAT('ped-',@id) END;

  SELECT pedido_id, cliente_id, fecha_pedido, estado_pedido, total_pedido, metodo_pago
  FROM pedidos
  WHERE pedido_id = @pid;
END;
GO

-- 4) Get by estado (ej: 'Por confirmar','Cancelado','Confirmado', etc.)
CREATE OR ALTER PROCEDURE pedidos_get_by_estado
  @estado NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT pedido_id, cliente_id, fecha_pedido, estado_pedido, total_pedido, metodo_pago
  FROM pedidos
  WHERE estado_pedido = @estado
  ORDER BY fecha_pedido DESC;
END;
GO

-- 5) Get por confirmar
CREATE OR ALTER PROCEDURE pedidos_get_por_confirmar
AS
BEGIN
  SET NOCOUNT ON;
  SELECT pedido_id, cliente_id, fecha_pedido, estado_pedido, total_pedido, metodo_pago
  FROM pedidos
  WHERE estado_pedido = N'Por confirmar'
  ORDER BY fecha_pedido DESC;
END;
GO

/* ========================
   PROCEDIMIENTOS – Joins pedidos + detalle
   ======================== */

-- A) By pedido_id y cliente_id
CREATE OR ALTER PROCEDURE pedidos_join_detalles_by_pedido_and_cliente
  @id_pedido  NVARCHAR(20),
  @cliente_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @pid NVARCHAR(20) = CASE WHEN LEFT(@id_pedido,4)='ped-' THEN @id_pedido ELSE CONCAT('ped-',@id_pedido) END;

  SELECT
    p.pedido_id, p.cliente_id, p.fecha_pedido, p.estado_pedido, p.total_pedido, p.metodo_pago,
    d.detalle_id, d.producto_id, pr.nombre_producto, d.cantidad, d.precio_unitario, d.subtotal
  FROM pedidos p
  JOIN detalle_pedidos d ON d.pedido_id = p.pedido_id
  JOIN productos pr      ON pr.producto_id = d.producto_id
  WHERE p.pedido_id = @pid AND p.cliente_id = @cliente_id
  ORDER BY d.detalle_id;
END;
GO

-- B) By pedido_id
CREATE OR ALTER PROCEDURE pedidos_join_detalles_by_pedido
  @id_pedido NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @pid NVARCHAR(20) = CASE WHEN LEFT(@id_pedido,4)='ped-' THEN @id_pedido ELSE CONCAT('ped-',@id_pedido) END;

  SELECT
    p.pedido_id, p.cliente_id, p.fecha_pedido, p.estado_pedido, p.total_pedido, p.metodo_pago,
    d.detalle_id, d.producto_id, pr.nombre_producto, d.cantidad, d.precio_unitario, d.subtotal
  FROM pedidos p
  JOIN detalle_pedidos d ON d.pedido_id = p.pedido_id
  JOIN productos pr      ON pr.producto_id = d.producto_id
  WHERE p.pedido_id = @pid
  ORDER BY d.detalle_id;
END;
GO

-- C) By cliente_id (todas las líneas de todos sus pedidos)
CREATE OR ALTER PROCEDURE pedidos_join_detalles_by_cliente
  @cliente_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    p.pedido_id, p.cliente_id, p.fecha_pedido, p.estado_pedido, p.total_pedido, p.metodo_pago,
    d.detalle_id, d.producto_id, pr.nombre_producto, d.cantidad, d.precio_unitario, d.subtotal
  FROM pedidos p
  JOIN detalle_pedidos d ON d.pedido_id = p.pedido_id
  JOIN productos pr      ON pr.producto_id = d.producto_id
  WHERE p.cliente_id = @cliente_id
  ORDER BY p.fecha_pedido DESC, d.detalle_id;
END;
GO

/* ========================
   ÍNDICES
   ======================== */

-- 1) Pedidos: listas y ordenamientos por cliente y fecha
CREATE NONCLUSTERED INDEX IX_pedidos_cliente_fecha
ON pedidos (cliente_id, fecha_pedido)
INCLUDE (estado_pedido, total_pedido, metodo_pago);
GO

-- 2) Pedidos por estado + fecha
CREATE NONCLUSTERED INDEX IX_pedidos_estado_fecha
ON pedidos (estado_pedido, fecha_pedido)
INCLUDE (cliente_id, total_pedido, metodo_pago);
GO


-- 3) Detalle por pedido (join y recomputo de totales)
CREATE NONCLUSTERED INDEX IX_detalle_pedido
ON detalle_pedidos (pedido_id)
INCLUDE (detalle_id, producto_id, cantidad, precio_unitario);
GO

-- 4) Logs de pedidos: buscar por pedido y traer lo más reciente
CREATE NONCLUSTERED INDEX IX_ped_ins_pedido_fecha
ON pedidos_insert_log (pedido_id, fecha_log)
INCLUDE (cliente_id, estado_pedido, total_pedido, metodo_pago);
GO

CREATE NONCLUSTERED INDEX IX_ped_del_pedido_fecha
ON pedidos_delete_log (pedido_id, fecha_log)
INCLUDE (cliente_id, estado_pedido, total_pedido, metodo_pago);
GO

CREATE NONCLUSTERED INDEX IX_ped_upd_pedido_fecha
ON pedidos_update_log (pedido_id, fecha_log)
INCLUDE (
  cliente_id_ant, fecha_pedido_ant, estado_pedido_ant, total_pedido_ant, metodo_pago_ant,
  cliente_id_nvo, fecha_pedido_nvo, estado_pedido_nvo, total_pedido_nvo, metodo_pago_nvo
);
GO

-- 5) Logs de detalle: consultar por pedido y fecha
CREATE NONCLUSTERED INDEX IX_det_ins_pedido_fecha
ON detalle_pedidos_insert_log (pedido_id, fecha_log)
INCLUDE (detalle_id, producto_id, cantidad, precio_unitario);
GO

CREATE NONCLUSTERED INDEX IX_det_del_pedido_fecha
ON detalle_pedidos_delete_log (pedido_id, fecha_log)
INCLUDE (detalle_id, producto_id, cantidad, precio_unitario);
GO

CREATE NONCLUSTERED INDEX IX_det_upd_pedido_fecha
ON detalle_pedidos_update_log (pedido_id, fecha_log)
INCLUDE (detalle_id, producto_id, cantidad_ant, precio_unitario_ant, cantidad_nvo, precio_unitario_nvo);
GO

/* ===========================================================
   CONTROL DE PEDIDOS – SPs de manipulación
   Requiere tablas: pedidos, detalle_pedidos, productos
   Nota:
   - IDs con prefijo: pedido => 'ped-#', producto => 'prd-#'
   - Los triggers existentes recalculan total_pedido
   - Estados soportados: 'Por confirmar' | 'Confirmado' | 'Cancelado'
   =========================================================== */

/* ------------------------------
   Helpers de normalización de ID
   ------------------------------ */
CREATE OR ALTER FUNCTION dbo.fn_norm_pedido_id(@id NVARCHAR(50))
RETURNS NVARCHAR(20)
AS
BEGIN
  DECLARE @s NVARCHAR(50) = LTRIM(RTRIM(@id));
  IF @s LIKE N'ped-%' RETURN @s;
  RETURN CONCAT(N'ped-', @s);
END;
GO

CREATE OR ALTER FUNCTION dbo.fn_norm_producto_id(@id NVARCHAR(50))
RETURNS NVARCHAR(20)
AS
BEGIN
  DECLARE @s NVARCHAR(50) = LTRIM(RTRIM(@id));
  IF @s LIKE N'prd-%' RETURN @s;
  RETURN CONCAT(N'prd-', @s);
END;
GO

/* ===========================================================
   SP: pedido_add_item
   Agrega (o incrementa) línea de detalle
   =========================================================== */
CREATE OR ALTER PROCEDURE pedido_add_item
  @pedido_id       NVARCHAR(20),
  @producto_id     NVARCHAR(20),
  @cantidad        INT = 1,
  @precio_unitario DECIMAL(10,2) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @pid  NVARCHAR(20) = dbo.fn_norm_pedido_id(@pedido_id);
  DECLARE @prid NVARCHAR(20) = dbo.fn_norm_producto_id(@producto_id);

  IF @cantidad IS NULL OR @cantidad <= 0
    THROW 53010, 'Cantidad debe ser > 0', 1;

  IF NOT EXISTS (SELECT 1 FROM pedidos WHERE pedido_id = @pid)
    THROW 53002, 'El pedido no existe', 1;

  DECLARE @estado NVARCHAR(20);
  SELECT @estado = estado_pedido FROM pedidos WHERE pedido_id = @pid;

  IF @estado <> N'Por confirmar'
    THROW 53008, 'El pedido no es editable en su estado actual', 1;

  -- Producto vigente (no inactivo)
  IF NOT EXISTS (
    SELECT 1
    FROM productos
    WHERE producto_id = @prid
      AND (estado_producto IS NULL OR estado_producto <> N'inactivo')
  )
    THROW 53009, 'El producto no existe o está inactivo', 1;

  -- Precio por default tomado del producto si no viene especificado
  DECLARE @precio DECIMAL(10,2);
  SELECT @precio = COALESCE(@precio_unitario, precio_unitario)
  FROM productos WHERE producto_id = @prid;

  BEGIN TRAN;

    DECLARE @stock_actual INT;
    SELECT @stock_actual = p.stock
    FROM productos p WITH (UPDLOCK, HOLDLOCK)
    WHERE p.producto_id = @prid;

    DECLARE @ya_pedido INT = 0;
    SELECT @ya_pedido = ISNULL(cantidad, 0)
    FROM detalle_pedidos
    WHERE pedido_id = @pid AND producto_id = @prid;

    IF (@stock_actual IS NULL) OR (@stock_actual < (@ya_pedido + @cantidad))
      THROW 53012, 'Stock insuficiente para agregar la cantidad solicitada', 1;

    -- Inserta o incrementa la línea
    IF @ya_pedido > 0
    BEGIN
      UPDATE detalle_pedidos
         SET cantidad = cantidad + @cantidad,
             precio_unitario = @precio
       WHERE pedido_id = @pid AND producto_id = @prid;
    END
    ELSE
    BEGIN
      INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario)
      VALUES (@pid, @prid, @cantidad, @precio);
    END
  COMMIT;

  -- Devuelve el estado del detalle
  SELECT dp.pedido_id, dp.producto_id, dp.cantidad, dp.precio_unitario
  FROM detalle_pedidos dp
  WHERE dp.pedido_id = @pid
  ORDER BY dp.producto_id;
END;
GO

/* ===========================================================
   SP: pedido_remove_item
   Elimina o decrementa cantidad de una línea
   =========================================================== */
CREATE OR ALTER PROCEDURE pedido_remove_item
  @pedido_id   NVARCHAR(20),
  @producto_id NVARCHAR(20),
  @cantidad    INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @pid NVARCHAR(20) = dbo.fn_norm_pedido_id(@pedido_id);
  DECLARE @prid NVARCHAR(20) = dbo.fn_norm_producto_id(@producto_id);

  IF NOT EXISTS (SELECT 1 FROM pedidos WHERE pedido_id = @pid)
    THROW 53002, 'El pedido no existe', 1;

  DECLARE @estado NVARCHAR(20);
  SELECT @estado = estado_pedido FROM pedidos WHERE pedido_id = @pid;
  IF @estado <> N'Por confirmar'
    THROW 53008, 'El pedido no es editable en su estado actual', 1;

  IF NOT EXISTS (SELECT 1 FROM detalle_pedidos WHERE pedido_id = @pid AND producto_id = @prid)
    THROW 53011, 'El producto no está en el pedido', 1;

  BEGIN TRAN;
    IF @cantidad IS NULL
    BEGIN
      DELETE FROM detalle_pedidos WHERE pedido_id = @pid AND producto_id = @prid;
    END
    ELSE
    BEGIN
      IF @cantidad <= 0 THROW 53010, 'Cantidad debe ser > 0', 1;

      DECLARE @actual INT;
      SELECT @actual = cantidad FROM detalle_pedidos WHERE pedido_id = @pid AND producto_id = @prid;

      IF @actual <= @cantidad
        DELETE FROM detalle_pedidos WHERE pedido_id = @pid AND producto_id = @prid;
      ELSE
        UPDATE detalle_pedidos SET cantidad = cantidad - @cantidad WHERE pedido_id = @pid AND producto_id = @prid;
    END
  COMMIT;

  SELECT dp.pedido_id, dp.producto_id, dp.cantidad, dp.precio_unitario
  FROM detalle_pedidos dp
  WHERE dp.pedido_id = @pid
  ORDER BY dp.producto_id;
END;
GO

/* ===========================================================
   SP: pedidos_set_estado
   Despacha a confirmar/cancelar; restringe estados permitidos.
   =========================================================== */
CREATE OR ALTER PROCEDURE pedidos_set_estado
  @pedido_id NVARCHAR(20),
  @estado    NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @pid NVARCHAR(20) = dbo.fn_norm_pedido_id(@pedido_id);

  IF NOT EXISTS (SELECT 1 FROM pedidos WHERE pedido_id = @pid)
    THROW 53002, 'El pedido no existe', 1;

  DECLARE @actual NVARCHAR(20);
  SELECT @actual = estado_pedido FROM pedidos WHERE pedido_id = @pid;

  -- Idempotencia: ya está en el estado solicitado
  IF @estado = @actual
  BEGIN
    SELECT pedido_id, estado_pedido
    FROM pedidos
    WHERE pedido_id = @pid;
    RETURN;
  END

  IF @estado = N'Confirmado'
  BEGIN
    IF @actual = N'Cancelado'
      THROW 53007, 'No se puede confirmar un pedido cancelado.', 1;

    EXEC pedidos_confirmar @id = @pid; -- devuelve (pedido_id, estado_pedido)
    RETURN;
  END
  ELSE IF @estado = N'Cancelado'
  BEGIN
    EXEC pedidos_cancelar @id = @pid;  -- devuelve (pedido_id, estado_pedido)
    RETURN;
  END
  ELSE IF @estado = N'Por confirmar'
  BEGIN
    IF @actual = N'Cancelado'
      THROW 53007, 'No se puede reabrir un pedido cancelado.', 1;

    UPDATE pedidos
      SET estado_pedido = N'Por confirmar'
      WHERE pedido_id = @pid;

    SELECT pedido_id, estado_pedido
    FROM pedidos
    WHERE pedido_id = @pid;
    RETURN;
  END
END;
GO

/* ===========================================================
   SP: pedidos_verificar_productos
   Lista líneas con stock insuficiente (al momento de la verificación)
   =========================================================== */
CREATE OR ALTER PROCEDURE pedidos_verificar_productos
  @pedido_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @pid NVARCHAR(20) = dbo.fn_norm_pedido_id(@pedido_id);

  IF NOT EXISTS (SELECT 1 FROM pedidos WHERE pedido_id = @pid)
    THROW 53002, 'El pedido no existe', 1;

  ;WITH req AS (
    SELECT dp.producto_id, SUM(dp.cantidad) AS requerido
    FROM detalle_pedidos dp
    WHERE dp.pedido_id = @pid
    GROUP BY dp.producto_id
  )
  SELECT r.producto_id,
         r.requerido,
         p.stock AS stock_disponible,
         CASE WHEN p.stock < r.requerido THEN (r.requerido - p.stock) ELSE 0 END AS deficit
  FROM req r
  JOIN productos p ON p.producto_id = r.producto_id
  WHERE p.stock < r.requerido
  ORDER BY r.producto_id;
END;
GO

/* ==============================================
   Tabla principal datos_personales
   ============================================== */
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

/* ==============================================
   Tablas de log (sin 'usuario')
   ============================================== */
DROP TABLE IF EXISTS datos_personales_insert_log;
GO
CREATE TABLE datos_personales_insert_log (
  log_id     INT IDENTITY(1,1) PRIMARY KEY,
  datos_id   INT           NOT NULL,
  cliente_id NVARCHAR(20)  NOT NULL,
  nombre     NVARCHAR(50)  NOT NULL,
  apellidos  NVARCHAR(100) NOT NULL,
  fecha_log  DATETIME      NOT NULL DEFAULT GETDATE(),
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS datos_personales_delete_log;
GO
CREATE TABLE datos_personales_delete_log (
  log_id     INT IDENTITY(1,1) PRIMARY KEY,
  datos_id   INT           NOT NULL,
  cliente_id NVARCHAR(20)  NOT NULL,
  nombre     NVARCHAR(50)  NOT NULL,
  apellidos  NVARCHAR(100) NOT NULL,
  telefono   NVARCHAR(20)  NULL,
  fecha_log  DATETIME      NOT NULL DEFAULT GETDATE(),
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS datos_personales_update_log;
GO
CREATE TABLE datos_personales_update_log (
  log_id            INT IDENTITY(1,1) PRIMARY KEY,
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
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

/* ==============================================
   Triggers (registran cualquier cambio)
   ============================================== */
CREATE OR ALTER TRIGGER trg_insert_datos_personales
ON datos_personales
AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO datos_personales_insert_log (datos_id, cliente_id, nombre, apellidos)
  SELECT i.datos_id, i.cliente_id, i.nombre, i.apellidos
  FROM inserted i;
END;
GO

CREATE OR ALTER TRIGGER trg_delete_datos_personales
ON datos_personales
AFTER DELETE
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO datos_personales_delete_log (datos_id, cliente_id, nombre, apellidos, telefono)
  SELECT d.datos_id, d.cliente_id, d.nombre, d.apellidos, d.telefono
  FROM deleted d;
END;
GO

CREATE OR ALTER TRIGGER trg_update_datos_personales
ON datos_personales
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO datos_personales_update_log (
    datos_id, cliente_id,
    nombre_old, apellidos_old, telefono_old, direccion_old, ciudad_old, codigo_postal_old, pais_old,
    nombre_new, apellidos_new, telefono_new, direccion_new, ciudad_new, codigo_postal_new, pais_new
  )
  SELECT
    d.datos_id, d.cliente_id,
    d.nombre, d.apellidos, d.telefono, d.direccion, d.ciudad, d.codigo_postal, d.pais,
    i.nombre, i.apellidos, i.telefono, i.direccion, i.ciudad, i.codigo_postal, i.pais
  FROM deleted d
  JOIN inserted i ON i.datos_id = d.datos_id;   -- sin WHERE (cualquier cambio)
END;
GO

/* ==============================================
   Procedimientos (normalizan 'cl-' y usan logs unificados)
   ============================================== */
CREATE OR ALTER PROCEDURE datos_personales_insert
  @cliente_id    NVARCHAR(20),
  @nombre        NVARCHAR(50),
  @apellidos     NVARCHAR(100),
  @telefono      NVARCHAR(20)  = NULL,
  @direccion     NVARCHAR(200) = NULL,
  @ciudad        NVARCHAR(50)  = NULL,
  @codigo_postal NVARCHAR(10)  = NULL,
  @pais          NVARCHAR(50)  = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    DECLARE @cid NVARCHAR(20) =
      CASE WHEN LEFT(@cliente_id,3)='cl-' THEN @cliente_id ELSE CONCAT('cl-',@cliente_id) END;

    IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cid)
      THROW 59000, 'cliente_id no existe.', 1;

    IF EXISTS (SELECT 1 FROM datos_personales WHERE cliente_id = @cid)
      THROW 59001, 'Ya existe datos_personales para este cliente.', 1;

    INSERT INTO datos_personales (
      cliente_id, nombre, apellidos, telefono, direccion, ciudad, codigo_postal, pais
    )
    VALUES (@cid, @nombre, @apellidos, @telefono, @direccion, @ciudad, @codigo_postal, @pais);

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'datos_personales_insert', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

CREATE OR ALTER PROCEDURE datos_personales_update
  @cliente_id    NVARCHAR(20),
  @nombre        NVARCHAR(50),
  @apellidos     NVARCHAR(100),
  @telefono      NVARCHAR(20)  = NULL,
  @direccion     NVARCHAR(200) = NULL,
  @ciudad        NVARCHAR(50)  = NULL,
  @codigo_postal NVARCHAR(10)  = NULL,
  @pais          NVARCHAR(50)  = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    DECLARE @cid NVARCHAR(20) =
      CASE WHEN LEFT(@cliente_id,3)='cl-' THEN @cliente_id ELSE CONCAT('cl-',@cliente_id) END;

    IF NOT EXISTS (SELECT 1 FROM datos_personales WHERE cliente_id = @cid)
      THROW 59002, 'No existe datos_personales para este cliente.', 1;

    UPDATE datos_personales
    SET nombre = @nombre, apellidos = @apellidos, telefono = @telefono,
        direccion = @direccion, ciudad = @ciudad, codigo_postal = @codigo_postal, pais = @pais
    WHERE cliente_id = @cid;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'datos_personales_update', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

CREATE OR ALTER PROCEDURE datos_personales_delete
  @cliente_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    DECLARE @cid NVARCHAR(20) =
      CASE WHEN LEFT(@cliente_id,3)='cl-' THEN @cliente_id ELSE CONCAT('cl-',@cliente_id) END;

    IF NOT EXISTS (SELECT 1 FROM datos_personales WHERE cliente_id = @cid)
      THROW 59003, 'No existe datos_personales para este cliente.', 1;

    DELETE FROM datos_personales WHERE cliente_id = @cid;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'datos_personales_delete', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

CREATE OR ALTER PROCEDURE datos_personales_select_by_cliente
  @cliente_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @cid NVARCHAR(20) =
    CASE WHEN LEFT(@cliente_id,3)='cl-' THEN @cliente_id ELSE CONCAT('cl-',@cliente_id) END;

  SELECT datos_id, cliente_id, nombre, apellidos, telefono, direccion, ciudad, codigo_postal, pais
  FROM datos_personales
  WHERE cliente_id = @cid;
END;
GO

CREATE OR ALTER PROCEDURE datos_personales_select_all
AS
BEGIN
  SET NOCOUNT ON;
  SELECT datos_id, cliente_id, nombre, apellidos, telefono, direccion, ciudad, codigo_postal, pais
  FROM datos_personales;
END;
GO

CREATE OR ALTER PROCEDURE datos_personales_por_id
  @datos_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT datos_id, cliente_id, nombre, apellidos, telefono, direccion, ciudad, codigo_postal, pais
  FROM datos_personales
  WHERE datos_id = @datos_id;
END;
GO

/* ==============================================
   Índices
   ============================================== */
CREATE UNIQUE INDEX idx_datos_personales_cliente_id
  ON datos_personales (cliente_id);
GO

CREATE NONCLUSTERED INDEX IX_dp_ins_cliente_fecha
  ON datos_personales_insert_log (cliente_id, fecha_log);
CREATE NONCLUSTERED INDEX IX_dp_del_cliente_fecha
  ON datos_personales_delete_log (cliente_id, fecha_log);
CREATE NONCLUSTERED INDEX IX_dp_upd_cliente_fecha
  ON datos_personales_update_log (cliente_id, fecha_log);
GO

/* ==============================================
   Tabla principal datos_facturacion
   ============================================== */
DROP TABLE IF EXISTS datos_facturacion;
GO
CREATE TABLE datos_facturacion (
  datos_facturacion_id INT           IDENTITY(1,1) PRIMARY KEY,
  cliente_id           NVARCHAR(20)  NOT NULL,
  rfc                  NVARCHAR(13)  NOT NULL,
  razon_social         NVARCHAR(100) NOT NULL,
  direccion_fiscal     NVARCHAR(200) NULL,
  CONSTRAINT fk_datos_facturacion_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(cliente_id)
);
GO

/* ==============================================
   Tablas de log (sin 'usuario')
   ============================================== */
DROP TABLE IF EXISTS datos_facturacion_insert_log;
GO
CREATE TABLE datos_facturacion_insert_log (
  log_id               INT IDENTITY(1,1) PRIMARY KEY,
  datos_facturacion_id INT           NOT NULL,
  cliente_id           NVARCHAR(20)  NOT NULL,
  rfc                  NVARCHAR(13)  NOT NULL,
  razon_social         NVARCHAR(100) NOT NULL,
  direccion_fiscal     NVARCHAR(200) NULL,
  fecha_log            DATETIME      NOT NULL DEFAULT GETDATE(),
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS datos_facturacion_delete_log;
GO
CREATE TABLE datos_facturacion_delete_log (
  log_id               INT IDENTITY(1,1) PRIMARY KEY,
  datos_facturacion_id INT           NOT NULL,
  cliente_id           NVARCHAR(20)  NOT NULL,
  rfc                  NVARCHAR(13)  NOT NULL,
  razon_social         NVARCHAR(100) NOT NULL,
  direccion_fiscal     NVARCHAR(200) NULL,
  fecha_log            DATETIME      NOT NULL DEFAULT GETDATE(),
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS datos_facturacion_update_log;
GO
CREATE TABLE datos_facturacion_update_log (
  log_id               INT IDENTITY(1,1) PRIMARY KEY,
  datos_facturacion_id INT           NOT NULL,
  cliente_id           NVARCHAR(20)  NOT NULL,
  rfc_old              NVARCHAR(13)  NULL,
  razon_social_old     NVARCHAR(100) NULL,
  direccion_fiscal_old NVARCHAR(200) NULL,
  rfc_new              NVARCHAR(13)  NULL,
  razon_social_new     NVARCHAR(100) NULL,
  direccion_fiscal_new NVARCHAR(200) NULL,
  fecha_log            DATETIME      NOT NULL DEFAULT GETDATE(),
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

/* ==============================================
   Triggers (registran cualquier cambio)
   ============================================== */
CREATE OR ALTER TRIGGER trg_insert_datos_facturacion
ON datos_facturacion
AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO datos_facturacion_insert_log (
    datos_facturacion_id, cliente_id, rfc, razon_social, direccion_fiscal
  )
  SELECT i.datos_facturacion_id, i.cliente_id, i.rfc, i.razon_social, i.direccion_fiscal
  FROM inserted i;
END;
GO

CREATE OR ALTER TRIGGER trg_delete_datos_facturacion
ON datos_facturacion
AFTER DELETE
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO datos_facturacion_delete_log (
    datos_facturacion_id, cliente_id, rfc, razon_social, direccion_fiscal
  )
  SELECT d.datos_facturacion_id, d.cliente_id, d.rfc, d.razon_social, d.direccion_fiscal
  FROM deleted d;
END;
GO

CREATE OR ALTER TRIGGER trg_update_datos_facturacion
ON datos_facturacion
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO datos_facturacion_update_log (
    datos_facturacion_id, cliente_id,
    rfc_old, razon_social_old, direccion_fiscal_old,
    rfc_new, razon_social_new, direccion_fiscal_new
  )
  SELECT
    d.datos_facturacion_id, d.cliente_id,
    d.rfc, d.razon_social, d.direccion_fiscal,
    i.rfc, i.razon_social, i.direccion_fiscal
  FROM deleted d
  JOIN inserted i ON i.datos_facturacion_id = d.datos_facturacion_id; -- sin WHERE
END;
GO

/* ==============================================
   Procedimientos (normalizan 'cl-' y usan logs unificados)
   ============================================== */
CREATE OR ALTER PROCEDURE datos_facturacion_insert
  @cliente_id       NVARCHAR(20),
  @rfc              NVARCHAR(13),
  @razon_social     NVARCHAR(100),
  @direccion_fiscal NVARCHAR(200) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    DECLARE @cid NVARCHAR(20) =
      CASE WHEN LEFT(@cliente_id,3)='cl-' THEN @cliente_id ELSE CONCAT('cl-',@cliente_id) END;

    IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cid)
      THROW 58000, 'El cliente_id no existe.', 1;

    IF EXISTS (SELECT 1 FROM datos_facturacion WHERE cliente_id = @cid)
      THROW 58001, 'Ya existe datos_facturacion para este cliente.', 1;

    INSERT INTO datos_facturacion (cliente_id, rfc, razon_social, direccion_fiscal)
    VALUES (@cid, @rfc, @razon_social, @direccion_fiscal);

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'datos_facturacion_insert', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

CREATE OR ALTER PROCEDURE datos_facturacion_update
  @cliente_id       NVARCHAR(20),
  @rfc              NVARCHAR(13),
  @razon_social     NVARCHAR(100),
  @direccion_fiscal NVARCHAR(200) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    DECLARE @cid NVARCHAR(20) =
      CASE WHEN LEFT(@cliente_id,3)='cl-' THEN @cliente_id ELSE CONCAT('cl-',@cliente_id) END;

    IF NOT EXISTS (SELECT 1 FROM datos_facturacion WHERE cliente_id = @cid)
      THROW 58002, 'No existe datos_facturacion para este cliente.', 1;

    UPDATE datos_facturacion
    SET rfc = @rfc, razon_social = @razon_social, direccion_fiscal = @direccion_fiscal
    WHERE cliente_id = @cid;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'datos_facturacion_update', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

CREATE OR ALTER PROCEDURE datos_facturacion_delete
  @cliente_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    DECLARE @cid NVARCHAR(20) =
      CASE WHEN LEFT(@cliente_id,3)='cl-' THEN @cliente_id ELSE CONCAT('cl-',@cliente_id) END;

    IF NOT EXISTS (SELECT 1 FROM datos_facturacion WHERE cliente_id = @cid)
      THROW 58003, 'No existe datos_facturacion para este cliente.', 1;

    DELETE FROM datos_facturacion WHERE cliente_id = @cid;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'datos_facturacion_delete', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

CREATE OR ALTER PROCEDURE datos_facturacion_select_by_cliente
  @cliente_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @cid NVARCHAR(20) =
    CASE WHEN LEFT(@cliente_id,3)='cl-' THEN @cliente_id ELSE CONCAT('cl-',@cliente_id) END;

  SELECT datos_facturacion_id, cliente_id, rfc, razon_social, direccion_fiscal
  FROM datos_facturacion
  WHERE cliente_id = @cid;
END;
GO

CREATE OR ALTER PROCEDURE datos_facturacion_select_all
AS
BEGIN
  SET NOCOUNT ON;
  SELECT datos_facturacion_id, cliente_id, rfc, razon_social, direccion_fiscal
  FROM datos_facturacion;
END;
GO

CREATE OR ALTER PROCEDURE datos_facturacion_por_id
  @datos_facturacion_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT datos_facturacion_id, cliente_id, rfc, razon_social, direccion_fiscal
  FROM datos_facturacion
  WHERE datos_facturacion_id = @datos_facturacion_id;
END;
GO

/* ==============================================
   Índices
   ============================================== */
CREATE UNIQUE INDEX idx_datos_facturacion_cliente_id
  ON datos_facturacion (cliente_id);
GO

CREATE NONCLUSTERED INDEX IX_df_ins_cliente_fecha
  ON datos_facturacion_insert_log (cliente_id, fecha_log);
CREATE NONCLUSTERED INDEX IX_df_del_cliente_fecha
  ON datos_facturacion_delete_log (cliente_id, fecha_log);
CREATE NONCLUSTERED INDEX IX_df_upd_cliente_fecha
  ON datos_facturacion_update_log (cliente_id, fecha_log);
GO

/* ==============================================================
   METODOS DE PAGO 
   ============================================================== */

-- ==============================================
-- Tabla principal de métodos de pago
-- ==============================================
DROP TABLE IF EXISTS metodos_pago;
GO
CREATE TABLE metodos_pago (
  metodo_id       INT           IDENTITY(1,1) PRIMARY KEY,
  cliente_id      NVARCHAR(20)  NOT NULL,
  tipo            NVARCHAR(20)  NOT NULL,
  -- Dirección asociada al medio de pago (se puede poblar desde datos_personales)
  direccion       NVARCHAR(200) NULL,
  ciudad          NVARCHAR(50)  NULL,
  codigo_postal   NVARCHAR(10)  NULL,
  pais            NVARCHAR(50)  NULL,
  datos           NVARCHAR(MAX) NOT NULL,
  es_principal    BIT           NOT NULL DEFAULT 0,
  fecha_creacion  DATETIME      NOT NULL DEFAULT GETDATE(),
  CONSTRAINT fk_metodos_pago_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(cliente_id)
);
GO

/* ========================
   Tablas de LOG (sin 'usuario')
   ======================== */

DROP TABLE IF EXISTS metodos_pago_insert_log;
GO
CREATE TABLE metodos_pago_insert_log (
  log_id         INT IDENTITY(1,1) PRIMARY KEY,
  metodo_id      INT           NOT NULL,
  cliente_id     NVARCHAR(20)  NOT NULL,
  tipo           NVARCHAR(20)  NOT NULL,
  direccion      NVARCHAR(200) NULL,
  ciudad         NVARCHAR(50)  NULL,
  codigo_postal  NVARCHAR(10)  NULL,
  pais           NVARCHAR(50)  NULL,
  datos          NVARCHAR(MAX) NOT NULL,
  es_principal   BIT           NOT NULL,
  fecha_creacion DATETIME      NOT NULL,
  fecha_log      DATETIME      NOT NULL DEFAULT GETDATE(),
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS metodos_pago_delete_log;
GO
CREATE TABLE metodos_pago_delete_log (
  log_id         INT IDENTITY(1,1) PRIMARY KEY,
  metodo_id      INT           NOT NULL,
  cliente_id     NVARCHAR(20)  NOT NULL,
  tipo           NVARCHAR(20)  NOT NULL,
  direccion      NVARCHAR(200) NULL,
  ciudad         NVARCHAR(50)  NULL,
  codigo_postal  NVARCHAR(10)  NULL,
  pais           NVARCHAR(50)  NULL,
  datos          NVARCHAR(MAX) NOT NULL,
  es_principal   BIT           NOT NULL,
  fecha_creacion DATETIME      NOT NULL,
  fecha_log      DATETIME      NOT NULL DEFAULT GETDATE(),
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

DROP TABLE IF EXISTS metodos_pago_update_log;
GO
CREATE TABLE metodos_pago_update_log (
  log_id                INT IDENTITY(1,1) PRIMARY KEY,
  metodo_id             INT           NOT NULL,
  cliente_id            NVARCHAR(20)  NOT NULL,
  -- valores anteriores
  tipo_old              NVARCHAR(20)  NULL,
  direccion_old         NVARCHAR(200) NULL,
  ciudad_old            NVARCHAR(50)  NULL,
  codigo_postal_old     NVARCHAR(10)  NULL,
  pais_old              NVARCHAR(50)  NULL,
  datos_old             NVARCHAR(MAX) NULL,
  es_principal_old      BIT           NULL,
  -- valores nuevos
  tipo_new              NVARCHAR(20)  NULL,
  direccion_new         NVARCHAR(200) NULL,
  ciudad_new            NVARCHAR(50)  NULL,
  codigo_postal_new     NVARCHAR(10)  NULL,
  pais_new              NVARCHAR(50)  NULL,
  datos_new             NVARCHAR(MAX) NULL,
  es_principal_new      BIT           NULL,
  fecha_log             DATETIME      NOT NULL DEFAULT GETDATE(),
  usuario NVARCHAR(128)  NOT NULL DEFAULT SUSER_SNAME() -- Usuario automático
);
GO

/* ========================
   TRIGGERS (registran cualquier cambio)
   ======================== */

-- INSERT
CREATE OR ALTER TRIGGER trg_insert_metodos_pago
ON metodos_pago
AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO metodos_pago_insert_log (
    metodo_id, cliente_id, tipo, direccion, ciudad, codigo_postal, pais,
    datos, es_principal, fecha_creacion
  )
  SELECT
    i.metodo_id, i.cliente_id, i.tipo, i.direccion, i.ciudad, i.codigo_postal, i.pais,
    i.datos, i.es_principal, i.fecha_creacion
  FROM inserted i;
END;
GO

-- DELETE
CREATE OR ALTER TRIGGER trg_delete_metodos_pago
ON metodos_pago
AFTER DELETE
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO metodos_pago_delete_log (
    metodo_id, cliente_id, tipo, direccion, ciudad, codigo_postal, pais,
    datos, es_principal, fecha_creacion
  )
  SELECT
    d.metodo_id, d.cliente_id, d.tipo, d.direccion, d.ciudad, d.codigo_postal, d.pais,
    d.datos, d.es_principal, d.fecha_creacion
  FROM deleted d;
END;
GO

-- UPDATE (SIEMPRE registra; sin WHERE)
CREATE OR ALTER TRIGGER trg_update_metodos_pago
ON metodos_pago
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO metodos_pago_update_log (
    metodo_id, cliente_id,
    tipo_old, direccion_old, ciudad_old, codigo_postal_old, pais_old, datos_old, es_principal_old,
    tipo_new, direccion_new, ciudad_new, codigo_postal_new, pais_new, datos_new, es_principal_new
  )
  SELECT
    d.metodo_id, d.cliente_id,
    d.tipo, d.direccion, d.ciudad, d.codigo_postal, d.pais, d.datos, d.es_principal,
    i.tipo, i.direccion, i.ciudad, i.codigo_postal, i.pais, i.datos, i.es_principal
  FROM deleted d
  JOIN inserted i ON i.metodo_id = d.metodo_id;
END;
GO

/* ========================
   PROCEDIMIENTOS (CRUD + integración con datos_personales)
   ======================== */

-- INSERT
CREATE OR ALTER PROCEDURE metodos_pago_insert
  @cliente_id    NVARCHAR(20),
  @tipo          NVARCHAR(20),
  @datos         NVARCHAR(MAX),
  @direccion     NVARCHAR(200) = NULL,
  @ciudad        NVARCHAR(50)  = NULL,
  @codigo_postal NVARCHAR(10)  = NULL,
  @pais          NVARCHAR(50)  = NULL,
  @es_principal  BIT = 0
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    DECLARE @cid NVARCHAR(20) =
      CASE WHEN LEFT(@cliente_id,3)='cl-' THEN @cliente_id ELSE CONCAT('cl-',@cliente_id) END;

    IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cid)
      THROW 52100, 'cliente_id no existe.', 1;

    -- opcional: garantizar único principal por cliente
    IF @es_principal = 1
      UPDATE metodos_pago SET es_principal = 0 WHERE cliente_id = @cid;

    INSERT INTO metodos_pago (
      cliente_id, tipo, direccion, ciudad, codigo_postal, pais,
      datos, es_principal
    )
    VALUES (
      @cid, @tipo, @direccion, @ciudad, @codigo_postal, @pais,
      @datos, @es_principal
    );

    COMMIT;

    SELECT SCOPE_IDENTITY() AS metodo_id;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'metodos_pago_insert', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- INSERT tomando dirección desde datos_personales y armando JSON en 'datos'
CREATE OR ALTER PROCEDURE metodos_pago_insert_desde_datos_personales
  @cliente_id    NVARCHAR(20),
  @tipo          NVARCHAR(20),
  @es_principal  BIT = 0
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    DECLARE
      @cid NVARCHAR(20) =
        CASE WHEN LEFT(@cliente_id,3)='cl-' THEN @cliente_id ELSE CONCAT('cl-',@cliente_id) END,
      @nombre NVARCHAR(50),
      @apellidos NVARCHAR(100),
      @telefono NVARCHAR(20),
      @direccion NVARCHAR(200),
      @ciudad NVARCHAR(50),
      @cp NVARCHAR(10),
      @pais NVARCHAR(50),
      @datos NVARCHAR(MAX);

    IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cid)
      THROW 52110, 'cliente_id no existe.', 1;

    SELECT
      @nombre    = dp.nombre,
      @apellidos = dp.apellidos,
      @telefono  = dp.telefono,
      @direccion = dp.direccion,
      @ciudad    = dp.ciudad,
      @cp        = dp.codigo_postal,
      @pais      = dp.pais
    FROM datos_personales dp
    WHERE dp.cliente_id = @cid;

    IF @nombre IS NULL AND @apellidos IS NULL AND @direccion IS NULL
      THROW 52111, 'No existen datos_personales para este cliente.', 1;

    -- Construir JSON con STRING_ESCAPE para evitar problemas de comillas
    SET @datos = CONCAT(
      N'{"nombre":"',       STRING_ESCAPE(ISNULL(@nombre,''),'json'),
      N'","apellidos":"',   STRING_ESCAPE(ISNULL(@apellidos,''),'json'),
      N'","telefono":"',    STRING_ESCAPE(ISNULL(@telefono,''),'json'),
      N'","direccion":"',   STRING_ESCAPE(ISNULL(@direccion,''),'json'),
      N'","ciudad":"',      STRING_ESCAPE(ISNULL(@ciudad,''),'json'),
      N'","codigo_postal":"', STRING_ESCAPE(ISNULL(@cp,''),'json'),
      N'","pais":"',        STRING_ESCAPE(ISNULL(@pais,''),'json'),
      N'"}'
    );

    IF @es_principal = 1
      UPDATE metodos_pago SET es_principal = 0 WHERE cliente_id = @cid;

    INSERT INTO metodos_pago (
      cliente_id, tipo, direccion, ciudad, codigo_postal, pais,
      datos, es_principal
    ) VALUES (
      @cid, @tipo, @direccion, @ciudad, @cp, @pais,
      @datos, @es_principal
    );

    COMMIT;

    SELECT SCOPE_IDENTITY() AS metodo_id, @datos AS datos_generados_json;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'metodos_pago_insert_desde_datos_personales', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- UPDATE
CREATE OR ALTER PROCEDURE metodos_pago_update
  @metodo_id     INT,
  @tipo          NVARCHAR(20),
  @datos         NVARCHAR(MAX),
  @direccion     NVARCHAR(200) = NULL,
  @ciudad        NVARCHAR(50)  = NULL,
  @codigo_postal NVARCHAR(10)  = NULL,
  @pais          NVARCHAR(50)  = NULL,
  @es_principal  BIT = NULL         -- si = 1, se vuelve el único principal
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    IF NOT EXISTS (SELECT 1 FROM metodos_pago WHERE metodo_id = @metodo_id)
      THROW 52120, 'metodo_id no existe.', 1;

    DECLARE @cid NVARCHAR(20);
    SELECT @cid = cliente_id FROM metodos_pago WHERE metodo_id = @metodo_id;

    IF @es_principal = 1
      UPDATE metodos_pago SET es_principal = 0 WHERE cliente_id = @cid AND metodo_id <> @metodo_id;

    UPDATE metodos_pago
    SET
      tipo          = @tipo,
      datos         = @datos,
      direccion     = @direccion,
      ciudad        = @ciudad,
      codigo_postal = @codigo_postal,
      pais          = @pais,
      es_principal  = COALESCE(@es_principal, es_principal)
    WHERE metodo_id = @metodo_id;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'metodos_pago_update', ERROR_MESSAGE());
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
    BEGIN TRAN;

    IF NOT EXISTS (SELECT 1 FROM metodos_pago WHERE metodo_id = @metodo_id)
      THROW 52130, 'metodo_id no existe.', 1;

    DELETE FROM metodos_pago WHERE metodo_id = @metodo_id;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs (origen, mensaje) VALUES (N'metodos_pago_delete', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- SELECT por cliente (acepta 'cl-123' o '123')
CREATE OR ALTER PROCEDURE metodos_pago_select_by_cliente
  @cliente_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @cid NVARCHAR(20) =
    CASE WHEN LEFT(@cliente_id,3)='cl-' THEN @cliente_id ELSE CONCAT('cl-',@cliente_id) END;

  SELECT metodo_id, cliente_id, tipo, direccion, ciudad, codigo_postal, pais,
         datos, es_principal, fecha_creacion
  FROM metodos_pago
  WHERE cliente_id = @cid
  ORDER BY es_principal DESC, fecha_creacion DESC;
END;
GO

-- SELECT todos
CREATE OR ALTER PROCEDURE metodos_pago_select_all
AS
BEGIN
  SET NOCOUNT ON;
  SELECT metodo_id, cliente_id, tipo, direccion, ciudad, codigo_postal, pais,
         datos, es_principal, fecha_creacion
  FROM metodos_pago;
END;
GO

-- SELECT por id
CREATE OR ALTER PROCEDURE metodos_pago_por_id
  @metodo_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT metodo_id, cliente_id, tipo, direccion, ciudad, codigo_postal, pais,
         datos, es_principal, fecha_creacion
  FROM metodos_pago
  WHERE metodo_id = @metodo_id;
END;
GO

/* ========================
   ÍNDICES
   ======================== */

-- Búsquedas y orden por cliente/principal/fecha
CREATE NONCLUSTERED INDEX IX_metodos_cliente_principal_fecha
  ON metodos_pago (cliente_id, es_principal, fecha_creacion)
  INCLUDE (tipo, direccion, ciudad, codigo_postal, pais, datos);
GO

-- Acceso por cliente
CREATE NONCLUSTERED INDEX IX_metodos_cliente
  ON metodos_pago (cliente_id)
  INCLUDE (tipo, es_principal, fecha_creacion);
GO

-- Logs: auditoría por método y/o cliente
CREATE NONCLUSTERED INDEX IX_mp_ins_metodo_fecha
  ON metodos_pago_insert_log (metodo_id, fecha_log)
  INCLUDE (cliente_id, tipo, es_principal);
GO
CREATE NONCLUSTERED INDEX IX_mp_del_metodo_fecha
  ON metodos_pago_delete_log (metodo_id, fecha_log)
  INCLUDE (cliente_id, tipo, es_principal);
GO
CREATE NONCLUSTERED INDEX IX_mp_upd_metodo_fecha
  ON metodos_pago_update_log (metodo_id, fecha_log)
  INCLUDE (cliente_id, tipo_old, es_principal_old, tipo_new, es_principal_new);
GO

/* ==============================================================
   IMÁGENES – productos, categorías (sin logs de auditoría)
   ============================================================== */

DROP TABLE IF EXISTS imagenes_categorias;
DROP TABLE IF EXISTS imagenes_productos;
GO

/* ========================
   Tablas
   ======================== */

-- Imágenes de productos (FK a productos.producto_id  NVARCHAR(20) con prefijo 'prd-')
CREATE TABLE imagenes_productos (
  id           INT            IDENTITY(1,1) PRIMARY KEY,
  producto_id  NVARCHAR(20)   NOT NULL,
  image_path   NVARCHAR(255)  NOT NULL,
  fecha_alta   DATETIME       NOT NULL DEFAULT GETDATE(),
  CONSTRAINT fk_img_prod_producto
    FOREIGN KEY (producto_id) REFERENCES productos(producto_id)
);
GO

-- Imágenes de categorías (FK a categorias.categoria_id INT)
CREATE TABLE imagenes_categorias (
  id            INT            IDENTITY(1,1) PRIMARY KEY,
  categoria_id  INT            NOT NULL,
  image_path    NVARCHAR(255)  NOT NULL,
  fecha_alta    DATETIME       NOT NULL DEFAULT GETDATE(),
  CONSTRAINT fk_img_cat_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorias(categoria_id)
);
GO

/* ========================
   Índices
   ======================== */
CREATE NONCLUSTERED INDEX IX_imagenes_productos_producto
  ON imagenes_productos (producto_id);
GO
CREATE NONCLUSTERED INDEX IX_imagenes_categorias_categoria
  ON imagenes_categorias (categoria_id);
GO

/* ========================
   PROCEDIMIENTOS – PRODUCTOS
   ======================== */

-- INSERT (acepta 'prd-123' o '123')
CREATE OR ALTER PROCEDURE imagenes_productos_insert
  @producto_id NVARCHAR(20),
  @image_path  NVARCHAR(255)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    DECLARE @pid NVARCHAR(20) =
      CASE WHEN LEFT(@producto_id,4)='prd-' THEN @producto_id ELSE CONCAT('prd-',@producto_id) END;

    IF NOT EXISTS (SELECT 1 FROM productos WHERE producto_id = @pid)
      THROW 60001, 'El producto no existe.', 1;

    INSERT INTO imagenes_productos (producto_id, image_path)
    VALUES (@pid, @image_path);

    SELECT SCOPE_IDENTITY() AS id, @pid AS producto_id;
  END TRY
  BEGIN CATCH
    INSERT INTO logs (origen, mensaje) VALUES (N'imagenes_productos_insert', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- UPDATE (puede mover la imagen a otro producto y/o cambiar ruta)
CREATE OR ALTER PROCEDURE imagenes_productos_update
  @id          INT,
  @producto_id NVARCHAR(20) = NULL,  -- opcional
  @image_path  NVARCHAR(255) = NULL  -- opcional
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM imagenes_productos WHERE id = @id)
      THROW 60002, 'La imagen de producto no existe.', 1;

    DECLARE @pid NVARCHAR(20) = NULL;
    IF @producto_id IS NOT NULL
    BEGIN
      SET @pid =
        CASE WHEN LEFT(@producto_id,4)='prd-' THEN @producto_id ELSE CONCAT('prd-',@producto_id) END;
      IF NOT EXISTS (SELECT 1 FROM productos WHERE producto_id = @pid)
        THROW 60003, 'El producto destino no existe.', 1;
    END

    UPDATE imagenes_productos
    SET producto_id = COALESCE(@pid, producto_id),
        image_path  = COALESCE(@image_path, image_path)
    WHERE id = @id;

    SELECT id, producto_id, image_path FROM imagenes_productos WHERE id = @id;
  END TRY
  BEGIN CATCH
    INSERT INTO logs (origen, mensaje) VALUES (N'imagenes_productos_update', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- DELETE
CREATE OR ALTER PROCEDURE imagenes_productos_delete
  @id INT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM imagenes_productos WHERE id = @id)
      THROW 60004, 'La imagen de producto no existe.', 1;

    DELETE FROM imagenes_productos WHERE id = @id;
  END TRY
  BEGIN CATCH
    INSERT INTO logs (origen, mensaje) VALUES (N'imagenes_productos_delete', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- GET por id
CREATE OR ALTER PROCEDURE imagenes_productos_get_by_id
  @id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, producto_id, image_path, fecha_alta
  FROM imagenes_productos
  WHERE id = @id;
END;
GO

-- GET por producto (acepta 'prd-123' o '123')
CREATE OR ALTER PROCEDURE imagenes_productos_get_by_producto
  @producto_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @pid NVARCHAR(20) =
    CASE WHEN LEFT(@producto_id,4)='prd-' THEN @producto_id ELSE CONCAT('prd-',@producto_id) END;

  SELECT id, producto_id, image_path, fecha_alta
  FROM imagenes_productos
  WHERE producto_id = @pid
  ORDER BY id;
END;
GO

-- GET all
CREATE OR ALTER PROCEDURE imagenes_productos_get_all
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, producto_id, image_path, fecha_alta
  FROM imagenes_productos
  ORDER BY id;
END;
GO

/* ========================
   PROCEDIMIENTOS – CATEGORÍAS
   ======================== */

-- INSERT
CREATE OR ALTER PROCEDURE imagenes_categorias_insert
  @categoria_id INT,
  @image_path   NVARCHAR(255)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM categorias WHERE categoria_id = @categoria_id)
      THROW 60011, 'La categoría no existe.', 1;

    INSERT INTO imagenes_categorias (categoria_id, image_path)
    VALUES (@categoria_id, @image_path);

    SELECT SCOPE_IDENTITY() AS id, @categoria_id AS categoria_id;
  END TRY
  BEGIN CATCH
    INSERT INTO logs (origen, mensaje) VALUES (N'imagenes_categorias_insert', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- UPDATE
CREATE OR ALTER PROCEDURE imagenes_categorias_update
  @id           INT,
  @categoria_id INT = NULL,
  @image_path   NVARCHAR(255) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM imagenes_categorias WHERE id = @id)
      THROW 60012, 'La imagen de categoría no existe.', 1;

    IF @categoria_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categorias WHERE categoria_id = @categoria_id)
      THROW 60013, 'La categoría destino no existe.', 1;

    UPDATE imagenes_categorias
    SET categoria_id = COALESCE(@categoria_id, categoria_id),
        image_path   = COALESCE(@image_path, image_path)
    WHERE id = @id;

    SELECT id, categoria_id, image_path FROM imagenes_categorias WHERE id = @id;
  END TRY
  BEGIN CATCH
    INSERT INTO logs (origen, mensaje) VALUES (N'imagenes_categorias_update', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- DELETE
CREATE OR ALTER PROCEDURE imagenes_categorias_delete
  @id INT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM imagenes_categorias WHERE id = @id)
      THROW 60014, 'La imagen de categoría no existe.', 1;

    DELETE FROM imagenes_categorias WHERE id = @id;
  END TRY
  BEGIN CATCH
    INSERT INTO logs (origen, mensaje) VALUES (N'imagenes_categorias_delete', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- GET por id
CREATE OR ALTER PROCEDURE imagenes_categorias_get_by_id
  @id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, categoria_id, image_path, fecha_alta
  FROM imagenes_categorias
  WHERE id = @id;
END;
GO

-- GET por categoría
CREATE OR ALTER PROCEDURE imagenes_categorias_get_by_categoria
  @categoria_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, categoria_id, image_path, fecha_alta
  FROM imagenes_categorias
  WHERE categoria_id = @categoria_id
  ORDER BY id;
END;
GO

-- GET all
CREATE OR ALTER PROCEDURE imagenes_categorias_get_all
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, categoria_id, image_path, fecha_alta
  FROM imagenes_categorias
  ORDER BY id;
END;
GO


-- Producto
CREATE OR ALTER PROCEDURE ingresar_imagen_producto
  @producto_id NVARCHAR(20),
  @imagepath   NVARCHAR(255)
AS
BEGIN
  EXEC imagenes_productos_insert @producto_id = @producto_id, @image_path = @imagepath;
END;
GO

-- Categoría
CREATE OR ALTER PROCEDURE ingresar_imagen_categoria
  @categoria_id INT,
  @imagepath    NVARCHAR(255)
AS
BEGIN
  EXEC imagenes_categorias_insert @categoria_id = @categoria_id, @image_path = @imagepath;
END;
GO



/* ===========================================================
   ALERTAS DE INVENTARIO – Tablas
   =========================================================== */

DROP TABLE IF EXISTS productos_sin_stock;
GO
CREATE TABLE productos_sin_stock (
  producto_id NVARCHAR(20) UNIQUE NOT NULL
);
GO

DROP TABLE IF EXISTS productos_sin_stock_log;
GO
CREATE TABLE productos_sin_stock_log (
  producto_id  NVARCHAR(20) NOT NULL,
  fecha_alerta DATETIME     NOT NULL DEFAULT GETDATE(),
  categoria_id INT          NOT NULL
);
GO

/* ===========================================================
   TRIGGER: Insert -> si activo y stock = 0 => registra en sin_stock + log
   =========================================================== */
CREATE OR ALTER TRIGGER trg_productos_zero_stock_insert
ON productos
AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;

  -- Solo productos activos con stock = 0
  INSERT INTO productos_sin_stock (producto_id)
  SELECT i.producto_id
  FROM inserted AS i
  WHERE (i.estado_producto = N'activo')
    AND i.stock = 0
    AND NOT EXISTS (
      SELECT 1 FROM productos_sin_stock s WHERE s.producto_id = i.producto_id
    );

  -- Log de alerta
  INSERT INTO productos_sin_stock_log (producto_id, categoria_id)
  SELECT i.producto_id, i.categoria_id
  FROM inserted AS i
  WHERE (i.estado_producto = N'activo') AND i.stock = 0;
END;
GO

/* ===========================================================
   TRIGGER: Update -> si activo y stock = 0 => registra en sin_stock + log
   =========================================================== */
CREATE OR ALTER TRIGGER trg_productos_zero_stock_update
ON productos
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;

  -- Solo filas cuyo nuevo valor cumpla la condición (activo y stock = 0)
  INSERT INTO productos_sin_stock (producto_id)
  SELECT i.producto_id
  FROM inserted AS i
  WHERE (i.estado_producto = N'activo')
    AND i.stock = 0
    AND NOT EXISTS (
      SELECT 1 FROM productos_sin_stock s WHERE s.producto_id = i.producto_id
    );

  -- Log de alerta
  INSERT INTO productos_sin_stock_log (producto_id, categoria_id)
  SELECT i.producto_id, i.categoria_id
  FROM inserted AS i
  WHERE (i.estado_producto = N'activo') AND i.stock = 0;
END;
GO

/* ===========================================================
   STOCK: agregar unidades
   - Suma @cantidad al stock del producto.
   - Si el nuevo stock > 0, elimina registro en productos_sin_stock.
   =========================================================== */
CREATE OR ALTER PROCEDURE productos_stock_agregar
  @producto_id NVARCHAR(20),  -- admite 'prd-123' o '123'
  @cantidad    INT
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;

  BEGIN TRY
    IF @cantidad IS NULL OR @cantidad <= 0
      THROW 52007, 'Cantidad inválida (debe ser > 0).', 1;

    DECLARE @pid NVARCHAR(20) =
      CASE WHEN LEFT(LTRIM(RTRIM(@producto_id)),4)='prd-' THEN LTRIM(RTRIM(@producto_id))
           ELSE CONCAT('prd-', LTRIM(RTRIM(@producto_id))) END;

    IF NOT EXISTS (SELECT 1 FROM productos WHERE producto_id = @pid)
      THROW 52008, 'El producto no existe.', 1;

    BEGIN TRAN;

      UPDATE p WITH (ROWLOCK, UPDLOCK)
        SET p.stock = p.stock + @cantidad
      FROM productos p
      WHERE p.producto_id = @pid;

      -- Si el stock quedó > 0, eliminar de la lista de sin stock
      DELETE FROM productos_sin_stock WHERE producto_id = @pid;

    COMMIT;

    SELECT producto_id, stock FROM productos WHERE producto_id = @pid;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs(origen, mensaje) VALUES (N'productos_stock_agregar', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

/* ===========================================================
   STOCK: reducir unidades
   - Resta @cantidad al stock del producto (sin permitir negativo).
   - Si queda exactamente 0, el trigger UPDATE registrará en sin_stock + log.
   =========================================================== */
CREATE OR ALTER PROCEDURE productos_stock_reducir
  @producto_id NVARCHAR(20),  -- admite 'prd-123' o '123'
  @cantidad    INT
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;

  BEGIN TRY
    IF @cantidad IS NULL OR @cantidad <= 0
      THROW 52007, 'Cantidad inválida (debe ser > 0).', 1;

    DECLARE @pid NVARCHAR(20) =
      CASE WHEN LEFT(LTRIM(RTRIM(@producto_id)),4)='prd-' THEN LTRIM(RTRIM(@producto_id))
           ELSE CONCAT('prd-', LTRIM(RTRIM(@producto_id))) END;

    IF NOT EXISTS (SELECT 1 FROM productos WHERE producto_id = @pid)
      THROW 52008, 'El producto no existe.', 1;

    BEGIN TRAN;

      -- No permitir stock negativo
      UPDATE p WITH (ROWLOCK, UPDLOCK)
        SET p.stock = CASE WHEN p.stock >= @cantidad THEN p.stock - @cantidad
                           ELSE 0 END
      FROM productos p
      WHERE p.producto_id = @pid;

      -- Si quedó en 0: el TRIGGER trg_productos_zero_stock_update hará el alta en sin_stock + log.

    COMMIT;

    SELECT producto_id, stock FROM productos WHERE producto_id = @pid;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs(origen, mensaje) VALUES (N'productos_stock_reducir', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO



/* ===========================================================
   CONSULTAS: productos_sin_stock_log
   =========================================================== */

-- 4.1) Todos
CREATE OR ALTER PROCEDURE productos_sin_stock_log_get_all
AS
BEGIN
  SET NOCOUNT ON;
  SELECT producto_id, categoria_id, fecha_alerta
  FROM productos_sin_stock_log
  ORDER BY fecha_alerta DESC, producto_id;
END;
GO

-- 4.2) Por producto
CREATE OR ALTER PROCEDURE productos_sin_stock_log_get_by_producto
  @producto_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @pid NVARCHAR(20) =
    CASE WHEN LEFT(LTRIM(RTRIM(@producto_id)),4)='prd-' THEN LTRIM(RTRIM(@producto_id))
         ELSE CONCAT('prd-', LTRIM(RTRIM(@producto_id))) END;

  SELECT producto_id, categoria_id, fecha_alerta
  FROM productos_sin_stock_log
  WHERE producto_id = @pid
  ORDER BY fecha_alerta DESC;
END;
GO

-- 4.3) Por categoría
CREATE OR ALTER PROCEDURE productos_sin_stock_log_get_by_categoria
  @categoria_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT producto_id, categoria_id, fecha_alerta
  FROM productos_sin_stock_log
  WHERE categoria_id = @categoria_id
  ORDER BY fecha_alerta DESC, producto_id;
END;
GO

-- 4.4) Por rango de fechas (inclusive)
CREATE OR ALTER PROCEDURE productos_sin_stock_log_get_by_rango
  @desde DATETIME,
  @hasta DATETIME
AS
BEGIN
  SET NOCOUNT ON;
  SELECT producto_id, categoria_id, fecha_alerta
  FROM productos_sin_stock_log
  WHERE fecha_alerta >= @desde AND fecha_alerta <= @hasta
  ORDER BY fecha_alerta DESC, producto_id;
END;
GO

-- 4.5) Por categoría y rango
CREATE OR ALTER PROCEDURE productos_sin_stock_log_get_by_categoria_rango
  @categoria_id INT,
  @desde DATETIME,
  @hasta DATETIME
AS
BEGIN
  SET NOCOUNT ON;
  SELECT producto_id, categoria_id, fecha_alerta
  FROM productos_sin_stock_log
  WHERE categoria_id = @categoria_id
    AND fecha_alerta >= @desde AND fecha_alerta <= @hasta
  ORDER BY fecha_alerta DESC, producto_id;
END;
GO

-- 4.6) Por producto y rango
CREATE OR ALTER PROCEDURE productos_sin_stock_log_get_by_producto_rango
  @producto_id NVARCHAR(20),
  @desde DATETIME,
  @hasta DATETIME
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @pid NVARCHAR(20) =
    CASE WHEN LEFT(LTRIM(RTRIM(@producto_id)),4)='prd-' THEN LTRIM(RTRIM(@producto_id))
         ELSE CONCAT('prd-', LTRIM(RTRIM(@producto_id))) END;

  SELECT producto_id, categoria_id, fecha_alerta
  FROM productos_sin_stock_log
  WHERE producto_id = @pid
    AND fecha_alerta >= @desde AND fecha_alerta <= @hasta
  ORDER BY fecha_alerta DESC;
END;
GO

/* ===========================================================
   ACTUALIZACIÓN MASIVA DE PRECIOS
   - Por MONTO: incrementar / reducir (no baja de 0.00)
   - Por PORCENTAJE: agregar descuento (p.ej. 15% => *0.85)
   - @categoria_id NULL => aplica a todas
   - @solo_activos = 1 => solo N'activo'
   =========================================================== */

-- 5.1) Incrementar por MONTO
CREATE OR ALTER PROCEDURE productos_precio_incrementar
  @monto         DECIMAL(10,2),
  @categoria_id  INT = NULL,
  @solo_activos  BIT = 1
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  BEGIN TRY
    IF @monto IS NULL OR @monto <= 0
      THROW 52021, 'Monto inválido (debe ser > 0).', 1;

    BEGIN TRAN;

      UPDATE p
         SET p.precio_unitario = ROUND(p.precio_unitario + @monto, 2)
      FROM productos p
      WHERE (@categoria_id IS NULL OR p.categoria_id = @categoria_id)
        AND (@solo_activos = 0 OR p.estado_producto = N'activo');

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs(origen, mensaje) VALUES (N'productos_precio_incrementar', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- 5.2) Reducir por MONTO (no < 0.00)
CREATE OR ALTER PROCEDURE productos_precio_reducir
  @monto         DECIMAL(10,2),
  @categoria_id  INT = NULL,
  @solo_activos  BIT = 1
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  BEGIN TRY
    IF @monto IS NULL OR @monto <= 0
      THROW 52022, 'Monto inválido (debe ser > 0).', 1;

    BEGIN TRAN;

      UPDATE p
         SET p.precio_unitario = ROUND(CASE WHEN p.precio_unitario >= @monto
                                            THEN p.precio_unitario - @monto
                                            ELSE 0.00 END, 2)
      FROM productos p
      WHERE (@categoria_id IS NULL OR p.categoria_id = @categoria_id)
        AND (@solo_activos = 0 OR p.estado_producto = N'activo');

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs(origen, mensaje) VALUES (N'productos_precio_reducir', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- 5.3) Descuento PORCENTUAL (p.ej. 15 => -15%)
CREATE OR ALTER PROCEDURE productos_agregar_descuento
  @porcentaje    DECIMAL(5,2),   -- 0 < @porcentaje < 100
  @categoria_id  INT = NULL,
  @solo_activos  BIT = 1
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  BEGIN TRY
    IF @porcentaje IS NULL OR @porcentaje <= 0 OR @porcentaje >= 100
      THROW 52023, 'Porcentaje inválido (0 < % < 100).', 1;

    DECLARE @factor DECIMAL(10,6) = 1 - (@porcentaje / 100.0);

    BEGIN TRAN;

      UPDATE p
         SET p.precio_unitario = ROUND(p.precio_unitario * @factor, 2)
      FROM productos p
      WHERE (@categoria_id IS NULL OR p.categoria_id = @categoria_id)
        AND (@solo_activos = 0 OR p.estado_producto = N'activo');

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    INSERT INTO logs(origen, mensaje) VALUES (N'productos_agregar_descuento', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

/* ===========================================================
   PROMOCIONES por CATEGORÍA
   =========================================================== */

DROP TABLE IF EXISTS promociones;
GO
CREATE TABLE promociones (
  promo_id      INT IDENTITY(1,1) PRIMARY KEY,
  categoria_id  INT NOT NULL,
  descuento_pct DECIMAL(5,2) NOT NULL CHECK (descuento_pct > 0 AND descuento_pct < 100),
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE NOT NULL,
  activo        BIT NOT NULL DEFAULT 1
);

CREATE INDEX IX_promos_categoria_activo_fecha
  ON promociones (categoria_id, activo, fecha_inicio, fecha_fin);
GO

-- Productos con una promoción activa a una fecha dada (toma la mayor promo si hay varias)
CREATE OR ALTER PROCEDURE promociones_activas_por_producto
  @fecha DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @f DATE = ISNULL(@fecha, CAST(GETDATE() AS DATE));

  SELECT
    pr.producto_id,
    pr.nombre_producto,
    pr.categoria_id,
    pr.precio_unitario AS precio_lista,
    ap.descuento_pct,
    ROUND(pr.precio_unitario * (1 - ap.descuento_pct/100.0), 2) AS precio_con_descuento
  FROM productos pr
  CROSS APPLY (
    SELECT MAX(p2.descuento_pct) AS descuento_pct
    FROM promociones p2
    WHERE p2.categoria_id = pr.categoria_id
      AND p2.activo = 1
      AND @f BETWEEN p2.fecha_inicio AND p2.fecha_fin
  ) ap
  WHERE ap.descuento_pct IS NOT NULL
  ORDER BY pr.categoria_id, pr.nombre_producto;
END;
GO

/* ==========================================
   PROMOCIONES por CATEGORÍA (registro/autolog)
   ========================================== */

DROP TABLE IF EXISTS promociones_categoria;
GO
CREATE TABLE promociones_categoria (
  promo_id        INT IDENTITY(1,1) PRIMARY KEY,
  categoria_id    INT           NOT NULL,
  tipo            NVARCHAR(12)  NOT NULL CHECK (tipo IN (N'MONTO', N'PORCENTAJE')),
  monto           DECIMAL(10,2) NULL,        -- exclusivo para tipo MONTO
  descuento_pct   DECIMAL(5,2)  NULL,        -- exclusivo para tipo PORCENTAJE (0<%<100)
  fecha_inicio    DATE          NOT NULL,
  fecha_fin       DATE          NOT NULL,
  solo_activos    BIT           NOT NULL DEFAULT(1),
  aplicado_en     DATETIME2     NULL,        -- timestamp de ejecución del cambio de precios
  creado_en       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_promos_categoria_valor
    CHECK (
      (tipo = N'MONTO'      AND monto IS NOT NULL     AND descuento_pct IS NULL) OR
      (tipo = N'PORCENTAJE' AND descuento_pct IS NOT NULL AND descuento_pct > 0 AND descuento_pct < 100 AND monto IS NULL)
    )
);
GO

/* ============================================================
   SP: aplica PROMOCIÓN por MONTO y registra el evento
   - Invoca productos_precio_incrementar
   ============================================================ */
CREATE OR ALTER PROCEDURE promociones_aplicar_monto
  @categoria_id  INT,
  @monto         DECIMAL(10,2),
  @fecha_inicio  DATE,
  @fecha_fin     DATE,
  @solo_activos  BIT = 1
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  BEGIN TRY
    IF @categoria_id IS NULL      THROW 53001, 'categoria_id requerido.', 1;
    IF @monto IS NULL OR @monto<=0 THROW 53002, 'Monto inválido (>0).', 1;
    IF @fecha_inicio IS NULL OR @fecha_fin IS NULL OR @fecha_fin < @fecha_inicio
      THROW 53003, 'Rango de fechas inválido.', 1;

    BEGIN TRAN;

      DECLARE @promo_id INT;
      INSERT INTO promociones_categoria (categoria_id, tipo, monto, fecha_inicio, fecha_fin, solo_activos)
      VALUES (@categoria_id, N'MONTO', @monto, @fecha_inicio, @fecha_fin, @solo_activos);
      SET @promo_id = SCOPE_IDENTITY();

      -- Aplica incremento por MONTO sobre la categoría
      EXEC productos_precio_incrementar @monto=@monto, @categoria_id=@categoria_id, @solo_activos=@solo_activos;

      UPDATE promociones_categoria
        SET aplicado_en = SYSUTCDATETIME()
      WHERE promo_id = @promo_id;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT>0 ROLLBACK;
    BEGIN TRY INSERT INTO logs(origen, mensaje) VALUES (N'promociones_aplicar_monto', ERROR_MESSAGE()); END TRY BEGIN CATCH END CATCH;
    THROW;
  END CATCH
END
GO

/* ============================================================
   SP: aplica PROMOCIÓN por PORCENTAJE y registra el evento
   - Invoca productos_agregar_descuento (@porcentaje)
   ============================================================ */
CREATE OR ALTER PROCEDURE promociones_aplicar_porcentaje
  @categoria_id  INT,
  @porcentaje    DECIMAL(5,2),  -- 0<%<100
  @fecha_inicio  DATE,
  @fecha_fin     DATE,
  @solo_activos  BIT = 1
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  BEGIN TRY
    IF @categoria_id IS NULL           THROW 53011, 'categoria_id requerido.', 1;
    IF @porcentaje IS NULL OR @porcentaje<=0 OR @porcentaje>=100
      THROW 53012, 'Porcentaje inválido (0<%<100).', 1;
    IF @fecha_inicio IS NULL OR @fecha_fin IS NULL OR @fecha_fin < @fecha_inicio
      THROW 53013, 'Rango de fechas inválido.', 1;

    BEGIN TRAN;

      DECLARE @promo_id INT;
      INSERT INTO promociones_categoria (categoria_id, tipo, descuento_pct, fecha_inicio, fecha_fin, solo_activos)
      VALUES (@categoria_id, N'PORCENTAJE', @porcentaje, @fecha_inicio, @fecha_fin, @solo_activos);
      SET @promo_id = SCOPE_IDENTITY();

      -- Aplica descuento PORCENTUAL sobre la categoría
      EXEC productos_agregar_descuento @porcentaje=@porcentaje, @categoria_id=@categoria_id, @solo_activos=@solo_activos;

      UPDATE promociones_categoria
        SET aplicado_en = SYSUTCDATETIME()
      WHERE promo_id = @promo_id;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT>0 ROLLBACK;
    BEGIN TRY INSERT INTO logs(origen, mensaje) VALUES (N'promociones_aplicar_porcentaje', ERROR_MESSAGE()); END TRY BEGIN CATCH END CATCH;
    THROW;
  END CATCH
END
GO


CREATE OR ALTER PROCEDURE buscar_id_para_login
  @termino_busqueda NVARCHAR(150)
AS
BEGIN
  SET NOCOUNT ON;

  IF @termino_busqueda IS NULL
     RETURN;

  -- 1) CLIENTES primero
  SELECT TOP (1)
    CAST(cliente_id AS NVARCHAR(50)) AS id,
    contrasena,
    'cliente' AS tipo
  FROM clientes
  WHERE estado = 1
    AND ( (LEN(@termino_busqueda) <= 20 AND cuenta = @termino_busqueda)
          OR email = @termino_busqueda );

  IF @@ROWCOUNT > 0
     RETURN;

  -- 2) EMPLEADOS si no hubo cliente
  SELECT TOP (1)
    CAST(empleado_id AS NVARCHAR(50)) AS id,
    contrasena,
    'empleado' AS tipo
  FROM empleados
  WHERE estado = 1
    AND ( (LEN(@termino_busqueda) <= 20 AND cuenta = @termino_busqueda)
          OR email = @termino_busqueda );
END;
GO

/* ===========================================================
   REPORTE: Ventas por producto × mes (PIVOT dinámico)
   =========================================================== */
CREATE OR ALTER PROCEDURE reporte_ventas_mensual_pivot
  @desde DATE,
  @hasta DATE
AS
BEGIN
  SET NOCOUNT ON;

  -- Columnas YYYY-MM a pivotear
  DECLARE @cols NVARCHAR(MAX);
  SELECT @cols =
    STRING_AGG(QUOTENAME(CONVERT(CHAR(7), s.fecha_pedido, 126)), ',')
    FROM (
      SELECT DISTINCT ped.fecha_pedido
      FROM pedidos ped
      WHERE ped.estado_pedido = N'Confirmado'
        AND ped.fecha_pedido >= @desde
        AND ped.fecha_pedido <= @hasta
    ) AS s;
  IF @cols IS NULL OR LEN(@cols)=0
  BEGIN
    -- esquema vacío útil
    SELECT TOP (0)
      CAST(NULL AS NVARCHAR(20))  AS producto_id,
      CAST(NULL AS NVARCHAR(255)) AS nombre_producto;
    RETURN;
  END

  DECLARE @sql NVARCHAR(MAX) = N'
    WITH base AS (
      SELECT dp.producto_id,
             p.nombre_producto,
             CONVERT(CHAR(7), ped.fecha_pedido, 126) AS ym,
             CAST(dp.cantidad * dp.precio_unitario AS DECIMAL(18,2)) AS total
      FROM detalle_pedidos dp
      JOIN pedidos        ped ON ped.pedido_id = dp.pedido_id
      JOIN productos      p   ON p.producto_id = dp.producto_id
      WHERE ped.estado_pedido = N''Confirmado''
        AND ped.fecha_pedido >= @desde
        AND ped.fecha_pedido <= @hasta
    )
    SELECT producto_id, nombre_producto, ' + @cols + N'
    FROM (
      SELECT producto_id, nombre_producto, ym, total
      FROM base
    ) src
    PIVOT (SUM(total) FOR ym IN (' + @cols + N')) pv
    ORDER BY nombre_producto;';

  EXEC sp_executesql @sql, N'@desde DATE, @hasta DATE', @desde=@desde, @hasta=@hasta;
END
GO

/* ==========================================
   REPORTE: TOP N ventas por producto
   ========================================== */
CREATE OR ALTER PROCEDURE reporte_top_ventas
  @desde DATE,
  @hasta DATE,
  @top   INT = 10
AS
BEGIN
  SET NOCOUNT ON;

  WITH agg AS (
    SELECT dp.producto_id, p.nombre_producto,
           SUM(CAST(dp.cantidad * dp.precio_unitario AS DECIMAL(18,2))) AS total_ventas
    FROM detalle_pedidos dp
    JOIN pedidos   ped ON ped.pedido_id = dp.pedido_id
    JOIN productos p   ON p.producto_id = dp.producto_id
    WHERE ped.estado_pedido = N'Confirmado'
      AND ped.fecha_pedido >= @desde
      AND ped.fecha_pedido <= @hasta
    GROUP BY dp.producto_id, p.nombre_producto
  ),
  rk AS (
    SELECT *, RANK() OVER (ORDER BY total_ventas DESC) AS rk
    FROM agg
  )
  SELECT TOP (@top) producto_id, nombre_producto, total_ventas, rk
  FROM rk
  ORDER BY rk, nombre_producto;
END
GO

/* ==================================================
   REPORTE: Frecuencia de compra por cliente (CASE)
   ================================================== */
CREATE OR ALTER PROCEDURE clientes_frecuencia_compra
  @desde DATE,
  @hasta DATE
AS
BEGIN
  SET NOCOUNT ON;

  WITH cte AS (
    SELECT ped.cliente_id,
           COUNT(DISTINCT ped.pedido_id) AS pedidos_cnt
    FROM pedidos ped
    WHERE ped.estado_pedido = N'Confirmado'
      AND ped.fecha_pedido >= @desde
      AND ped.fecha_pedido <= @hasta
    GROUP BY ped.cliente_id
  )
  SELECT c.cliente_id,
         COALESCE(cli.email, N'(sin email)') AS email,
         c.pedidos_cnt,
         CASE
           WHEN c.pedidos_cnt >= 12 THEN N'Frecuente'
           WHEN c.pedidos_cnt >= 4  THEN N'Ocasional'
           ELSE N'Esporádico'
         END AS categoria
  FROM cte c
  LEFT JOIN clientes cli ON cli.cliente_id = c.cliente_id
  ORDER BY c.pedidos_cnt DESC, c.cliente_id;
END
GO

/* =========================================================
   CONSULTA: Promoción activa aplicable por producto (categoría)
   ========================================================= */
CREATE OR ALTER PROCEDURE promociones_activas_por_producto
  @fecha  DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @fecha = COALESCE(@fecha, CAST(GETDATE() AS DATE));

  SELECT p.producto_id, p.nombre_producto, p.categoria_id, p.precio_unitario,
         pr.tipo, pr.monto, pr.descuento_pct, pr.fecha_inicio, pr.fecha_fin, pr.solo_activos
  FROM productos p
  OUTER APPLY (
    SELECT TOP (1) pc.*
    FROM promociones_categoria pc
    WHERE pc.categoria_id = p.categoria_id
      AND pc.fecha_inicio <= @fecha
      AND pc.fecha_fin    >= @fecha
    ORDER BY pc.creado_en DESC
  ) pr
  WHERE pr.promo_id IS NOT NULL
    AND (@fecha BETWEEN pr.fecha_inicio AND pr.fecha_fin);
END
GO

/* =========================================================
   ÍNDICE compuesto para análisis histórico de productos
   ========================================================= */

CREATE INDEX IX_productos_producto_fecha
  ON productos (producto_id, fecha_creacion)
  INCLUDE (precio_unitario, categoria_id, estado_producto);
GO

/* =========================================================
   ÍNDICE (filtrado) para buscar promociones activas por categoría
   ========================================================= */
CREATE INDEX IX_promos_categoria_intervalo_activo
  ON promociones_categoria (categoria_id, fecha_inicio, fecha_fin)
  WHERE solo_activos = 1;
GO

/* =========================================================
   (Opcional) Cobertura típica de joins en detalle_pedidos
   ========================================================= */
CREATE INDEX IX_detalle_producto_pedido
  ON detalle_pedidos (producto_id, pedido_id)
  INCLUDE (cantidad, precio_unitario);
GO
