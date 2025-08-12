
CREATE OR ALTER PROCEDURE buscar_id_para_login
  @termino_busqueda NVARCHAR(150)
AS
BEGIN
  SET NOCOUNT ON;

  IF @termino_busqueda IS NULL
     RETURN;

  -- 1) CLIENTES primero
  SELECT TOP (1)
    CAST(cliente_id AS NVARCHAR(50)) AS id,
    contrasena,
    'cliente' AS tipo
  FROM clientes
  WHERE estado = 1
    AND ( (LEN(@termino_busqueda) <= 20 AND cuenta = @termino_busqueda)
          OR email = @termino_busqueda );

  IF @@ROWCOUNT > 0
     RETURN;

  -- 2) EMPLEADOS si no hubo cliente
  SELECT TOP (1)
    CAST(empleado_id AS NVARCHAR(50)) AS id,
    contrasena,
    'empleado' AS tipo
  FROM empleados
  WHERE estado = 1
    AND ( (LEN(@termino_busqueda) <= 20 AND cuenta = @termino_busqueda)
          OR email = @termino_busqueda );
END;
GO

