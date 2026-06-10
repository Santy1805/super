<?php
// =====================================================
//  DIAGNÓSTICO — borrar este archivo después de usarlo
// =====================================================
header('Content-Type: text/html; charset=utf-8');

define('DB_HOST', 'localhost');
define('DB_NAME', 'supermercado_lider');
define('DB_USER', 'root');
define('DB_PASS', '');

echo "<h2>🔍 Diagnóstico Supermercado Líder</h2><hr>";

// 1. Conexión a la base de datos
echo "<h3>1. Conexión a MySQL</h3>";
try {
    $pdo = new PDO(
        'mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    echo "<p style='color:green'>✅ Conexión exitosa a <b>".DB_NAME."</b></p>";
} catch (Exception $e) {
    echo "<p style='color:red'>❌ Error de conexión: ".$e->getMessage()."</p>";
    exit;
}

// 2. Verificar tabla pedidos
echo "<h3>2. Tabla 'pedidos'</h3>";
try {
    $stmt = $pdo->query("SHOW TABLES LIKE 'pedidos'");
    if ($stmt->rowCount() > 0) {
        echo "<p style='color:green'>✅ La tabla <b>pedidos</b> existe</p>";

        // Mostrar estructura
        $cols = $pdo->query("DESCRIBE pedidos")->fetchAll(PDO::FETCH_ASSOC);
        echo "<table border='1' cellpadding='5'><tr><th>Campo</th><th>Tipo</th><th>Null</th><th>Default</th></tr>";
        foreach ($cols as $col) {
            echo "<tr><td>{$col['Field']}</td><td>{$col['Type']}</td><td>{$col['Null']}</td><td>{$col['Default']}</td></tr>";
        }
        echo "</table>";

        // Contar filas
        $count = $pdo->query("SELECT COUNT(*) FROM pedidos")->fetchColumn();
        echo "<p>📊 Hay <b>$count</b> pedidos en la base de datos</p>";

        if ($count > 0) {
            $rows = $pdo->query("SELECT id, cliente, total, estado, creado_en FROM pedidos ORDER BY creado_en DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
            echo "<table border='1' cellpadding='5'><tr><th>ID</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th></tr>";
            foreach ($rows as $r) {
                echo "<tr><td>{$r['id']}</td><td>{$r['cliente']}</td><td>{$r['total']}</td><td>{$r['estado']}</td><td>{$r['creado_en']}</td></tr>";
            }
            echo "</table>";
        }
    } else {
        echo "<p style='color:red'>❌ La tabla <b>pedidos</b> NO existe — ejecutá el SQL de creación</p>";

        // Intentar crearla
        echo "<p>🔧 Intentando crear la tabla...</p>";
        try {
            $pdo->exec("CREATE TABLE pedidos (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                cliente      VARCHAR(120)  NOT NULL DEFAULT 'Cliente',
                items        MEDIUMTEXT    NOT NULL,
                total        DECIMAL(10,2) NOT NULL DEFAULT 0,
                estado       ENUM('pendiente','entregado') NOT NULL DEFAULT 'pendiente',
                creado_en    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                entregado_en DATETIME      NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            echo "<p style='color:green'>✅ Tabla <b>pedidos</b> creada exitosamente. Recargá la página.</p>";
        } catch (Exception $e) {
            echo "<p style='color:red'>❌ No se pudo crear: ".$e->getMessage()."</p>";
        }
    }
} catch (Exception $e) {
    echo "<p style='color:red'>❌ Error: ".$e->getMessage()."</p>";
}

// 3. Verificar tabla productos
echo "<h3>3. Tabla 'productos'</h3>";
try {
    $count = $pdo->query("SELECT COUNT(*) FROM productos")->fetchColumn();
    echo "<p style='color:green'>✅ Tabla <b>productos</b> existe con <b>$count</b> productos</p>";

    // Verificar columna icono
    $cols = $pdo->query("DESCRIBE productos")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($cols as $col) {
        if ($col['Field'] === 'icono') {
            $tipo = strtolower($col['Type']);
            if (strpos($tipo, 'varchar') !== false) {
                echo "<p style='color:orange'>⚠️ El campo <b>icono</b> es <b>{$col['Type']}</b> — demasiado corto para imágenes. Ejecutá:<br>
                <code>ALTER TABLE productos MODIFY COLUMN icono MEDIUMTEXT NOT NULL DEFAULT '📦';</code></p>";
            } else {
                echo "<p style='color:green'>✅ Campo <b>icono</b> es <b>{$col['Type']}</b> — OK para imágenes</p>";
            }
        }
        if ($col['Field'] === 'categoria') {
            $tipo = strtolower($col['Type']);
            if (strpos($tipo, 'enum') !== false && strpos($tipo, 'panaderia') === false) {
                echo "<p style='color:orange'>⚠️ La categoría <b>panaderia</b> no está en el ENUM. Ejecutá:<br>
                <code>ALTER TABLE productos MODIFY COLUMN categoria VARCHAR(30) NOT NULL DEFAULT 'otros';</code></p>";
            } elseif (strpos($tipo, 'varchar') !== false) {
                echo "<p style='color:green'>✅ Campo <b>categoria</b> es VARCHAR — OK para nuevas categorías</p>";
            }
        }
    }
} catch (Exception $e) {
    echo "<p style='color:red'>❌ Tabla productos no existe: ".$e->getMessage()."</p>";
}

// 4. Simular un pedido de prueba
echo "<h3>4. Prueba: insertar pedido de prueba</h3>";
if (isset($_GET['test_pedido'])) {
    try {
        $items = json_encode([['id'=>1,'nombre'=>'Test','precio'=>100,'categoria'=>'otros','icono'=>'📦','quantity'=>1]]);
        $stmt  = $pdo->prepare("INSERT INTO pedidos (cliente, items, total, estado) VALUES (?, ?, ?, 'pendiente')");
        $stmt->execute(['Cliente Test', $items, 100]);
        $newId = $pdo->lastInsertId();
        echo "<p style='color:green'>✅ Pedido de prueba insertado con ID <b>$newId</b></p>";
        echo "<p><a href='test.php'>↩ Volver</a></p>";
    } catch (Exception $e) {
        echo "<p style='color:red'>❌ Error al insertar: ".$e->getMessage()."</p>";
    }
} else {
    echo "<p><a href='test.php?test_pedido=1' style='background:#16A34A;color:white;padding:8px 16px;border-radius:6px;text-decoration:none'>
        ▶ Insertar pedido de prueba
    </a></p>";
}

// 5. Variables del servidor
echo "<h3>5. Configuración del servidor</h3>";
echo "<p>PHP: <b>".phpversion()."</b></p>";
echo "<p>PATH_INFO: <b>".($_SERVER['PATH_INFO'] ?? '(no disponible)')."</b></p>";
echo "<p>REQUEST_URI: <b>".$_SERVER['REQUEST_URI']."</b></p>";
echo "<p>SCRIPT_NAME: <b>".$_SERVER['SCRIPT_NAME']."</b></p>";

echo "<hr><p style='color:gray'>⚠️ <b>Borrá test.php del servidor cuando termines.</b></p>";
?>
