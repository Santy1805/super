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
    $categoriasValidas = ['frutas', 'verduras', 'bebidas', 'limpieza', 'otros'];

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
$method = $_SERVER['REQUEST_METHOD'];
$path   = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$parts  = explode('/', $path);

// Detectar el segmento de la ruta relevante
// Soporta tanto /api.php/productos como /productos
$resource = '';
$id       = null;

foreach ($parts as $i => $part) {
    if ($part === 'productos') {
        $resource = 'productos';
        $id = isset($parts[$i + 1]) && is_numeric($parts[$i + 1])
              ? (int)$parts[$i + 1]
              : null;
        break;
    }
}

// También soportar ?recurso=productos&id=1 como alternativa simple
if (!$resource && isset($_GET['recurso'])) {
    $resource = $_GET['recurso'];
    $id       = isset($_GET['id']) ? (int)$_GET['id'] : null;
}

if ($resource !== 'productos') error('Ruta no encontrada.', 404);

$db   = getDB();
$body = json_decode(file_get_contents('php://input'), true) ?? [];

// =====================================================
//  GET /productos          → listar todos (públic)
//  GET /productos/{id}     → obtener uno (público)
//  POST /productos         → crear (admin)
//  PUT /productos/{id}     → editar (admin)
//  DELETE /productos/{id}  → eliminar (admin)
// =====================================================

if ($method === 'GET' && $id === null) {
    // Listar productos activos (público) o todos (admin)
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

error('Método no permitido.', 405);
