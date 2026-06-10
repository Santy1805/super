/* =====================================================
   SUPERMERCADO LÍDER — Panel Admin
   ===================================================== */

const API_URL   = 'api.php/productos';  // ← ajustá si tu servidor tiene otro path
const ADMIN_KEY = 'lider2024';          // ← debe coincidir con api.php

const EMOJIS = {
    frutas:   ['🍎','🍌','🍇','🍊','🍓','🍒','🍑','🥭','🍍','🥝','🍋','🍈'],
    verduras: ['🥬','🍅','🥕','🥦','🌽','🥑','🧅','🧄','🥒','🫑','🍆','🥔'],
    bebidas:  ['🥛','🧃','🥤','☕','🍵','🧋','🍶','🫖','🧉','🍺','🍷','🫗'],
    limpieza: ['🧴','🧪','🧻','🧹','🧺','🪣','🫧','🧽','🪥','🗑️'],
    otros:    ['📦','🛒','🏷️','🎁','🛍️','🪴','🐾','🍫','🍬','🍞'],
};

let products    = [];
let editingId   = null;
let confirmCb   = null;
let isLoggedIn  = false;

/* =====================================================
   AUTH
   ===================================================== */

function login() {
    const key = document.getElementById('adminKey').value.trim();
    if (!key) return;

    // Verificamos con una petición real a la API
    fetch(`${API_URL}/0`, {
        method: 'GET',
        headers: { 'X-Admin-Key': key }
    }).then(async () => {
        // Cualquier respuesta (incluso 404) con status != 401 = clave válida
        isLoggedIn = true;
        sessionStorage.setItem('adminKey', key);
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('adminLayout').style.display  = 'flex';
        loadProducts();
    }).catch(() => {
        showLoginError('No se pudo conectar con el servidor.');
    });
}

// Atajo: Enter en el campo de clave
document.getElementById('adminKey').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
});

function showLoginError(msg) {
    const el = document.getElementById('loginError');
    el.textContent = msg;
    setTimeout(() => el.textContent = '', 3000);
}

function logout() {
    sessionStorage.removeItem('adminKey');
    location.reload();
}

function getKey() {
    return sessionStorage.getItem('adminKey') || ADMIN_KEY;
}

// Auto-login si ya hay sesión
window.addEventListener('DOMContentLoaded', () => {
    buildEmojiPicker();
    updatePreview();

    const saved = sessionStorage.getItem('adminKey');
    if (saved) {
        document.getElementById('adminKey').value = saved;
        login();
    }
});

/* =====================================================
   API HELPERS
   ===================================================== */

async function apiFetch(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'X-Admin-Key': getKey(),
        ...(options.headers || {}),
    };
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error desconocido');
    return data.data;
}

/* =====================================================
   CARGA Y RENDER
   ===================================================== */

async function loadProducts() {
    try {
        products = await apiFetch('', { method: 'GET' });
        renderTable(products);
        updateStats(products);
    } catch (err) {
        showToast('Error al cargar productos: ' + err.message, true);
    }
}

function renderTable(list) {
    const tbody = document.getElementById('tableBody');
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="table-loading">No hay productos todavía. ¡Agregá el primero!</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(p => `
        <tr>
            <td>
                <div class="cell-product">
                    <div class="cell-icon cat-${p.categoria}">${p.icono}</div>
                    <div>
                        <div class="cell-name">${escHtml(p.nombre)}</div>
                        <div class="cell-id">#${p.id}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge">${p.categoria}</span></td>
            <td><strong>$${Number(p.precio).toLocaleString('es-AR')}</strong></td>
            <td>
                <span class="badge ${p.activo == 1 ? 'badge-activo' : 'badge-inactivo'}">
                    ${p.activo == 1 ? '✅ Visible' : '🔒 Oculto'}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-icon" onclick="openEdit(${p.id})" title="Editar">✏️</button>
                    <button class="btn btn-icon btn-icon-danger" onclick="confirmDelete(${p.id}, '${escHtml(p.nombre)}')" title="Eliminar">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function updateStats(list) {
    const activos   = list.filter(p => p.activo == 1).length;
    const inactivos = list.length - activos;
    const cats      = new Set(list.map(p => p.categoria)).size;

    document.getElementById('stat-total').textContent    = list.length;
    document.getElementById('stat-activos').textContent  = activos;
    document.getElementById('stat-inactivos').textContent = inactivos;
    document.getElementById('stat-cats').textContent     = cats;
}

function filterTable() {
    const term = document.getElementById('tableSearch').value.toLowerCase();
    const cat  = document.getElementById('tableCatFilter').value;
    const filtered = products.filter(p => {
        const matchText = p.nombre.toLowerCase().includes(term);
        const matchCat  = !cat || p.categoria === cat;
        return matchText && matchCat;
    });
    renderTable(filtered);
}

/* =====================================================
   NAVEGACIÓN DE VISTAS
   ===================================================== */

function setView(view) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const el    = document.getElementById(`view-${view}`);
    const navEl = document.getElementById(`nav-${view}`);

    if (el) el.style.display = 'block';
    if (navEl) navEl.classList.add('active');

    const titles = { productos: 'Productos', nuevo: editingId ? 'Editar producto' : 'Nuevo producto' };
    document.getElementById('topbarTitle').textContent = titles[view] || '';
}

/* =====================================================
   FORMULARIO
   ===================================================== */

function openEdit(id) {
    const p = products.find(x => x.id == id);
    if (!p) return;

    editingId = id;

    document.getElementById('f-nombre').value    = p.nombre;
    document.getElementById('f-precio').value    = p.precio;
    document.getElementById('f-categoria').value = p.categoria;
    document.getElementById('f-icono').value     = p.icono;
    document.getElementById('f-activo').checked  = p.activo == 1;
    document.getElementById('formTitle').textContent   = 'Editar producto';
    document.getElementById('submitBtn').textContent   = 'Guardar cambios';

    buildEmojiPicker(p.categoria);
    updatePreview();
    setView('nuevo');
}

function cancelForm() {
    resetForm();
    setView('productos');
}

function resetForm() {
    editingId = null;
    ['f-nombre','f-precio','f-icono'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('f-categoria').value = '';
    document.getElementById('f-activo').checked  = true;
    document.getElementById('formTitle').textContent = 'Nuevo producto';
    document.getElementById('submitBtn').textContent = 'Guardar producto';
    clearErrors();
    updatePreview();
}

async function submitForm() {
    clearErrors();

    const nombre    = document.getElementById('f-nombre').value.trim();
    const precio    = parseFloat(document.getElementById('f-precio').value);
    const categoria = document.getElementById('f-categoria').value;
    const icono     = document.getElementById('f-icono').value.trim() || '📦';
    const activo    = document.getElementById('f-activo').checked ? 1 : 0;

    let valid = true;

    if (!nombre) { setError('e-nombre', 'El nombre es obligatorio.'); valid = false; }
    if (!precio || precio <= 0) { setError('e-precio', 'Ingresá un precio válido.'); valid = false; }
    if (!categoria) { setError('e-categoria', 'Seleccioná una categoría.'); valid = false; }
    if (!valid) return;

    const body = { nombre, precio, categoria, icono, activo };
    const btn  = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
        if (editingId) {
            await apiFetch(`/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
            showToast('✏️ Producto actualizado correctamente.');
        } else {
            await apiFetch('', { method: 'POST', body: JSON.stringify(body) });
            showToast('✅ Producto creado y publicado en la tienda.');
        }
        resetForm();
        await loadProducts();
        setView('productos');
    } catch (err) {
        showToast('Error: ' + err.message, true);
    } finally {
        btn.disabled = false;
        btn.textContent = editingId ? 'Guardar cambios' : 'Guardar producto';
    }
}

function setError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
}

function clearErrors() {
    ['e-nombre','e-precio','e-categoria'].forEach(id => setError(id, ''));
}

/* =====================================================
   ELIMINAR
   ===================================================== */

function confirmDelete(id, nombre) {
    document.getElementById('confirmMsg').textContent = `¿Eliminar "${nombre}"?`;
    document.getElementById('confirmModal').style.display = 'flex';

    confirmCb = async () => {
        try {
            await apiFetch(`/${id}`, { method: 'DELETE' });
            showToast('🗑️ Producto eliminado.');
            await loadProducts();
        } catch (err) {
            showToast('Error: ' + err.message, true);
        }
        closeConfirm();
    };

    document.getElementById('confirmBtn').onclick = confirmCb;
}

function closeConfirm() {
    document.getElementById('confirmModal').style.display = 'none';
    confirmCb = null;
}

/* =====================================================
   PREVIEW EN TIEMPO REAL
   ===================================================== */

['f-nombre','f-precio','f-categoria','f-icono'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updatePreview);
    if (el?.tagName === 'SELECT') el.addEventListener('change', () => {
        buildEmojiPicker(el.value);
        updatePreview();
    });
});

function updatePreview() {
    const nombre    = document.getElementById('f-nombre')?.value   || 'Nombre del producto';
    const precio    = parseFloat(document.getElementById('f-precio')?.value) || 0;
    const categoria = document.getElementById('f-categoria')?.value || 'otros';
    const icono     = document.getElementById('f-icono')?.value     || '📦';
    const activo    = document.getElementById('f-activo')?.checked;

    const img  = document.getElementById('prev-image');
    if (img) {
        img.textContent = icono || '📦';
        img.className   = `preview-image cat-${categoria || 'otros'}`;
    }

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('prev-name',  nombre || 'Nombre del producto');
    el('prev-price', precio ? `$${precio.toLocaleString('es-AR')}` : '$0');
    el('prev-badge', categoria || 'otros');

    const note = document.getElementById('prev-status-note');
    if (note) {
        note.textContent = activo ? '✅ Se mostrará en la tienda' : '🔒 Estará oculto en la tienda';
        note.style.color = activo ? 'var(--verde)' : 'var(--gris-400)';
    }

    const toggle = document.getElementById('toggleText');
    if (toggle) toggle.textContent = activo ? 'Visible en la tienda' : 'Oculto en la tienda';
}

/* =====================================================
   EMOJI PICKER
   ===================================================== */

function buildEmojiPicker(cat = '') {
    const picker = document.getElementById('emojiPicker');
    if (!picker) return;

    const list = cat && EMOJIS[cat] ? EMOJIS[cat] : Object.values(EMOJIS).flat().slice(0, 24);
    const current = document.getElementById('f-icono')?.value;

    picker.innerHTML = list.map(e => `
        <button class="emoji-opt ${e === current ? 'selected' : ''}"
                onclick="selectEmoji('${e}')" type="button">${e}</button>
    `).join('');
}

function selectEmoji(emoji) {
    const input = document.getElementById('f-icono');
    if (input) input.value = emoji;
    buildEmojiPicker(document.getElementById('f-categoria')?.value);
    updatePreview();
}

/* =====================================================
   TOASTS
   ===================================================== */

function showToast(msg, isError = false) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast${isError ? ' toast-error' : ''}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3100);
}

/* =====================================================
   UTILS
   ===================================================== */

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
