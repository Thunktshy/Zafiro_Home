/* ===========================================================
   Inserta 3 productos por categoría (stock < 100)
   - Idempotente: evita duplicar por (nombre_producto + categoria_id)
   - Detecta columna de precio: precio_unitario o precio
   - Requiere que categorías ya existan
   =========================================================== */
SET NOCOUNT ON;
SET XACT_ABORT ON;

--------------------------------------------
-- 1) Catálogo de productos (3 por categoría)
--------------------------------------------
DECLARE @prods TABLE (
  nombre_categoria NVARCHAR(150),
  nombre_producto  NVARCHAR(255),
  precio           DECIMAL(10,2),
  stock            INT,
  descripcion      NVARCHAR(400)
);

INSERT INTO @prods (nombre_categoria, nombre_producto, precio, stock, descripcion)
VALUES
-- Electrodomésticos
(N'Electrodomésticos', N'Licuadora 600W vaso de vidrio', 1299.00, 24, N'Licuadora de 5 velocidades con vaso de 1.5L.'),
(N'Electrodomésticos', N'Horno tostador 20L con temporizador', 1499.00, 35, N'Horno tostador con control de temperatura y bandeja.'),
(N'Electrodomésticos', N'Aspiradora ciclónica 1.2L', 1699.00, 18, N'Aspiradora compacta con filtro lavable.'),

-- Apps y Juegos
(N'Apps y Juegos', N'Suscripción App Pro 12 meses', 499.00, 99, N'Clave prepago para 12 meses de servicio.'),
(N'Apps y Juegos', N'Juego móvil edición premium', 159.00, 80, N'Código digital con niveles adicionales.'),
(N'Apps y Juegos', N'Tarjeta prepago 100 unidades', 199.00, 60, N'Tarjeta de prepago para apps y juegos.'),

-- Arte, Manualidades y Costura
(N'Arte, Manualidades y Costura', N'Set de pinceles 12 pzs', 249.00, 42, N'Pinceles de cerdas mixtas para acrílico/acuarela.'),
(N'Arte, Manualidades y Costura', N'Kit de acuarelas 24 colores', 329.00, 27, N'Colores de alta pigmentación, incluye estuche.'),
(N'Arte, Manualidades y Costura', N'Rollos de hilo algodón 10 m', 119.00, 75, N'Pack de 5 rollos de hilo 100% algodón.'),

-- Belleza y Cuidado Personal
(N'Belleza y Cuidado Personal', N'Crema hidratante 200 ml', 199.00, 50, N'Con ácido hialurónico, piel normal a seca.'),
(N'Belleza y Cuidado Personal', N'Shampoo fortificante 500 ml', 159.00, 64, N'Con biotina y cafeína.'),
(N'Belleza y Cuidado Personal', N'Recortadora de barba USB', 549.00, 22, N'Incluye 4 peines guía y bolsa.'),

-- Libros
(N'Libros', N'Novela contemporánea T.1', 299.00, 40, N'Edición rústica, 320 páginas.'),
(N'Libros', N'Guía de cocina rápida', 349.00, 28, N'Recetas en 30 minutos, fotos a color.'),
(N'Libros', N'Aprende SQL en 24 horas', 399.00, 31, N'Práctico para principiantes e intermedios.'),

-- Celulares y Accesorios
(N'Celulares y Accesorios', N'Cargador rápido 25W USB-C', 299.00, 55, N'Compatible con PD y PPS.'),
(N'Celulares y Accesorios', N'Cable trenzado USB-C 2 m', 149.00, 70, N'Resistente, transferencia y carga rápida.'),
(N'Celulares y Accesorios', N'Funda antigolpes Modelo X', 249.00, 33, N'Protección 360°, bordes elevados.'),

-- Ropa, Calzado y Joyería
(N'Ropa, Calzado y Joyería', N'Playera algodón unisex M', 199.00, 66, N'100% algodón, corte regular.'),
(N'Ropa, Calzado y Joyería', N'Tenis running talla 42', 899.00, 21, N'Amortiguación ligera para entrenamiento.'),
(N'Ropa, Calzado y Joyería', N'Collar acero inoxidable', 349.00, 48, N'Cadena hipoalergénica, 45 cm.'),

-- Computadoras
(N'Computadoras', N'Mouse inalámbrico 1600 dpi', 259.00, 58, N'Receptor USB, hasta 12 meses de batería.'),
(N'Computadoras', N'Teclado mecánico 87 teclas', 1299.00, 19, N'Switches táctiles, anti-ghosting.'),
(N'Computadoras', N'SSD NVMe 1 TB', 1799.00, 12, N'PCIe 3.0, lectura hasta 3000 MB/s.'),

-- Electrónicos
(N'Electrónicos', N'Audífonos Bluetooth over-ear', 799.00, 26, N'Cancelación pasiva, 30 h de batería.'),
(N'Electrónicos', N'Smart TV Stick FHD', 899.00, 25, N'Streaming con control por voz.'),
(N'Electrónicos', N'Power bank 20,000 mAh', 699.00, 44, N'Doble salida USB y USB-C.'),

-- Salud y Hogar
(N'Salud y Hogar', N'Multivitamínico 90 tabletas', 249.00, 73, N'Fórmula diaria completa.'),
(N'Salud y Hogar', N'Termómetro infrarrojo', 499.00, 29, N'Lectura en 1 segundo, sin contacto.'),
(N'Salud y Hogar', N'Gel antibacterial 1 L', 129.00, 62, N'70% alcohol, con humectantes.'),

-- Hogar y Cocina
(N'Hogar y Cocina', N'Sartén antiadherente 28 cm', 499.00, 36, N'Recubrimiento libre de PFOA.'),
(N'Hogar y Cocina', N'Juego de cuchillos 6 pzs', 749.00, 17, N'Incluye bloque de madera.'),
(N'Hogar y Cocina', N'Organizador plástico 3 niveles', 299.00, 52, N'Para baño o cocina.'),

-- Tienda Kindle
(N'Tienda Kindle', N'eBook Novela histórica', 149.00, 99, N'Archivo digital compatible con Kindle.'),
(N'Tienda Kindle', N'eBook Emprendimiento ágil', 199.00, 88, N'Estrategias prácticas de negocio.'),
(N'Tienda Kindle', N'eBook Programación SQL', 179.00, 77, N'Consultas, joins y optimización.'),

-- Equipaje y Artículos de Viaje
(N'Equipaje y Artículos de Viaje', N'Maleta 24" ABS', 1999.00, 14, N'Ruedas 360°, candado TSA.'),
(N'Equipaje y Artículos de Viaje', N'Mochila antirrobo 20 L', 899.00, 39, N'Puerto USB externo, resistente al agua.'),
(N'Equipaje y Artículos de Viaje', N'Candado TSA 2 pzs', 249.00, 61, N'Cuerpo metálico, combinación de 3 dígitos.'),

-- Instrumentos Musicales
(N'Instrumentos Musicales', N'Ukelele soprano', 1199.00, 23, N'Tapa de tilo, afinadores metálicos.'),
(N'Instrumentos Musicales', N'Teclado 61 teclas', 2499.00, 11, N'100 ritmos, salida de audífonos.'),
(N'Instrumentos Musicales', N'Soporte plegable para guitarra', 299.00, 47, N'Altura ajustable, goma antideslizante.'),

-- Productos de Oficina
(N'Productos de Oficina', N'Papel carta 500 hojas', 189.00, 72, N'Blancura 92, 75 g/m².'),
(N'Productos de Oficina', N'Tóner negro modelo 12A', 799.00, 16, N'Rendimiento 2000 páginas aprox.'),
(N'Productos de Oficina', N'Agenda 2025 tapa dura', 259.00, 58, N'Vista semanal, separadores.'),

-- Patio, Jardín y Exteriores
(N'Patio, Jardín y Exteriores', N'Manguera expandible 15 m', 399.00, 35, N'Incluye pistola con 7 funciones.'),
(N'Patio, Jardín y Exteriores', N'Set herramientas jardín 5 pzs', 349.00, 41, N'Pala, rastrillo, tijeras y más.'),
(N'Patio, Jardín y Exteriores', N'Lámpara solar exterior 2 pzs', 459.00, 38, N'Sensor de movimiento, IP65.'),

-- Productos para Mascotas
(N'Productos para Mascotas', N'Croquetas adulto 5 kg', 589.00, 22, N'Con proteínas y omega 3.'),
(N'Productos para Mascotas', N'Juguete de cuerda mediano', 129.00, 66, N'Resistente a mordidas.'),
(N'Productos para Mascotas', N'Cama para mascota mediana', 699.00, 19, N'Funda desmontable y lavable.'),

-- Hogar Inteligente
(N'Hogar Inteligente', N'Enchufe Wi-Fi inteligente', 299.00, 57, N'Control por app y asistentes.'),
(N'Hogar Inteligente', N'Cámara IP 1080p interior', 799.00, 24, N'Detección de movimiento, visión nocturna.'),
(N'Hogar Inteligente', N'Sensor de puerta Zigbee', 269.00, 48, N'Notificaciones en tiempo real.'),

-- Deportes y Aire Libre
(N'Deportes y Aire Libre', N'Balón de fútbol N°5', 349.00, 54, N'Costura a máquina, uso recreativo.'),
(N'Deportes y Aire Libre', N'Colchoneta yoga 10 mm', 399.00, 31, N'Espuma de alta densidad, antideslizante.'),
(N'Deportes y Aire Libre', N'Botella deportiva 1 L', 189.00, 76, N'Libre de BPA, tapa a prueba de fugas.'),

-- Herramientas y Mejoras del Hogar
(N'Herramientas y Mejoras del Hogar', N'Taladro percutor 600 W', 999.00, 28, N'Mandril 13 mm, con maletín.'),
(N'Herramientas y Mejoras del Hogar', N'Juego de brocas 15 pzs', 229.00, 63, N'Para metal, madera y concreto.'),
(N'Herramientas y Mejoras del Hogar', N'Nivel láser de línea', 1299.00, 13, N'Base magnética, autonivelante.'),

-- Juguetes y Juegos
(N'Juguetes y Juegos', N'Bloques de construcción 300 pzs', 499.00, 37, N'Compatibles con marcas estándar.'),
(N'Juguetes y Juegos', N'Rompecabezas 1000 piezas', 349.00, 42, N'Cartón premium, acabado mate.'),
(N'Juguetes y Juegos', N'Juego de mesa de estrategia', 699.00, 18, N'Para 2–4 jugadores, 60–90 min.');

--------------------------------------------
-- 2) Preparar fuente con categoria_id
--------------------------------------------
IF OBJECT_ID('tempdb..#src') IS NOT NULL DROP TABLE #src;

SELECT
  p.nombre_producto,
  c.categoria_id,
  p.precio,
  p.stock,
  p.descripcion
INTO #src
FROM @prods AS p
JOIN dbo.categorias AS c
  ON c.nombre_categoria = p.nombre_categoria;

--------------------------------------------
-- 3) Detectar columna de precio y hacer INSERT
--------------------------------------------
DECLARE @precioCol SYSNAME =
  CASE
    WHEN COL_LENGTH('dbo.productos','precio_unitario') IS NOT NULL THEN N'precio_unitario'
    WHEN COL_LENGTH('dbo.productos','precio')          IS NOT NULL THEN N'precio'
    ELSE NULL
  END;

IF @precioCol IS NULL
  THROW 52050, N'dbo.productos debe tener la columna "precio_unitario" o "precio".', 1;

DECLARE @sql NVARCHAR(MAX) =
N'INSERT INTO dbo.productos (nombre_producto, categoria_id, ' + QUOTENAME(@precioCol) + N', stock, descripcion)
  SELECT s.nombre_producto, s.categoria_id, s.precio, s.stock, s.descripcion
  FROM #src AS s
  WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.productos AS x
    WHERE x.nombre_producto = s.nombre_producto
      AND x.categoria_id   = s.categoria_id
  );';

EXEC sys.sp_executesql @sql;

-- Limpieza
DROP TABLE #src;

PRINT N'✅ Inserción completada (3 productos por categoría, stock < 100, sin duplicar).';
