CREATE OR ALTER PROCEDURE dbo.pedidos_recalc_total
  @pedido_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @pid NVARCHAR(20) =
    CASE WHEN @pedido_id LIKE 'ped-%' THEN @pedido_id
         ELSE CONCAT('ped-', @pedido_id) END;

  UPDATE p
  SET p.total_pedido = ISNULL(x.suma, 0)
  FROM dbo.pedidos AS p
  OUTER APPLY (
    SELECT SUM(ISNULL(d.subtotal, d.cantidad * d.precio_unitario)) AS suma
    FROM dbo.detalle_pedidos AS d
    WHERE d.pedido_id = p.pedido_id
  ) AS x
  WHERE p.pedido_id = @pid;
END
GO

/* ===========================================================
   TRIGGERS EN detalle_pedidos
   - Llaman a dbo.pedidos_recalc_total en I/U/D (después del cambio)
   - Compatibles con operaciones por lote (manejan múltiples pedidos)
   =========================================================== */

/* INSERT */
CREATE TRIGGER dbo.trg_dp_after_insert_recalc
ON dbo.detalle_pedidos
AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;

  ;WITH D AS (
    SELECT DISTINCT i.pedido_id FROM inserted AS i
  )
  SELECT 1; -- marcador (evita advertencias de conjunto de resultados vacío)

  DECLARE @pid NVARCHAR(20);
  DECLARE c CURSOR LOCAL FAST_FORWARD FOR
    SELECT pedido_id FROM D;

  OPEN c;
  FETCH NEXT FROM c INTO @pid;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    EXEC dbo.pedidos_recalc_total @pedido_id = @pid;
    FETCH NEXT FROM c INTO @pid;
  END
  CLOSE c; DEALLOCATE c;
END
GO

/* UPDATE */
CREATE TRIGGER dbo.trg_dp_after_update_recalc
ON dbo.detalle_pedidos
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;

  ;WITH D AS (
    SELECT pedido_id FROM inserted
    UNION
    SELECT pedido_id FROM deleted
  )
  SELECT 1;

  DECLARE @pid NVARCHAR(20);
  DECLARE c CURSOR LOCAL FAST_FORWARD FOR
    SELECT DISTINCT pedido_id FROM D;

  OPEN c;
  FETCH NEXT FROM c INTO @pid;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    EXEC dbo.pedidos_recalc_total @pedido_id = @pid;
    FETCH NEXT FROM c INTO @pid;
  END
  CLOSE c; DEALLOCATE c;
END
GO

/* DELETE */
CREATE TRIGGER dbo.trg_dp_after_delete_recalc
ON dbo.detalle_pedidos
AFTER DELETE
AS
BEGIN
  SET NOCOUNT ON;

  ;WITH D AS (
    SELECT DISTINCT d.pedido_id FROM deleted AS d
  )
  SELECT 1;

  DECLARE @pid NVARCHAR(20);
  DECLARE c CURSOR LOCAL FAST_FORWARD FOR
    SELECT pedido_id FROM D;

  OPEN c;
  FETCH NEXT FROM c INTO @pid;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    EXEC dbo.pedidos_recalc_total @pedido_id = @pid;
    FETCH NEXT FROM c INTO @pid;
  END
  CLOSE c; DEALLOCATE c;
END
GO


UPDATE p
SET p.total_pedido = ISNULL(x.suma, 0)
FROM dbo.pedidos AS p
OUTER APPLY (
  SELECT SUM(ISNULL(d.subtotal, d.cantidad * d.precio_unitario)) AS suma
  FROM dbo.detalle_pedidos AS d
  WHERE d.pedido_id = p.pedido_id
) AS x;
GO
