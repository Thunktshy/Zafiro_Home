/* ==============================================================
   PEDIDOS y DETALLE_PEDIDOS – triggers y procedimientos
   ============================================================== */

-- ==============================================
-- Tabla de logs generales 
-- ==============================================
DROP TABLE IF EXISTS logs;
GO
CREATE TABLE logs (
    log_id  INT IDENTITY(1,1) PRIMARY KEY,
    fecha   DATETIME       NOT NULL DEFAULT GETDATE(),
    origen  NVARCHAR(100)  NOT NULL, -- Nombre del procedimiento
    mensaje NVARCHAR(MAX)  NOT NULL  -- Texto del error SQL
);
GO

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
    fecha_log      DATETIME      NOT NULL DEFAULT GETDATE()
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
    fecha_log      DATETIME      NOT NULL DEFAULT GETDATE()
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
    fecha_log           DATETIME      NOT NULL DEFAULT GETDATE()
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
    fecha_log       DATETIME      NOT NULL DEFAULT GETDATE()
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
    fecha_log       DATETIME      NOT NULL DEFAULT GETDATE()
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
    fecha_log           DATETIME      NOT NULL DEFAULT GETDATE()
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

-- Confirmar pedido por id
CREATE OR ALTER PROCEDURE pedidos_confirmar
  @id NVARCHAR(20)  -- admite 'ped-123' o '123'
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN;

    DECLARE @pid NVARCHAR(20) = CASE WHEN LEFT(@id,4)='ped-' THEN @id ELSE CONCAT('ped-',@id) END;

    IF NOT EXISTS (SELECT 1 FROM pedidos WHERE pedido_id = @pid)
      THROW 53002, 'El pedido no existe.', 1;

    -- Debe tener líneas y total > 0
    IF NOT EXISTS (SELECT 1 FROM detalle_pedidos WHERE pedido_id = @pid)
      THROW 53003, 'No se puede confirmar un pedido sin artículos.', 1;

    IF (SELECT total_pedido FROM pedidos WHERE pedido_id = @pid) <= 0
      THROW 53004, 'El total debe ser > 0 para confirmar.', 1;

    UPDATE pedidos
    SET estado_pedido = N'Confirmado'
    WHERE pedido_id = @pid;

    COMMIT;

    SELECT pedido_id, estado_pedido FROM pedidos WHERE pedido_id = @pid;
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

