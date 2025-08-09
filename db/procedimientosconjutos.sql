
IF OBJECT_ID('buscar_id_para_login', 'P') IS NOT NULL
    DROP PROCEDURE buscar_id_para_login;
GO

CREATE PROCEDURE buscar_id_para_login
    --Establecer Parametros de busqueda como vacios
    --para que sean opcionales
    @cuenta NVARCHAR(20)  = NULL,
    @email  NVARCHAR(150) = NULL
AS
BEGIN
    SET NOCOUNT ON;


    -- Validación básica de parámetros

    -- Devolver respuesta vacia si no hay parametros
    IF (COALESCE(LTRIM(RTRIM(@cuenta)), '') = '')
       AND (COALESCE(LTRIM(RTRIM(@email)), '') = '')
    BEGIN
        RETURN;  
    END

    -- Si se proporciono un email, validar formato
    IF @email IS NOT NULL
       AND @email NOT LIKE '%_@__%.__%'
    BEGIN
        RETURN;  -- formato inválido, , devolver nada
    END

    -- Si se proporciono una cuenta, validar longitud <= 20
    IF @cuenta IS NOT NULL
       AND LEN(@cuenta) > 20
    BEGIN
        RETURN;  -- demasiado largo, devolver nada
    END

    -- Intentar buscar en CLIENTES
    SELECT
        cliente_id,
        contrasena
    FROM clientes
    WHERE estado = 1
      AND (
            (@cuenta IS NOT NULL AND cuenta = @cuenta)
         OR (@email   IS NOT NULL AND email  = @email)
          );

    IF @@ROWCOUNT > 0
        RETURN;  -- Devolver cliente si hay coincidencia

    -- Si no hay en CLIENTES, buscar en EMPLEADOS
    SELECT
        empleado_id,
        contrasena
    FROM empleados
    WHERE estado = 1
      AND (
            (@cuenta IS NOT NULL AND cuenta = @cuenta)
         OR (@email   IS NOT NULL AND email  = @email)
          );

    -- Si tampoco hay resultados aqui devolver resultado vacio
END;
GO
