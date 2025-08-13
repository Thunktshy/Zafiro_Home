
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
  fecha_log  DATETIME      NOT NULL DEFAULT GETDATE()
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
  fecha_log  DATETIME      NOT NULL DEFAULT GETDATE()
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
  fecha_log         DATETIME      NOT NULL DEFAULT GETDATE()
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
