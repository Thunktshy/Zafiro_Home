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
  fecha_log            DATETIME      NOT NULL DEFAULT GETDATE()
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
  fecha_log            DATETIME      NOT NULL DEFAULT GETDATE()
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
  fecha_log            DATETIME      NOT NULL DEFAULT GETDATE()
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
