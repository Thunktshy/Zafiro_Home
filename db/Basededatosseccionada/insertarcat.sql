/* Inserta categorías
   - Idempotente: no duplica si ya existe el nombre.
*/
SET NOCOUNT ON;

INSERT INTO categorias (nombre_categoria, descripcion, image_path)
SELECT v.nombre, v.descripcion, v.image_path
FROM (VALUES
    (N'Electrodomésticos',            N'Grandes y pequeños electrodomésticos para cocina, aspiradoras, aires acondicionados, etc.', NULL),
    (N'Apps y Juegos',                N'Aplicaciones móviles y juegos para diversos dispositivos.', NULL),
    (N'Arte, Manualidades y Costura', N'Suministros para pintar, dibujar, esculpir, coser y tejer.', NULL),
    (N'Belleza y Cuidado Personal',   N'Cosméticos, cuidado de la piel y del cabello, fragancias y afeitado.', NULL),
    (N'Libros',                       N'Libros impresos de todos los géneros, ficción y no ficción.', NULL),
    (N'Celulares y Accesorios',       N'Smartphones, fundas, cargadores y accesorios inalámbricos.', NULL),
    (N'Ropa, Calzado y Joyería',      N'Prendas, zapatos, joyería y accesorios de moda.', NULL),
    (N'Computadoras',                 N'Laptops, desktops, tablets, monitores y componentes.', NULL),
    (N'Electrónicos',                 N'TVs, audífonos, dispositivos inteligentes, consolas y más.', NULL),
    (N'Salud y Hogar',                N'Vitaminas, suplementos, medicamentos OTC y artículos de limpieza.', NULL),
    (N'Hogar y Cocina',               N'Utensilios de cocina, electrodomésticos, decoración y muebles.', NULL),
    (N'Tienda Kindle',                N'eBooks para dispositivos y apps Kindle.', NULL),
    (N'Equipaje y Artículos de Viaje',N'Maletas, mochilas, bolsos y accesorios de viaje.', NULL),
    (N'Instrumentos Musicales',       N'Guitarras, teclados, baterías y accesorios musicales.', NULL),
    (N'Productos de Oficina',         N'Suministros como plumas, papel, impresoras y tóner.', NULL),
    (N'Patio, Jardín y Exteriores',   N'Herramientas de jardinería, muebles para patio, asadores y plantas.', NULL),
    (N'Productos para Mascotas',      N'Alimentos, juguetes, camas y accesorios para mascotas.', NULL),
    (N'Hogar Inteligente',            N'Enchufes inteligentes, cámaras, termostatos y dispositivos conectados.', NULL),
    (N'Deportes y Aire Libre',        N'Equipo deportivo, camping, fitness y actividades al aire libre.', NULL),
    (N'Herramientas y Mejoras del Hogar', N'Herramientas eléctricas y manuales, herrajes y materiales.', NULL),
    (N'Juguetes y Juegos',            N'Juguetes clásicos y electrónicos, juegos de mesa, rompecabezas y kits STEM.', NULL)
) AS v(nombre, descripcion, image_path)
WHERE NOT EXISTS (
    SELECT 1 FROM categorias c WHERE c.nombre_categoria = v.nombre
);