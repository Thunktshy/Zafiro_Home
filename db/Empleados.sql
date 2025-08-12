/* ==============================================================
   EMPLEADOS – Tablas, Triggers, Procedimientos e Índices
   (alineado a estructura unificada de logs)
   ============================================================== */

-- ==============================================
-- Tabla de logs (global)  [ejecutar una sola vez en todo el proyecto]
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
  fecha_log      DATETIME NOT NULL DEFAULT GETDATE()
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
  fecha_log      DATETIME NOT NULL DEFAULT GETDATE()
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
  fecha_log         DATETIME NOT NULL DEFAULT GETDATE()
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
  CONSTRAINT fk_emppass_emp FOREIGN KEY (empleado_id) REFERENCES empleados(empleado_id)
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
