/* ==============================================================
   PEDIDOS y DETALLE_PEDIDOS – esquema, triggers y procedimientos
   Estilo alineado a categorias.sql
   ============================================================== */

SET XACT_ABORT ON;
GO

/* ========================
   SECUENCIA PARA PEDIDOS
   ======================== */
IF OBJECT_ID('seq_pedidos', 'SO') IS NOT NULL
    DROP SEQUENCE seq_pedidos;
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
IF OBJECT_ID('pedidos', 'U') IS NOT NULL
    DROP TABLE pedidos;
GO
CREATE TABLE pedidos (
    pedido_id      NVARCHAR(10)  PRIMARY KEY,                     -- ejemplo: ped-1
    cliente_id     NVARCHAR(10)  NOT NULL,
    fecha_pedido   DATETIME      NOT NULL DEFAULT GETDATE(),
    estado_pedido  NVARCHAR(20)  NOT NULL DEFAULT N'Por confirmar',
    total_pedido   DECIMAL(10,2) NOT NULL DEFAULT 0,
    metodo_pago    NVARCHAR(20)  NULL,
    CONSTRAINT fk_pedidos_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(cliente_id),
    CONSTRAINT ck_pedidos_estado
        CHECK (estado_pedido IN (N'Por confirmar', N'Pendiente', N'Completado', N'Cancelado'))
);
GO

/* Cobertura de consultas por estado y fecha */
CREATE NONCLUSTERED INDEX ix_pedidos_estado_fecha
ON pedidos(estado_pedido, fecha_pedido DESC)
INCLUDE (cliente_id, total_pedido, metodo_pago);
GO

/* ========================
   TABLA: DETALLE_PEDIDOS
   ======================== */
IF OBJECT_ID('detalle_pedidos', 'U') IS NOT NULL
    DROP TABLE detalle_pedidos;
GO
CREATE TABLE detalle_pedidos (
    detalle_id       INT IDENTITY(1,1) PRIMARY KEY,
    pedido_id        NVARCHAR(10)  NOT NULL,
    producto_id      NVARCHAR(20)  NOT NULL, -- normalizado para empatar con productos.producto_id
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

/* Una línea por producto por pedido (opcional, facilita upsert) */
CREATE UNIQUE INDEX ux_detalle_pedido_producto
ON detalle_pedidos(pedido_id, producto_id);
GO

/* Cobertura para recálculo rápido del total */
CREATE NONCLUSTERED INDEX ix_detalle_pedidos_pedido
ON detalle_pedidos(pedido_id)
INCLUDE (cantidad, precio_unitario);
GO

/* ========================
   LOGS (estilo categorias.sql)
   ======================== */

-- PEDIDOS logs
IF OBJECT_ID('pedidos_insert_log','U') IS NOT NULL DROP TABLE pedidos_insert_log;
IF OBJECT_ID('pedidos_delete_log','U') IS NOT NULL DROP TABLE pedidos_delete_log;
IF OBJECT_ID('pedidos_update_log','U') IS NOT NULL DROP TABLE pedidos_update_log;
GO

CREATE TABLE pedidos_insert_log (
    log_id         INT IDENTITY(1,1) PRIMARY KEY,
    pedido_id      NVARCHAR(10),
    cliente_id     NVARCHAR(10),
    fecha_pedido   DATETIME,
    estado_pedido  NVARCHAR(20),
    total_pedido   DECIMAL(10,2),
    metodo_pago    NVARCHAR(20),
    fecha_log      DATETIME      DEFAULT GETDATE(),
    usuario        NVARCHAR(50)  DEFAULT SYSTEM_USER
);
GO

CREATE TABLE pedidos_delete_log (
    log_id         INT IDENTITY(1,1) PRIMARY KEY,
    pedido_id      NVARCHAR(10),
    cliente_id     NVARCHAR(10),
    fecha_pedido   DATETIME,
    estado_pedido  NVARCHAR(20),
    total_pedido   DECIMAL(10,2),
    metodo_pago    NVARCHAR(20),
    fecha_log      DATETIME      DEFAULT GETDATE(),
    usuario        NVARCHAR(50)  DEFAULT SYSTEM_USER
);
GO

CREATE TABLE pedidos_update_log (
    log_id              INT IDENTITY(1,1) PRIMARY KEY,
    pedido_id           NVARCHAR(10),
    -- valores anteriores
    cliente_id_ant      NVARCHAR(10),
    fecha_pedido_ant    DATETIME,
    estado_pedido_ant   NVARCHAR(20),
    total_pedido_ant    DECIMAL(10,2),
    metodo_pago_ant     NVARCHAR(20),
    -- valores nuevos
    cliente_id_nvo      NVARCHAR(10),
    fecha_pedido_nvo    DATETIME,
    estado_pedido_nvo   NVARCHAR(20),
    total_pedido_nvo    DECIMAL(10,2),
    metodo_pago_nvo     NVARCHAR(20),
    fecha_log           DATETIME      DEFAULT GETDATE(),
    usuario             NVARCHAR(50)  DEFAULT SYSTEM_USER
);
GO

-- DETALLE_PEDIDOS logs (opcional pero recomendable)
IF OBJECT_ID('detalle_pedidos_insert_log','U') IS NOT NULL DROP TABLE detalle_pedidos_insert_log;
IF OBJECT_ID('detalle_pedidos_delete_log','U') IS NOT NULL DROP TABLE detalle_pedidos_delete_log;
IF OBJECT_ID('detalle_pedidos_update_log','U') IS NOT NULL DROP TABLE detalle_pedidos_update_log;
GO

CREATE TABLE detalle_pedidos_insert_log (
    log_id          INT IDENTITY(1,1) PRIMARY KEY,
    detalle_id      INT,
    pedido_id       NVARCHAR(10),
    producto_id     NVARCHAR(20),
    cantidad        INT,
    precio_unitario DECIMAL(10,2),
    fecha_log       DATETIME      DEFAULT GETDATE(),
    usuario         NVARCHAR(50)  DEFAULT SYSTEM_USER
);
GO

CREATE TABLE detalle_pedidos_delete_log (
    log_id          INT IDENTITY(1,1) PRIMARY KEY,
    detalle_id      INT,
    pedido_id       NVARCHAR(10),
    producto_id     NVARCHAR(20),
    cantidad        INT,
    precio_unitario DECIMAL(10,2),
    fecha_log       DATETIME      DEFAULT GETDATE(),
    usuario         NVARCHAR(50)  DEFAULT SYSTEM_USER
);
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
    fecha_log           DATETIME      DEFAULT GETDATE(),
    usuario             NVARCHAR(50)  DEFAULT SYSTEM_USER
);
GO

/* ========================
   TRIGGERS PEDIDOS
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
   TRIGGERS DETALLE_PEDIDOS
   - Log + recalcular total del pedido
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
   PROCEDIMIENTOS
   ======================== */

-- Crear pedido (encabezado); devuelve el nuevo pedido_id
CREATE OR ALTER PROCEDURE pedidos_insert
    @cliente_id   NVARCHAR(10),
    @metodo_pago  NVARCHAR(20) = NULL
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
        INSERT INTO logs(mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'pedidos_insert');
        THROW;
    END CATCH
END;
GO

/* ========================
   Añadir producto (controla stock)
   ======================== */
CREATE OR ALTER PROCEDURE pedido_add_item
    @pedido_id        NVARCHAR(10),
    @producto_id      NVARCHAR(20),
    @cantidad         INT,
    @precio_unitario  DECIMAL(10,2) = NULL   -- si NULL, toma precio de productos
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;

        IF @cantidad IS NULL OR @cantidad <= 0
            THROW 54000, 'La cantidad debe ser > 0.', 1;

        DECLARE @estado NVARCHAR(20);
        SELECT @estado = estado_pedido FROM pedidos WHERE pedido_id = @pedido_id;
        IF @estado IS NULL
            THROW 54002, 'El pedido no existe.', 1;
        IF @estado IN (N'Completado', N'Cancelado')
            THROW 54003, 'El pedido no permite modificaciones.', 1;

        -- Bloqueo la fila del producto para lectura/actualización segura del stock
        DECLARE @stock_actual INT, @precio DECIMAL(10,2);
        SELECT @stock_actual = p.stock,
               @precio       = COALESCE(@precio_unitario, p.precio_unitario)
        FROM productos AS p WITH (UPDLOCK, ROWLOCK)
        WHERE p.producto_id = @producto_id;

        IF @stock_actual IS NULL
            THROW 54004, 'El producto no existe.', 1;

        -- ¿La línea ya existe? Sumo cantidad, pero descuesto del stock solo lo adicional
        DECLARE @cantidad_actual INT, @precio_linea DECIMAL(10,2);
        SELECT @cantidad_actual = d.cantidad,
               @precio_linea   = d.precio_unitario
        FROM detalle_pedidos AS d WITH (UPDLOCK, ROWLOCK)
        WHERE d.pedido_id = @pedido_id AND d.producto_id = @producto_id;

        DECLARE @a_descontar INT, @precio_final DECIMAL(10,2);
        IF @cantidad_actual IS NULL
        BEGIN
            SET @a_descontar = @cantidad;
            SET @precio_final = @precio;
            IF @a_descontar > @stock_actual
                THROW 54001, 'Stock insuficiente para añadir la línea.', 1;

            INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario)
            VALUES (@pedido_id, @producto_id, @cantidad, @precio_final);
        END
        ELSE
        BEGIN
            SET @a_descontar = @cantidad;               -- solo lo que se incrementa ahora
            SET @precio_final = @precio_linea;          -- conservar precio de la línea
            IF @a_descontar > @stock_actual
                THROW 54005, 'Stock insuficiente para incrementar la cantidad.', 1;

            UPDATE detalle_pedidos
            SET cantidad = cantidad + @cantidad
            WHERE pedido_id = @pedido_id AND producto_id = @producto_id;
        END

        -- Descontar stock del producto
        UPDATE productos
        SET stock = stock - @a_descontar
        WHERE producto_id = @producto_id;

        COMMIT;
        -- total_pedido se recalcula por triggers de detalle
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'pedido_add_item');
        THROW;
    END CATCH
END;
GO

/* ========================
   Quitar/restar producto (reintegra stock)
   ======================== */
CREATE OR ALTER PROCEDURE pedido_remove_item
    @pedido_id    NVARCHAR(10),
    @producto_id  NVARCHAR(20),
    @cantidad     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;

        DECLARE @estado NVARCHAR(20);
        SELECT @estado = estado_pedido FROM pedidos WHERE pedido_id = @pedido_id;
        IF @estado IS NULL
            THROW 54006, 'El pedido no existe.', 1;
        IF @estado IN (N'Completado', N'Cancelado')
            THROW 54007, 'El pedido no permite modificaciones.', 1;

        -- Bloqueo la línea y el producto
        DECLARE @actual INT;
        SELECT @actual = d.cantidad
        FROM detalle_pedidos AS d WITH (UPDLOCK, ROWLOCK)
        WHERE d.pedido_id = @pedido_id AND d.producto_id = @producto_id;

        IF @actual IS NULL
            THROW 54008, 'El producto no está en el pedido.', 1;

        IF @cantidad IS NULL OR @cantidad >= @actual
        BEGIN
            -- Devolver todo el stock de esa línea y eliminarla
            UPDATE p WITH (UPDLOCK, ROWLOCK)
            SET p.stock = p.stock + @actual
            FROM productos p
            WHERE p.producto_id = @producto_id;

            DELETE FROM detalle_pedidos
            WHERE pedido_id = @pedido_id AND producto_id = @producto_id;
        END
        ELSE
        BEGIN
            IF @cantidad <= 0
                THROW 54009, 'La cantidad a restar debe ser > 0.', 1;

            UPDATE detalle_pedidos
            SET cantidad = cantidad - @cantidad
            WHERE pedido_id = @pedido_id AND producto_id = @producto_id;

            -- Devolver el stock removido
            UPDATE p WITH (UPDLOCK, ROWLOCK)
            SET p.stock = p.stock + @cantidad
            FROM productos p
            WHERE p.producto_id = @producto_id;
        END

        COMMIT;
        -- total_pedido se recalcula por triggers de detalle
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'pedido_remove_item');
        THROW;
    END CATCH
END;
GO

/* ========================
   Cambiar estado del pedido
   - Completar: exige líneas y total > 0
   - Cancelar: reintegra TODO el stock del pedido (una sola vez)
   - No se puede salir de Completado/Cancelado
   ======================== */
CREATE OR ALTER PROCEDURE pedidos_set_estado
    @pedido_id NVARCHAR(10),
    @estado    NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;

        IF @estado NOT IN (N'Por confirmar', N'Pendiente', N'Completado', N'Cancelado')
            THROW 54010, 'Estado no válido.', 1;

        DECLARE @estado_actual NVARCHAR(20);
        SELECT @estado_actual = estado_pedido FROM pedidos WHERE pedido_id = @pedido_id;

        IF @estado_actual IS NULL
            THROW 54011, 'El pedido no existe.', 1;

        IF @estado_actual IN (N'Completado', N'Cancelado')
            THROW 54012, 'No se puede modificar un pedido Completado/Cancelado.', 1;

        IF @estado = N'Completado'
        BEGIN
            -- Debe tener líneas y total > 0
            IF NOT EXISTS (SELECT 1 FROM detalle_pedidos WHERE pedido_id = @pedido_id)
                THROW 54013, 'No se puede completar un pedido sin artículos.', 1;

            IF (SELECT total_pedido FROM pedidos WHERE pedido_id = @pedido_id) <= 0
                THROW 54014, 'El total debe ser > 0 para completar.', 1;

            -- Verificación adicional de integridad: ningún stock negativo
            IF EXISTS (SELECT 1 FROM productos WHERE stock < 0)
                THROW 54015, 'Stock inconsistente: existen productos con stock negativo.', 1;
        END
        ELSE IF @estado = N'Cancelado'
        BEGIN
            -- Reintegrar stock de todas las líneas del pedido
            ;WITH lineas AS (
                SELECT producto_id, SUM(cantidad) AS cant
                FROM detalle_pedidos WITH (HOLDLOCK)
                WHERE pedido_id = @pedido_id
                GROUP BY producto_id
            )
            UPDATE p WITH (UPDLOCK, ROWLOCK)
            SET p.stock = p.stock + l.cant
            FROM productos p
            JOIN lineas l ON l.producto_id = p.producto_id;
        END

        UPDATE pedidos
        SET estado_pedido = @estado
        WHERE pedido_id = @pedido_id;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        INSERT INTO logs (mensaje, nivel, origen)
        VALUES (ERROR_MESSAGE(), 'ERROR', 'pedidos_set_estado');
        THROW;
    END CATCH
END;
GO

/* ========================
   Verificación de configuración del pedido
   - Lista problemas: productos inexistentes (si alguien insertó mal) o líneas sin cantidad/precio
   ======================== */
CREATE OR ALTER PROCEDURE pedidos_verificar_configuracion
    @pedido_id NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;

    -- Productos inexistentes (por FK no debería ocurrir, pero por si hay datos legacy)
    SELECT 'PRODUCTO_INEXISTENTE' AS tipo,
           d.detalle_id, d.producto_id, d.cantidad, d.precio_unitario
    FROM detalle_pedidos d
    LEFT JOIN productos p ON p.producto_id = d.producto_id
    WHERE d.pedido_id = @pedido_id AND p.producto_id IS NULL

    UNION ALL

    -- Cantidades o precios inválidos
    SELECT 'LINEA_INVALIDA' AS tipo,
           d.detalle_id, d.producto_id, d.cantidad, d.precio_unitario
    FROM detalle_pedidos d
    WHERE d.pedido_id = @pedido_id
      AND (d.cantidad <= 0 OR d.precio_unitario < 0);
END;
GO

/* ========================
   Consultas de lectura
   ======================== */

-- Obtener encabezado del pedido
CREATE OR ALTER PROCEDURE pedidos_get
    @pedido_id NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.pedido_id, p.cliente_id, p.fecha_pedido, p.estado_pedido, p.total_pedido, p.metodo_pago
    FROM pedidos p
    WHERE p.pedido_id = @pedido_id;
END;
GO

-- Obtener detalles del pedido con JOIN a productos (nombre, etc.)
CREATE OR ALTER PROCEDURE pedidos_get_detalles
    @pedido_id NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        d.detalle_id,
        d.pedido_id,
        d.producto_id,
        p.nombre_producto,
        d.cantidad,
        d.precio_unitario,
        d.subtotal
    FROM detalle_pedidos d
    JOIN productos p ON p.producto_id = d.producto_id
    WHERE d.pedido_id = @pedido_id
    ORDER BY d.detalle_id;
END;
GO
