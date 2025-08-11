-- Drop tables if they exist
DROP TABLE IF EXISTS imagenes_productos;
DROP TABLE IF EXISTS imagenes_categorias;

-- Create product images table
CREATE TABLE imagenes_productos (
    id INT IDENTITY(1,1) PRIMARY KEY,
    producto_id INT NOT NULL,  -- Assuming this links to a products table
    imagepath VARCHAR(255) NOT NULL
);

-- Create category images table
CREATE TABLE imagenes_categorias (
    id INT IDENTITY(1,1) PRIMARY KEY,
    categoria_id INT NOT NULL,  -- Assuming this links to a categories table
    imagepath VARCHAR(255) NOT NULL
);

-- Stored procedure to insert product image
CREATE PROCEDURE ingresar_imagen_producto
    @producto_id INT,
    @imagepath VARCHAR(255)
AS
BEGIN
    INSERT INTO imagenes_productos (producto_id, imagepath)
    VALUES (@producto_id, @imagepath);
END;

-- Stored procedure to insert category image
CREATE PROCEDURE ingresar_imagen_categoria
    @categoria_id INT,
    @imagepath VARCHAR(255)
AS
BEGIN
    INSERT INTO imagenes_categorias (categoria_id, imagepath)
    VALUES (@categoria_id, @imagepath);
END;