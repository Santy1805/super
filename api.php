<?php
// =====================================================
//  SUPERMERCADO LÍDER — API REST
//  Archivo: api.php
// =====================================================

// --- CONFIGURACIÓN DE BASE DE DATOS ---
define('DB_HOST', 'localhost');
define('DB_NAME', 'supermercado_lider');
define('DB_USER', 'root');       // ← cambiá por tu usuario
define('DB_PASS', '');           // ← cambiá por tu contraseña
define('ADMIN_KEY', 'lider2024'); // ← clave secreta para el panel admin

// --- HEADERS ---
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

// --- CONEXIÓN ---
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        // Crear tablas si no existen
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS productos (
                id        INT AUTO_INCREMENT PRIMARY KEY,
                nombre    VARCHAR(120) NOT NULL,
                precio    DECIMAL(10,2) NOT NULL,
                categoria VARCHAR(30) NOT NULL,
                icono     TEXT NOT NULL DEFAULT '📦',
                activo    TINYINT(1) NOT NULL DEFAULT 1
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS pedidos (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                cliente    VARCHAR(120) NOT NULL DEFAULT 'Cliente',
                items      MEDIUMTEXT NOT NULL,
                total      DECIMAL(10,2) NOT NULL DEFAULT 0,
                estado     ENUM('pendiente','entregado') NOT NULL DEFAULT 'pendiente',
                creado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                entregado_en DATETIME NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
    }
    return $pdo;
}

// --- RESPUESTAS ---
function ok(mixed $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode(['ok' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

function error(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// --- VERIFICACIÓN ADMIN ---
function requireAdmin(): void {
    $key = $_SERVER['HTTP_X_ADMIN_KEY'] ?? '';
    if ($key !== ADMIN_KEY) {
        error('No autorizado', 401);
    }
}

// --- VALIDACIÓN PRODUCTO ---
function validateProduct(array $data): array {
    $categoriasValidas = ['frutas', 'verduras', 'bebidas', 'limpieza', 'panaderia', 'otros'];

    $nombre    = trim($data['nombre'] ?? '');
    $precio    = floatval($data['precio'] ?? 0);
    $categoria = trim($data['categoria'] ?? '');
    $icono     = trim($data['icono'] ?? '📦');
    $activo    = isset($data['activo']) ? (int)(bool)$data['activo'] : 1;

    if (empty($nombre))                             error('El nombre es obligatorio.');
    if (strlen($nombre) > 120)                      error('El nombre no puede superar 120 caracteres.');
    if ($precio <= 0)                               error('El precio debe ser mayor a 0.');
    if (!in_array($categoria, $categoriasValidas))  error('Categoría inválida.');

    return compact('nombre', 'precio', 'categoria', 'icono', 'activo');
}

// --- ROUTER ---
// Funciona con CUALQUIER servidor: usa PATH_INFO, REQUEST_URI o query string
$method = $_SERVER['REQUEST_METHOD'];

$resource = '';
$id       = null;

// Método 1: PATH_INFO (api.php/productos/1)
if (!empty($_SERVER['PATH_INFO'])) {
    $parts    = explode('/', trim($_SERVER['PATH_INFO'], '/'));
    $resource = $parts[0] ?? '';
    $id       = isset($parts[1]) && is_numeric($parts[1]) ? (int)$parts[1] : null;
}

// Método 2: REQUEST_URI — buscar "productos" o "pedidos" en la URL
if (empty($resource)) {
    $uri   = $_SERVER['REQUEST_URI'] ?? '';
    $clean = parse_url($uri, PHP_URL_PATH);
    $parts = explode('/', trim($clean, '/'));
    foreach ($parts as $i => $part) {
        if ($part === 'productos' || $part === 'pedidos') {
            $resource = $part;
            $id = isset($parts[$i+1]) && is_numeric($parts[$i+1]) ? (int)$parts[$i+1] : null;
            break;
        }
    }
}

// Método 3: query string (?recurso=pedidos&id=1)  ← más compatible
if (empty($resource) && !empty($_GET['recurso'])) {
    $resource = $_GET['recurso'];
    $id       = isset($_GET['id']) && is_numeric($_GET['id']) ? (int)$_GET['id'] : null;
}

if (!in_array($resource, ['productos', 'pedidos'])) {
    error('Ruta no encontrada. Usá: api.php?recurso=productos o api.php?recurso=pedidos', 404);
}

$db   = getDB();
$body = json_decode(file_get_contents('php://input'), true) ?? [];

// =====================================================
//  PRODUCTOS
// =====================================================

if ($resource === 'productos') {

    if ($method === 'GET' && $id === null) {
        $soloActivos = !isset($_SERVER['HTTP_X_ADMIN_KEY']) || $_SERVER['HTTP_X_ADMIN_KEY'] !== ADMIN_KEY;
        $sql = $soloActivos
            ? 'SELECT id, nombre, precio, categoria, icono FROM productos WHERE activo = 1 ORDER BY categoria, nombre'
            : 'SELECT * FROM productos ORDER BY categoria, nombre';
        $stmt = $db->query($sql);
        ok($stmt->fetchAll());
    }

    if ($method === 'GET' && $id !== null) {
        $stmt = $db->prepare('SELECT * FROM productos WHERE id = ?');
        $stmt->execute([$id]);
        $producto = $stmt->fetch();
        if (!$producto) error('Producto no encontrado.', 404);
        ok($producto);
    }

    if ($method === 'POST') {
        requireAdmin();
        $data = validateProduct($body);
        $stmt = $db->prepare(
            'INSERT INTO productos (nombre, precio, categoria, icono, activo) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$data['nombre'], $data['precio'], $data['categoria'], $data['icono'], $data['activo']]);
        $nuevo = $db->lastInsertId();
        ok(['id' => (int)$nuevo, ...$data], 201);
    }

    if ($method === 'PUT' && $id !== null) {
        requireAdmin();
        $check = $db->prepare('SELECT id FROM productos WHERE id = ?');
        $check->execute([$id]);
        if (!$check->fetch()) error('Producto no encontrado.', 404);

        $data = validateProduct($body);
        $stmt = $db->prepare(
            'UPDATE productos SET nombre=?, precio=?, categoria=?, icono=?, activo=? WHERE id=?'
        );
        $stmt->execute([$data['nombre'], $data['precio'], $data['categoria'], $data['icono'], $data['activo'], $id]);
        ok(['id' => $id, ...$data]);
    }

    if ($method === 'DELETE' && $id !== null) {
        requireAdmin();
        $check = $db->prepare('SELECT id FROM productos WHERE id = ?');
        $check->execute([$id]);
        if (!$check->fetch()) error('Producto no encontrado.', 404);

        $db->prepare('DELETE FROM productos WHERE id = ?')->execute([$id]);
        ok(['eliminado' => $id]);
    }
}

// =====================================================
//  PEDIDOS
// =====================================================

if ($resource === 'pedidos') {

    // GET /pedidos           → listar todos (admin)
    // GET /pedidos?estado=   → filtrar por estado (admin)
    if ($method === 'GET' && $id === null) {
        requireAdmin();
        $estado = $_GET['estado'] ?? null;
        if ($estado && in_array($estado, ['pendiente', 'entregado'])) {
            $stmt = $db->prepare('SELECT * FROM pedidos WHERE estado = ? ORDER BY creado_en DESC');
            $stmt->execute([$estado]);
        } else {
            $stmt = $db->query('SELECT * FROM pedidos ORDER BY creado_en DESC');
        }
        $rows = $stmt->fetchAll();
        // Decodificar items JSON
        foreach ($rows as &$row) {
            $row['items'] = json_decode($row['items'], true);
        }
        ok($rows);
    }

    // GET /pedidos/{id}
    if ($method === 'GET' && $id !== null) {
        requireAdmin();
        $stmt = $db->prepare('SELECT * FROM pedidos WHERE id = ?');
        $stmt->execute([$id]);
        $pedido = $stmt->fetch();
        if (!$pedido) error('Pedido no encontrado.', 404);
        $pedido['items'] = json_decode($pedido['items'], true);
        ok($pedido);
    }

    // POST /pedidos — crear pedido (público, desde la tienda)
    if ($method === 'POST') {
        $cliente = trim($body['cliente'] ?? 'Cliente');
        $items   = $body['items'] ?? [];
        $total   = floatval($body['total'] ?? 0);

        if (empty($items))   error('El pedido no tiene productos.');
        if ($total <= 0)     error('El total debe ser mayor a 0.');
        if (empty($cliente)) $cliente = 'Cliente';

        $stmt = $db->prepare(
            'INSERT INTO pedidos (cliente, items, total, estado) VALUES (?, ?, ?, "pendiente")'
        );
        $stmt->execute([$cliente, json_encode($items, JSON_UNESCAPED_UNICODE), $total]);
        ok(['id' => (int)$db->lastInsertId(), 'cliente' => $cliente, 'total' => $total], 201);
    }

    // PUT /pedidos/{id} — marcar como entregado (admin)
    if ($method === 'PUT' && $id !== null) {
        requireAdmin();
        $check = $db->prepare('SELECT id FROM pedidos WHERE id = ?');
        $check->execute([$id]);
        if (!$check->fetch()) error('Pedido no encontrado.', 404);

        $nuevoEstado = trim($body['estado'] ?? 'entregado');
        if (!in_array($nuevoEstado, ['pendiente', 'entregado'])) error('Estado inválido.');

        if ($nuevoEstado === 'entregado') {
            $stmt = $db->prepare('UPDATE pedidos SET estado="entregado", entregado_en=NOW() WHERE id=?');
        } else {
            $stmt = $db->prepare('UPDATE pedidos SET estado="pendiente", entregado_en=NULL WHERE id=?');
        }
        $stmt->execute([$id]);
        ok(['id' => $id, 'estado' => $nuevoEstado]);
    }

    // DELETE /pedidos/{id} — eliminar pedido (admin)
    if ($method === 'DELETE' && $id !== null) {
        requireAdmin();
        $check = $db->prepare('SELECT id FROM pedidos WHERE id = ?');
        $check->execute([$id]);
        if (!$check->fetch()) error('Pedido no encontrado.', 404);
        $db->prepare('DELETE FROM pedidos WHERE id = ?')->execute([$id]);
        ok(['eliminado' => $id]);
    }
}

error('Método no permitido.', 405);
