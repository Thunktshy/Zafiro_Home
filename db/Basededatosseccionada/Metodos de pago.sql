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
  fecha_log      DATETIME      NOT NULL DEFAULT GETDATE()
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
  fecha_log      DATETIME      NOT NULL DEFAULT GETDATE()
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
  fecha_log             DATETIME      NOT NULL DEFAULT GETDATE()
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
