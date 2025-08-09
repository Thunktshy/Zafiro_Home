/* ==============================================================
   Tablas, Triggers y Procedimientos para Empleados y sus logs
   ============================================================== */

-- Tabla principal de empleados
DROP TABLE IF EXISTS empleados;
GO
CREATE TABLE empleados (
    empleado_id      INT IDENTITY(1,1) PRIMARY KEY,
    cuenta           NVARCHAR(20)  UNIQUE NOT NULL,
    contrasena       NVARCHAR(255) NOT NULL,
    email            NVARCHAR(150) UNIQUE NOT NULL,
    puesto           NVARCHAR(30)  DEFAULT 'Administrador' NOT NULL,
    fecha_registro   DATETIME      DEFAULT GETDATE() NOT NULL,
    ultimo_login     DATETIME      NULL,
    estado           BIT       DEFAULT 1 NOT NULL CHECK (estado IN (0,1))
);
GO

-- Tabla INSERT de empleados (sin contraseña)
DROP TABLE IF EXISTS empleados_ins_log;
GO
CREATE TABLE empleados_ins_log (
    log_id          INT IDENTITY(1,1) PRIMARY KEY,
    empleado_id     INT,
    cuenta          NVARCHAR(20),
    email           NVARCHAR(150),
    puesto          NVARCHAR(30),
    fecha_registro  DATETIME,
    estado          BIT,
    fecha_log       DATETIME DEFAULT GETDATE()
);
GO

-- Tabla DELETE de empleados (sin contraseña)
DROP TABLE IF EXISTS empleados_del_log;
GO
CREATE TABLE empleados_del_log (
    log_id          INT IDENTITY(1,1) PRIMARY KEY,
    empleado_id     INT,
    cuenta          NVARCHAR(20),
    email           NVARCHAR(150),
    puesto          NVARCHAR(30),
    fecha_registro  DATETIME,
    estado          BIT,
    fecha_log       DATETIME DEFAULT GETDATE()
);
GO

-- Tabla UPDATE de empleados (sin contraseña)
DROP TABLE IF EXISTS empleados_upd_log;
GO
CREATE TABLE empleados_upd_log (
    log_id           INT IDENTITY(1,1) PRIMARY KEY,
    empleado_id      INT,
    cuenta_anterior  NVARCHAR(20),
    email_anterior   NVARCHAR(150),
    puesto_anterior  NVARCHAR(30),
    estado_anterior  BIT,
    cuenta_nuevo     NVARCHAR(20),
    email_nuevo      NVARCHAR(150),
    puesto_nuevo     NVARCHAR(30),
    estado_nuevo     BIT,
    fecha_log        DATETIME DEFAULT GETDATE()
);
GO

-- TRIGGER INSERT empleados
CREATE OR ALTER TRIGGER trg_ins_empleados
ON empleados
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO empleados_ins_log (empleado_id, cuenta, email, puesto, fecha_registro, estado)
    SELECT i.empleado_id, i.cuenta, i.email, i.puesto, i.fecha_registro, i.estado
    FROM inserted AS i;
END;
GO

-- TRIGGER DELETE empleados
CREATE OR ALTER TRIGGER trg_del_empleados
ON empleados
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO empleados_del_log (empleado_id, cuenta, email, puesto, fecha_registro, estado)
    SELECT d.empleado_id, d.cuenta, d.email, d.puesto, d.fecha_registro, d.estado
    FROM deleted AS d;
END;
GO

-- TRIGGER UPDATE empleados
CREATE OR ALTER TRIGGER trg_upd_empleados
ON empleados
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO empleados_upd_log (
        empleado_id,
        cuenta_anterior, email_anterior, puesto_anterior, estado_anterior,
        cuenta_nuevo, email_nuevo, puesto_nuevo, estado_nuevo
    )
    SELECT
        d.empleado_id,
        d.cuenta, d.email, d.puesto, d.estado,
        i.cuenta, i.email, i.puesto, i.estado
    FROM deleted AS d
    JOIN inserted AS i ON d.empleado_id = i.empleado_id
    WHERE
        ISNULL(d.cuenta,'') <> ISNULL(i.cuenta,'')
        OR ISNULL(d.email,'') <> ISNULL(i.email,'')
        OR ISNULL(d.puesto,'') <> ISNULL(i.puesto,'')
        OR ISNULL(d.estado,-1) <> ISNULL(i.estado,-1);
END;
GO

-- Procedimiento INSERT empleados
CREATE OR ALTER PROCEDURE empleados_insert
    @cuenta      NVARCHAR(20),
    @contrasena  NVARCHAR(255),
    @email       NVARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        
        IF EXISTS (SELECT 1 FROM empleados WHERE cuenta = @cuenta)
        BEGIN
            RAISERROR('La cuenta ya existe.', 16, 1);
            RETURN;
        END
        
        IF EXISTS (SELECT 1 FROM empleados WHERE email = @email)
        BEGIN
            RAISERROR('El email ya está registrado.', 16, 1);
            RETURN;
        END
        
        INSERT INTO empleados (cuenta, contrasena, email)
        VALUES (@cuenta, @contrasena, @email);
        
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'empleados_insert');
        THROW;
    END CATCH
END;
GO

-- Procedimiento UPDATE empleados
CREATE OR ALTER PROCEDURE empleados_update
    @empleado_id  INT,
    @cuenta      NVARCHAR(20),
    @email       NVARCHAR(150),
    @puesto      NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Validar existencia
        IF NOT EXISTS (SELECT 1 FROM empleados WHERE empleado_id = @empleado_id)
        BEGIN
            RAISERROR('empleado_id no existe.', 16, 1);
            RETURN;
        END
        
        -- Validar unicidad de cuenta
        IF EXISTS (
            SELECT 1 FROM empleados
            WHERE cuenta = @cuenta
              AND empleado_id <> @empleado_id
        )
        BEGIN
            RAISERROR('La cuenta ya está en uso por otro empleado.', 16, 1);
            RETURN;
        END
        
        -- Validar unicidad de email
        IF EXISTS (
            SELECT 1 FROM empleados
            WHERE email = @email
              AND empleado_id <> @empleado_id
        )
        BEGIN
            RAISERROR('El email ya está en uso por otro empleado.', 16, 1);
            RETURN;
        END
        
        UPDATE empleados
        SET
            cuenta = @cuenta,
            email = @email,
            puesto = @puesto
        WHERE empleado_id = @empleado_id;
        
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'empleados_update');
        THROW;
    END CATCH
END;
GO

-- Procedimiento DELETE empleados (hard delete)
CREATE OR ALTER PROCEDURE empleados_delete
    @empleado_id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        
        IF NOT EXISTS (SELECT 1 FROM empleados WHERE empleado_id = @empleado_id)
        BEGIN
            RAISERROR('empleado_id no existe.', 16, 1);
            RETURN;
        END
        
        DELETE FROM empleados
        WHERE empleado_id = @empleado_id;
        
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'empleados_delete');
        THROW;
    END CATCH
END;
GO

-- Procedimiento SOFT DELETE empleados (estado = 0)
CREATE OR ALTER PROCEDURE empleados_soft_delete
    @empleado_id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        
        IF NOT EXISTS (SELECT 1 FROM empleados WHERE empleado_id = @empleado_id)
        BEGIN
            RAISERROR('empleado_id no existe.', 16, 1);
            RETURN;
        END
        
        IF (SELECT estado FROM empleados WHERE empleado_id = @empleado_id) = 0
        BEGIN
            RAISERROR('El empleado ya está desactivado.', 16, 1);
            RETURN;
        END
        
        UPDATE empleados
        SET estado = 0
        WHERE empleado_id = @empleado_id;
        
        COMMIT TRANSACTION;
        
        SELECT 1 AS resultado, 'Empleado desactivado correctamente' AS mensaje;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'empleados_soft_delete');
        SELECT 0 AS resultado, ERROR_MESSAGE() AS mensaje;
    END CATCH
END;
GO

-- Procedimiento REACTIVAR empleados (estado = 1)
CREATE OR ALTER PROCEDURE empleados_reactivar
    @empleado_id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        
        IF NOT EXISTS (SELECT 1 FROM empleados WHERE empleado_id = @empleado_id)
        BEGIN
            RAISERROR('empleado_id no existe.', 16, 1);
            RETURN;
        END
        
        IF (SELECT estado FROM empleados WHERE empleado_id = @empleado_id) = 1
        BEGIN
            RAISERROR('El empleado ya está activo.', 16, 1);
            RETURN;
        END

        -- actualizar estado a 1
        UPDATE empleados
        SET estado = 1
        WHERE empleado_id = @empleado_id;
        
        COMMIT TRANSACTION;
        
        SELECT 1 AS resultado, 'Empleado reactivado correctamente' AS mensaje;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'empleados_reactivar');
        SELECT 0 AS resultado, ERROR_MESSAGE() AS mensaje;
    END CATCH
END;
GO




-- Procedimiento para Registrar Último Login
CREATE OR ALTER PROCEDURE empleados_registrar_login
    @empleado_id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        UPDATE empleados 
        SET ultimo_login = GETDATE()
        WHERE empleado_id = @empleado_id;
    END TRY
    BEGIN CATCH
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'empleados_registrar_login');
    END CATCH
END;
GO

-- Procedimiento para Obtener Empleado por ID
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
        CASE estado 
            WHEN 1 THEN 'Activo' 
            ELSE 'Inactivo' 
        END AS estado_descripcion
    FROM 
        empleados
    WHERE 
        empleado_id = @empleado_id;
END;
GO

/* ==============================================================
   Procedimiento para Buscar Empleados por cuenta o email
   ============================================================== */

CREATE OR ALTER PROCEDURE buscar_empleado
    @termino_busqueda NVARCHAR(150),  -- Puede ser parte de cuenta o email
    @solo_activos BIT = 1             -- Por defecto solo usuarios activos
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Seguridad: No mostrar contraseñas en los resultados
    SELECT 
        empleado_id
    FROM 

       empleados 

    WHERE 
        (cuenta LIKE '%' + @termino_busqueda + '%' OR 
         email LIKE '%' + @termino_busqueda + '%')
        AND (@solo_activos = 0 OR estado = 1)
    ORDER BY 
        cuenta;
END;
GO

-- Procedimiento para Obtener Contraseña Empleado por ID
CREATE OR ALTER PROCEDURE empleados_contrasena
    @empleado_id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        contrasena
    FROM 
        empleados
    WHERE 
        empleado_id = @empleado_id
        AND estado = 1;
END;
GO

/* Indices no cluster en empleados */
CREATE NONCLUSTERED INDEX idx_empleados_estado_cuenta
  ON empleados (estado, cuenta);

CREATE NONCLUSTERED INDEX idx_empleados_estado_email
  ON empleados (estado, email);

CREATE NONCLUSTERED INDEX idx_empleados_ultimo_login
  ON empleados (ultimo_login);

CREATE NONCLUSTERED INDEX idx_empleados_fecha_registro
  ON empleados (fecha_registro);
GO

/* Indices en logs generales */
CREATE NONCLUSTERED INDEX idx_logs_fecha
  ON logs (fecha);

CREATE NONCLUSTERED INDEX idx_logs_origen_nivel
  ON logs (origen, nivel);
GO

/* Indices en logs específicos de empleados */
CREATE NONCLUSTERED INDEX idx_empleados_ins_log_emp
  ON empleados_ins_log (empleado_id);

CREATE NONCLUSTERED INDEX idx_empleados_ins_log_fecha
  ON empleados_ins_log (fecha_log);

CREATE NONCLUSTERED INDEX idx_empleados_del_log_emp
  ON empleados_del_log (empleado_id);

CREATE NONCLUSTERED INDEX idx_empleados_del_log_fecha
  ON empleados_del_log (fecha_log);

CREATE NONCLUSTERED INDEX idx_empleados_upd_log_emp
  ON empleados_upd_log (empleado_id);

CREATE NONCLUSTERED INDEX idx_empleados_upd_log_fecha
  ON empleados_upd_log (fecha_log);
GO