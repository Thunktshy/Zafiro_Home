/* ===========================================================
   REPORTES – Técnicas avanzadas (PIVOT, RANK, CASE, JOINs)
   =========================================================== */

-- Ventas mensuales por producto (PIVOT dinámico por 'yyyy-MM')
-- Suma CANTIDADES confirmadas en el rango
CREATE OR ALTER PROCEDURE reporte_ventas_mensual_pivot
  @desde DATETIME,
  @hasta DATETIME
AS
BEGIN
  SET NOCOUNT ON;

  /* Columnas dinámicas por mes (yyyy-MM) dentro del rango */
  DECLARE @cols NVARCHAR(MAX);
  SELECT @cols = STRING_AGG(QUOTENAME(CONVERT(char(7), p.fecha_pedido, 126)), ',')
  FROM (
    SELECT DISTINCT CONVERT(char(7), p.fecha_pedido, 126) AS ym
    FROM pedidos p
    WHERE p.estado_pedido = N'Confirmado'
      AND p.fecha_pedido >= @desde AND p.fecha_pedido <= @hasta
  ) m
  OPTION (RECOMPILE);

  IF @cols IS NULL OR LTRIM(RTRIM(@cols)) = ''
  BEGIN
    -- Sin meses -> devolver vacío consistente
    SELECT TOP 0 producto_id, nombre_producto, categoria_id WHERE 1=0;
    RETURN;
  END

  DECLARE @sql NVARCHAR(MAX) = N'
    WITH src AS (
      SELECT
        dp.producto_id,
        pr.nombre_producto,
        pr.categoria_id,
        CONVERT(char(7), p.fecha_pedido, 126) AS ym,
        SUM(dp.cantidad) AS qty
      FROM detalle_pedidos dp
      JOIN pedidos p    ON p.pedido_id = dp.pedido_id
      JOIN productos pr ON pr.producto_id = dp.producto_id
      WHERE p.estado_pedido = N''Confirmado''
        AND p.fecha_pedido >= @desde AND p.fecha_pedido <= @hasta
      GROUP BY dp.producto_id, pr.nombre_producto, pr.categoria_id, CONVERT(char(7), p.fecha_pedido, 126)
    )
    SELECT producto_id, nombre_producto, categoria_id, ' + @cols + ',
           -- totales auxiliares
           ISNULL( ' + REPLACE(@cols, '],[', ']) + ISNULL([') + '], 0) AS total_unidades
    FROM src
    PIVOT (
      SUM(qty) FOR ym IN (' + @cols + ')
    ) AS pvt
    ORDER BY total_unidades DESC, nombre_producto ASC
  ';

  EXEC sp_executesql @sql, N'@desde DATETIME, @hasta DATETIME', @desde=@desde, @hasta=@hasta;
END;
GO

-- Top ventas por producto (ranking por IMPORTE) en rango
CREATE OR ALTER PROCEDURE reporte_top_ventas
  @desde DATETIME,
  @hasta DATETIME,
  @limit INT = 10
AS
BEGIN
  SET NOCOUNT ON;

  WITH agg AS (
    SELECT
      dp.producto_id,
      pr.nombre_producto,
      pr.categoria_id,
      SUM(CAST(dp.cantidad AS DECIMAL(18,2)) * dp.precio_unitario) AS total_importe,
      SUM(dp.cantidad) AS total_unidades
    FROM detalle_pedidos dp
    JOIN pedidos p    ON p.pedido_id = dp.pedido_id
    JOIN productos pr ON pr.producto_id = dp.producto_id
    WHERE p.estado_pedido = N'Confirmado'
      AND p.fecha_pedido >= @desde AND p.fecha_pedido <= @hasta
    GROUP BY dp.producto_id, pr.nombre_producto, pr.categoria_id
  ),
  r AS (
    SELECT *,
      RANK() OVER (ORDER BY total_importe DESC) AS ranking
    FROM agg
  )
  SELECT *
  FROM r
  WHERE ranking <= ISNULL(@limit, 10)
  ORDER BY ranking;
END;
GO

-- Clasificación de clientes por frecuencia (CASE) en rango
CREATE OR ALTER PROCEDURE clientes_frecuencia_compra
  @desde DATETIME,
  @hasta DATETIME
AS
BEGIN
  SET NOCOUNT ON;

  WITH cte AS (
    SELECT
      c.cliente_id,
      COUNT(DISTINCT p.pedido_id) AS pedidos_confirmados,
      SUM(CAST(dp.cantidad AS DECIMAL(18,2)) * dp.precio_unitario) AS total_importe
    FROM clientes c
    JOIN pedidos p        ON p.cliente_id = c.cliente_id
    JOIN detalle_pedidos dp ON dp.pedido_id = p.pedido_id
    WHERE p.estado_pedido = N'Confirmado'
      AND p.fecha_pedido >= @desde AND p.fecha_pedido <= @hasta
    GROUP BY c.cliente_id
  )
  SELECT
    cliente_id,
    pedidos_confirmados,
    total_importe,
    CASE
      WHEN pedidos_confirmados >= 12 THEN N'Frecuente'
      WHEN pedidos_confirmados >= 4  THEN N'Ocasional'
      ELSE N'Esporádico'
    END AS clasificacion
  FROM cte
  ORDER BY pedidos_confirmados DESC, total_importe DESC;
END;
GO

-- Historial de compras por cliente (cabecera + líneas "aplanadas")
-- Devuelve filas a nivel detalle con datos del pedido
CREATE OR ALTER PROCEDURE historial_compras_por_cliente
  @cliente_id NVARCHAR(20),
  @desde DATETIME,
  @hasta DATETIME
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @cid NVARCHAR(20) = CASE WHEN LEFT(@cliente_id,3)='cl-' THEN @cliente_id ELSE CONCAT('cl-', @cliente_id) END;

  IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = @cid)
    THROW 54001, N'El cliente no existe.', 1;

  SELECT
    p.pedido_id,
    p.fecha_pedido,
    p.estado_pedido,
    dp.producto_id,
    pr.nombre_producto,
    dp.cantidad,
    dp.precio_unitario,
    CAST(dp.cantidad AS DECIMAL(18,2)) * dp.precio_unitario AS subtotal
  FROM pedidos p
  JOIN detalle_pedidos dp ON dp.pedido_id = p.pedido_id
  JOIN productos pr       ON pr.producto_id = dp.producto_id
  WHERE p.cliente_id = @cid
    AND p.fecha_pedido >= @desde AND p.fecha_pedido <= @hasta
  ORDER BY p.fecha_pedido DESC, p.pedido_id, dp.producto_id;
END;
GO
