/* ==============================================================
   IMÁGENES – productos, categorías (sin logs de auditoría)
   ============================================================== */

DROP TABLE IF EXISTS imagenes_categorias;
DROP TABLE IF EXISTS imagenes_productos;
GO

/* ========================
   Tablas
   ======================== */

-- Imágenes de productos (FK a productos.producto_id  NVARCHAR(20) con prefijo 'prd-')
CREATE TABLE imagenes_productos (
  id           INT            IDENTITY(1,1) PRIMARY KEY,
  producto_id  NVARCHAR(20)   NOT NULL,
  image_path   NVARCHAR(255)  NOT NULL,
  fecha_alta   DATETIME       NOT NULL DEFAULT GETDATE(),
  CONSTRAINT fk_img_prod_producto
    FOREIGN KEY (producto_id) REFERENCES productos(producto_id)
);
GO

-- Imágenes de categorías (FK a categorias.categoria_id INT)
CREATE TABLE imagenes_categorias (
  id            INT            IDENTITY(1,1) PRIMARY KEY,
  categoria_id  INT            NOT NULL,
  image_path    NVARCHAR(255)  NOT NULL,
  fecha_alta    DATETIME       NOT NULL DEFAULT GETDATE(),
  CONSTRAINT fk_img_cat_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorias(categoria_id)
);
GO

/* ========================
   Índices recomendados
   ======================== */
CREATE NONCLUSTERED INDEX IX_imagenes_productos_producto
  ON imagenes_productos (producto_id);
GO
CREATE NONCLUSTERED INDEX IX_imagenes_categorias_categoria
  ON imagenes_categorias (categoria_id);
GO

/* ========================
   PROCEDIMIENTOS – PRODUCTOS
   ======================== */

-- INSERT (acepta 'prd-123' o '123')
CREATE OR ALTER PROCEDURE imagenes_productos_insert
  @producto_id NVARCHAR(20),
  @image_path  NVARCHAR(255)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    DECLARE @pid NVARCHAR(20) =
      CASE WHEN LEFT(@producto_id,4)='prd-' THEN @producto_id ELSE CONCAT('prd-',@producto_id) END;

    IF NOT EXISTS (SELECT 1 FROM productos WHERE producto_id = @pid)
      THROW 60001, 'El producto no existe.', 1;

    INSERT INTO imagenes_productos (producto_id, image_path)
    VALUES (@pid, @image_path);

    SELECT SCOPE_IDENTITY() AS id, @pid AS producto_id;
  END TRY
  BEGIN CATCH
    INSERT INTO logs (origen, mensaje) VALUES (N'imagenes_productos_insert', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- UPDATE (puede mover la imagen a otro producto y/o cambiar ruta)
CREATE OR ALTER PROCEDURE imagenes_productos_update
  @id          INT,
  @producto_id NVARCHAR(20) = NULL,  -- opcional
  @image_path  NVARCHAR(255) = NULL  -- opcional
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM imagenes_productos WHERE id = @id)
      THROW 60002, 'La imagen de producto no existe.', 1;

    DECLARE @pid NVARCHAR(20) = NULL;
    IF @producto_id IS NOT NULL
    BEGIN
      SET @pid =
        CASE WHEN LEFT(@producto_id,4)='prd-' THEN @producto_id ELSE CONCAT('prd-',@producto_id) END;
      IF NOT EXISTS (SELECT 1 FROM productos WHERE producto_id = @pid)
        THROW 60003, 'El producto destino no existe.', 1;
    END

    UPDATE imagenes_productos
    SET producto_id = COALESCE(@pid, producto_id),
        image_path  = COALESCE(@image_path, image_path)
    WHERE id = @id;

    SELECT id, producto_id, image_path FROM imagenes_productos WHERE id = @id;
  END TRY
  BEGIN CATCH
    INSERT INTO logs (origen, mensaje) VALUES (N'imagenes_productos_update', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- DELETE
CREATE OR ALTER PROCEDURE imagenes_productos_delete
  @id INT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM imagenes_productos WHERE id = @id)
      THROW 60004, 'La imagen de producto no existe.', 1;

    DELETE FROM imagenes_productos WHERE id = @id;
  END TRY
  BEGIN CATCH
    INSERT INTO logs (origen, mensaje) VALUES (N'imagenes_productos_delete', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- GET por id
CREATE OR ALTER PROCEDURE imagenes_productos_get_by_id
  @id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, producto_id, image_path, fecha_alta
  FROM imagenes_productos
  WHERE id = @id;
END;
GO

-- GET por producto (acepta 'prd-123' o '123')
CREATE OR ALTER PROCEDURE imagenes_productos_get_by_producto
  @producto_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @pid NVARCHAR(20) =
    CASE WHEN LEFT(@producto_id,4)='prd-' THEN @producto_id ELSE CONCAT('prd-',@producto_id) END;

  SELECT id, producto_id, image_path, fecha_alta
  FROM imagenes_productos
  WHERE producto_id = @pid
  ORDER BY id;
END;
GO

-- GET all
CREATE OR ALTER PROCEDURE imagenes_productos_get_all
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, producto_id, image_path, fecha_alta
  FROM imagenes_productos
  ORDER BY id;
END;
GO

/* ========================
   PROCEDIMIENTOS – CATEGORÍAS
   ======================== */

-- INSERT
CREATE OR ALTER PROCEDURE imagenes_categorias_insert
  @categoria_id INT,
  @image_path   NVARCHAR(255)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM categorias WHERE categoria_id = @categoria_id)
      THROW 60011, 'La categoría no existe.', 1;

    INSERT INTO imagenes_categorias (categoria_id, image_path)
    VALUES (@categoria_id, @image_path);

    SELECT SCOPE_IDENTITY() AS id, @categoria_id AS categoria_id;
  END TRY
  BEGIN CATCH
    INSERT INTO logs (origen, mensaje) VALUES (N'imagenes_categorias_insert', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- UPDATE
CREATE OR ALTER PROCEDURE imagenes_categorias_update
  @id           INT,
  @categoria_id INT = NULL,
  @image_path   NVARCHAR(255) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM imagenes_categorias WHERE id = @id)
      THROW 60012, 'La imagen de categoría no existe.', 1;

    IF @categoria_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categorias WHERE categoria_id = @categoria_id)
      THROW 60013, 'La categoría destino no existe.', 1;

    UPDATE imagenes_categorias
    SET categoria_id = COALESCE(@categoria_id, categoria_id),
        image_path   = COALESCE(@image_path, image_path)
    WHERE id = @id;

    SELECT id, categoria_id, image_path FROM imagenes_categorias WHERE id = @id;
  END TRY
  BEGIN CATCH
    INSERT INTO logs (origen, mensaje) VALUES (N'imagenes_categorias_update', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- DELETE
CREATE OR ALTER PROCEDURE imagenes_categorias_delete
  @id INT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM imagenes_categorias WHERE id = @id)
      THROW 60014, 'La imagen de categoría no existe.', 1;

    DELETE FROM imagenes_categorias WHERE id = @id;
  END TRY
  BEGIN CATCH
    INSERT INTO logs (origen, mensaje) VALUES (N'imagenes_categorias_delete', ERROR_MESSAGE());
    THROW;
  END CATCH
END;
GO

-- GET por id
CREATE OR ALTER PROCEDURE imagenes_categorias_get_by_id
  @id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, categoria_id, image_path, fecha_alta
  FROM imagenes_categorias
  WHERE id = @id;
END;
GO

-- GET por categoría
CREATE OR ALTER PROCEDURE imagenes_categorias_get_by_categoria
  @categoria_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, categoria_id, image_path, fecha_alta
  FROM imagenes_categorias
  WHERE categoria_id = @categoria_id
  ORDER BY id;
END;
GO

-- GET all
CREATE OR ALTER PROCEDURE imagenes_categorias_get_all
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, categoria_id, image_path, fecha_alta
  FROM imagenes_categorias
  ORDER BY id;
END;
GO


/* ========================
   Sinónimos para compatibilidad con tus nombres previos
   (opcional: mantienen la API original de tu snippet)
   ======================== */

-- Producto
CREATE OR ALTER PROCEDURE ingresar_imagen_producto
  @producto_id NVARCHAR(20),
  @imagepath   NVARCHAR(255)
AS
BEGIN
  EXEC imagenes_productos_insert @producto_id = @producto_id, @image_path = @imagepath;
END;
GO

-- Categoría
CREATE OR ALTER PROCEDURE ingresar_imagen_categoria
  @categoria_id INT,
  @imagepath    NVARCHAR(255)
AS
BEGIN
  EXEC imagenes_categorias_insert @categoria_id = @categoria_id, @image_path = @imagepath;
END;
GO
