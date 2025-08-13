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
