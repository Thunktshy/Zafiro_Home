/* ===========================================
   tgrtotal_pedidos.sql  (versión corregida)
   - Proc: pedidos_recalc_total
   - Triggers AFTER I/U/D en detalle_pedidos
   - Recalculo masivo inicial
   =========================================== */

USE tiendaonline;
GO

/* ---------- PROC: Recalcula total del pedido ---------- */
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

/* ---------- Limpia triggers previos (si existen) ---------- */
IF OBJECT_ID('dbo.trg_dp_after_insert_recalc', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_dp_after_insert_recalc;
IF OBJECT_ID('dbo.trg_dp_after_update_recalc', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_dp_after_update_recalc;
IF OBJECT_ID('dbo.trg_dp_after_delete_recalc', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_dp_after_delete_recalc;
GO

/* ---------- INSERT: recalcular total ---------- */
CREATE TRIGGER dbo.trg_dp_after_insert_recalc
ON dbo.detalle_pedidos
AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @ids TABLE (pedido_id NVARCHAR(20) PRIMARY KEY);

  INSERT INTO @ids(pedido_id)
  SELECT DISTINCT i.pedido_id FROM inserted AS i;

  DECLARE @pid NVARCHAR(20);
  WHILE EXISTS (SELECT 1 FROM @ids)
  BEGIN
    SELECT TOP 1 @pid = pedido_id FROM @ids ORDER BY pedido_id;
    EXEC dbo.pedidos_recalc_total @pedido_id = @pid;
    DELETE FROM @ids WHERE pedido_id = @pid;
  END
END
GO

/* ---------- UPDATE: recalcular total ---------- */
CREATE TRIGGER dbo.trg_dp_after_update_recalc
ON dbo.detalle_pedidos
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @ids TABLE (pedido_id NVARCHAR(20) PRIMARY KEY);

  INSERT INTO @ids(pedido_id)
  SELECT DISTINCT pedido_id FROM inserted
  UNION
  SELECT DISTINCT pedido_id FROM deleted;

  DECLARE @pid NVARCHAR(20);
  WHILE EXISTS (SELECT 1 FROM @ids)
  BEGIN
    SELECT TOP 1 @pid = pedido_id FROM @ids ORDER BY pedido_id;
    EXEC dbo.pedidos_recalc_total @pedido_id = @pid;
    DELETE FROM @ids WHERE pedido_id = @pid;
  END
END
GO

/* ---------- DELETE: recalcular total ---------- */
CREATE TRIGGER dbo.trg_dp_after_delete_recalc
ON dbo.detalle_pedidos
AFTER DELETE
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @ids TABLE (pedido_id NVARCHAR(20) PRIMARY KEY);

  INSERT INTO @ids(pedido_id)
  SELECT DISTINCT d.pedido_id FROM deleted AS d;

  DECLARE @pid NVARCHAR(20);
  WHILE EXISTS (SELECT 1 FROM @ids)
  BEGIN
    SELECT TOP 1 @pid = pedido_id FROM @ids ORDER BY pedido_id;
    EXEC dbo.pedidos_recalc_total @pedido_id = @pid;
    DELETE FROM @ids WHERE pedido_id = @pid;
  END
END
GO

/* ---------- Recalculo masivo (una sola vez) ---------- */
PRINT 'Recalculando total_pedido para todos los pedidos...';
UPDATE p
SET p.total_pedido = ISNULL(x.suma, 0)
FROM dbo.pedidos AS p
OUTER APPLY (
  SELECT SUM(ISNULL(d.subtotal, d.cantidad * d.precio_unitario)) AS suma
  FROM dbo.detalle_pedidos AS d
  WHERE d.pedido_id = p.pedido_id
) AS x;
GO

/* -- Pruebas (opcional)
SELECT pedido_id, total_pedido FROM dbo.pedidos ORDER BY fecha_pedido DESC;
EXEC dbo.pedidos_recalc_total @pedido_id = 'ped-1';
SELECT total_pedido FROM dbo.pedidos WHERE pedido_id = 'ped-1';
*/
