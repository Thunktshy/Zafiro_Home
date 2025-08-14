/* Inserta categorías
   - Idempotente: no duplica si ya existe el nombre.
*/
SET NOCOUNT ON;

INSERT INTO categorias (nombre_categoria, descripcion)
SELECT v.nombre, v.descripcion
FROM (VALUES
    (N'Electrodomésticos',            N'Grandes y pequeños electrodomésticos para cocina, aspiradoras, aires acondicionados, etc.'),
    (N'Apps y Juegos',                N'Aplicaciones móviles y juegos para diversos dispositivos.'),
    (N'Arte, Manualidades y Costura', N'Suministros para pintar, dibujar, esculpir, coser y tejer.'),
    (N'Belleza y Cuidado Personal',   N'Cosméticos, cuidado de la piel y del cabello, fragancias y afeitado.'),
    (N'Libros',                       N'Libros impresos de todos los géneros, ficción y no ficción.'),
    (N'Celulares y Accesorios',       N'Smartphones, fundas, cargadores y accesorios inalámbricos.'),
    (N'Ropa, Calzado y Joyería',      N'Prendas, zapatos, joyería y accesorios de moda.'),
    (N'Computadoras',                 N'Laptops, desktops, tablets, monitores y componentes.'),
    (N'Electrónicos',                 N'TVs, audífonos, dispositivos inteligentes, consolas y más.'),
    (N'Salud y Hogar',                N'Vitaminas, suplementos, medicamentos OTC y artículos de limpieza.'),
    (N'Hogar y Cocina',               N'Utensilios de cocina, electrodomésticos, decoración y muebles.'),
    (N'Tienda Kindle',                N'eBooks para dispositivos y apps Kindle.'),
    (N'Equipaje y Artículos de Viaje',N'Maletas, mochilas, bolsos y accesorios de viaje.'),
    (N'Instrumentos Musicales',       N'Guitarras, teclados, baterías y accesorios musicales.'),
    (N'Productos de Oficina',         N'Suministros como plumas, papel, impresoras y tóner.'),
    (N'Patio, Jardín y Exteriores',   N'Herramientas de jardinería, muebles para patio, asadores y plantas.'),
    (N'Productos para Mascotas',      N'Alimentos, juguetes, camas y accesorios para mascotas.'),
    (N'Hogar Inteligente',            N'Enchufes inteligentes, cámaras, termostatos y dispositivos conectados.'),
    (N'Deportes y Aire Libre',        N'Equipo deportivo, camping, fitness y actividades al aire libre.'),
    (N'Herramientas y Mejoras del Hogar', N'Herramientas eléctricas y manuales, herrajes y materiales.'),
    (N'Juguetes y Juegos',            N'Juguetes clásicos y electrónicos, juegos de mesa, rompecabezas y kits STEM.')
) AS v(nombre, descripcion)
WHERE NOT EXISTS (
    SELECT 1 FROM categorias c WHERE c.nombre_categoria = v.nombre
);