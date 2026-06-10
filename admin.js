/* =====================================================
   SUPERMERCADO LÍDER — Panel Admin
   ===================================================== */

const API_URL   = 'api.php/productos';
const API_PEDIDOS = 'api.php/pedidos';
const ADMIN_KEY = 'lider2024';

let products    = [];
let editingId   = null;
let confirmCb   = null;
let isLoggedIn  = false;
let currentImageBase64 = '';   // imagen seleccionada en base64

/* =====================================================
   AUTH
   ===================================================== */

function login() {
    const key = document.getElementById('adminKey').value.trim();
    if (!key) return;

    fetch(`${API_URL}/0`, {
        method: 'GET',
        headers: { 'X-Admin-Key': key }
    }).then(async () => {
        isLoggedIn = true;
        sessionStorage.setItem('adminKey', key);
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('adminLayout').style.display  = 'flex';
        loadProducts();
        loadPedidosBadge();
    }).catch(() => {
        showLoginError('No se pudo conectar con el servidor.');
    });
}

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

window.addEventListener('DOMContentLoaded', () => {
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

async function apiPedidosFetch(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'X-Admin-Key': getKey(),
        ...(options.headers || {}),
    };
    const res = await fetch(`${API_PEDIDOS}${path}`, { ...options, headers });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error desconocido');
    return data.data;
}

/* =====================================================
   CARGA Y RENDER DE PRODUCTOS
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

    tbody.innerHTML = list.map(p => {
        const isImg = p.icono && (p.icono.startsWith('data:') || p.icono.startsWith('http'));
        const imgHtml = isImg
            ? `<img src="${escHtml(p.icono)}" alt="${escHtml(p.nombre)}" class="cell-img">`
            : p.icono;
        return `
        <tr>
            <td>
                <div class="cell-product">
                    <div class="cell-icon cat-${p.categoria}">${imgHtml}</div>
                    <div>
                        <div class="cell-name">${escHtml(p.nombre)}</div>
                        <div class="cell-id">#${p.id}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge">${catLabel(p.categoria)}</span></td>
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
        `;
    }).join('');
}

function catLabel(cat) {
    const labels = {
        frutas: '🍎 Frutas', verduras: '🥬 Verduras', bebidas: '🥤 Bebidas',
        limpieza: '🧴 Limpieza', panaderia: '🍞 Panadería', otros: '📦 Otros'
    };
    return labels[cat] || cat;
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

    const titles = {
        productos:  'Productos',
        nuevo:      editingId ? 'Editar producto' : 'Nuevo producto',
        pendientes: 'Pedidos pendientes',
        entregados: 'Pedidos entregados',
    };
    document.getElementById('topbarTitle').textContent = titles[view] || '';

    // Ocultar botón "+ Nuevo producto" en vistas de pedidos
    const topbarActions = document.querySelector('.topbar-actions');
    if (topbarActions) {
        topbarActions.style.display = (view === 'pendientes' || view === 'entregados') ? 'none' : '';
    }

    if (view === 'pendientes') loadPedidos('pendiente');
    if (view === 'entregados') loadPedidos('entregado');
}

/* =====================================================
   FORMULARIO PRODUCTO
   ===================================================== */

function openEdit(id) {
    const p = products.find(x => x.id == id);
    if (!p) return;

    editingId = id;

    document.getElementById('f-nombre').value    = p.nombre;
    document.getElementById('f-precio').value    = p.precio;
    document.getElementById('f-categoria').value = p.categoria;
    document.getElementById('f-activo').checked  = p.activo == 1;
    document.getElementById('formTitle').textContent = 'Editar producto';
    document.getElementById('submitBtn').textContent = 'Guardar cambios';

    // Cargar imagen existente
    if (p.icono && (p.icono.startsWith('data:') || p.icono.startsWith('http'))) {
        currentImageBase64 = p.icono;
        showImagePreview(p.icono);
    } else {
        currentImageBase64 = '';
        clearImagePreview();
    }

    updatePreview();
    setView('nuevo');
}

function cancelForm() {
    resetForm();
    setView('productos');
}

function resetForm() {
    editingId = null;
    currentImageBase64 = '';
    ['f-nombre', 'f-precio'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('f-categoria').value = '';
    document.getElementById('f-activo').checked  = true;
    document.getElementById('formTitle').textContent = 'Nuevo producto';
    document.getElementById('submitBtn').textContent = 'Guardar producto';
    clearErrors();
    clearImagePreview();
    updatePreview();
}

async function submitForm() {
    clearErrors();

    const nombre    = document.getElementById('f-nombre').value.trim();
    const precio    = parseFloat(document.getElementById('f-precio').value);
    const categoria = document.getElementById('f-categoria').value;
    const activo    = document.getElementById('f-activo').checked ? 1 : 0;

    // El icono es la imagen en base64 o un emoji por defecto según categoría
    const defaultEmojis = {
        frutas: '🍎', verduras: '🥬', bebidas: '🥤',
        limpieza: '🧴', panaderia: '🍞', otros: '📦'
    };
    const icono = currentImageBase64 || defaultEmojis[categoria] || '📦';

    let valid = true;
    if (!nombre)              { setError('e-nombre',    'El nombre es obligatorio.');     valid = false; }
    if (!precio || precio <= 0) { setError('e-precio',  'Ingresá un precio válido.');     valid = false; }
    if (!categoria)           { setError('e-categoria', 'Seleccioná una categoría.');     valid = false; }
    if (!valid) return;

    const body = { nombre, precio, categoria, icono, activo };
    const btn  = document.getElementById('submitBtn');
    btn.disabled    = true;
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
        btn.disabled    = false;
        btn.textContent = editingId ? 'Guardar cambios' : 'Guardar producto';
    }
}

function setError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
}

function clearErrors() {
    ['e-nombre', 'e-precio', 'e-categoria', 'e-imagen'].forEach(id => setError(id, ''));
}

/* =====================================================
   MANEJO DE IMAGEN
   ===================================================== */

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        setError('e-imagen', 'La imagen no puede superar 2 MB.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        currentImageBase64 = e.target.result;
        showImagePreview(currentImageBase64);
        updatePreview();
    };
    reader.readAsDataURL(file);
}

function showImagePreview(src) {
    const placeholder = document.getElementById('imagePlaceholder');
    const thumb       = document.getElementById('imagePreviewThumb');
    const removeBtn   = document.getElementById('removeImageBtn');
    const area        = document.getElementById('imageUploadArea');

    placeholder.style.display = 'none';
    thumb.src                 = src;
    thumb.style.display       = 'block';
    removeBtn.style.display   = 'inline-flex';
    area.classList.add('has-image');
}

function clearImagePreview() {
    const placeholder = document.getElementById('imagePlaceholder');
    const thumb       = document.getElementById('imagePreviewThumb');
    const removeBtn   = document.getElementById('removeImageBtn');
    const area        = document.getElementById('imageUploadArea');
    const fileInput   = document.getElementById('f-imagen');

    placeholder.style.display = 'flex';
    thumb.style.display       = 'none';
    thumb.src                 = '';
    removeBtn.style.display   = 'none';
    area.classList.remove('has-image');
    if (fileInput) fileInput.value = '';
}

function removeImage() {
    currentImageBase64 = '';
    clearImagePreview();
    updatePreview();
}

/* =====================================================
   ELIMINAR PRODUCTO
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

['f-nombre', 'f-precio', 'f-categoria'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updatePreview);
    if (el?.tagName === 'SELECT') el.addEventListener('change', updatePreview);
});

function updatePreview() {
    const nombre    = document.getElementById('f-nombre')?.value   || 'Nombre del producto';
    const precio    = parseFloat(document.getElementById('f-precio')?.value) || 0;
    const categoria = document.getElementById('f-categoria')?.value || 'otros';
    const activo    = document.getElementById('f-activo')?.checked;

    const defaultEmojis = {
        frutas: '🍎', verduras: '🥬', bebidas: '🥤',
        limpieza: '🧴', panaderia: '🍞', otros: '📦'
    };

    const img     = document.getElementById('prev-image');
    const imgTag  = document.getElementById('prev-img-tag');
    const emoji   = document.getElementById('prev-emoji');

    if (img) {
        img.className = `preview-image cat-${categoria || 'otros'}`;
    }

    if (imgTag && emoji) {
        if (currentImageBase64) {
            imgTag.src           = currentImageBase64;
            imgTag.style.display = 'block';
            emoji.style.display  = 'none';
        } else {
            imgTag.style.display = 'none';
            emoji.textContent    = defaultEmojis[categoria] || '📦';
            emoji.style.display  = 'block';
        }
    }

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('prev-name',  nombre || 'Nombre del producto');
    el('prev-price', precio ? `$${precio.toLocaleString('es-AR')}` : '$0');
    el('prev-badge', catLabel(categoria));

    const note = document.getElementById('prev-status-note');
    if (note) {
        note.textContent = activo ? '✅ Se mostrará en la tienda' : '🔒 Estará oculto en la tienda';
        note.style.color = activo ? 'var(--verde)' : 'var(--gris-400)';
    }

    const toggle = document.getElementById('toggleText');
    if (toggle) toggle.textContent = activo ? 'Visible en la tienda' : 'Oculto en la tienda';
}

/* =====================================================
   PEDIDOS
   ===================================================== */

async function loadPedidos(estado) {
    const containerId = estado === 'pendiente' ? 'listaPendientes' : 'listaEntregados';
    const container   = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<div class="orders-loading">Cargando pedidos…</div>';

    try {
        const pedidos = await apiPedidosFetch(`?estado=${estado}`, { method: 'GET' });
        renderPedidos(pedidos, estado, container);
        if (estado === 'pendiente') updateBadgePendientes(pedidos.length);
    } catch (err) {
        container.innerHTML = `<div class="orders-empty"><span>⚠️</span><p>Error: ${err.message}</p></div>`;
    }
}

async function loadPedidosBadge() {
    try {
        const pedidos = await apiPedidosFetch('?estado=pendiente', { method: 'GET' });
        updateBadgePendientes(pedidos.length);
    } catch (_) {}
}

function updateBadgePendientes(count) {
    const badge = document.getElementById('badgePendientes');
    if (!badge) return;
    if (count > 0) {
        badge.textContent    = count;
        badge.style.display  = 'inline-flex';
    } else {
        badge.style.display  = 'none';
    }
}

function renderPedidos(pedidos, estado, container) {
    if (!pedidos.length) {
        const msg = estado === 'pendiente'
            ? 'No hay pedidos pendientes por ahora.'
            : 'Aún no hay pedidos entregados.';
        container.innerHTML = `
            <div class="orders-empty">
                <span>${estado === 'pendiente' ? '🕐' : '✅'}</span>
                <p>${msg}</p>
            </div>`;
        return;
    }

    container.innerHTML = pedidos.map(p => {
        const fecha    = new Date(p.creado_en).toLocaleString('es-AR');
        const items    = Array.isArray(p.items) ? p.items : [];
        const itemsHtml = items.map(i => {
            const isImg = i.icono && (i.icono.startsWith('data:') || i.icono.startsWith('http'));
            const iconHtml = isImg
                ? `<img src="${escHtml(i.icono)}" alt="${escHtml(i.nombre)}" class="order-item-img">`
                : `<span>${i.icono || '📦'}</span>`;
            return `
                <div class="order-item-row">
                    <div class="order-item-icon cat-${i.categoria || 'otros'}">${iconHtml}</div>
                    <span class="order-item-name">${escHtml(i.nombre)}</span>
                    <span class="order-item-qty">x${i.quantity}</span>
                    <span class="order-item-price">$${(Number(i.precio) * i.quantity).toLocaleString('es-AR')}</span>
                </div>`;
        }).join('');

        const actionBtn = estado === 'pendiente'
            ? `<button class="btn btn-success" onclick="marcarEntregado(${p.id})">✅ Marcar como entregado</button>`
            : `<button class="btn btn-ghost btn-sm" onclick="marcarPendiente(${p.id})">↩ Volver a pendiente</button>`;

        const entregadoInfo = p.entregado_en
            ? `<span class="order-meta">Entregado: ${new Date(p.entregado_en).toLocaleString('es-AR')}</span>`
            : '';

        return `
        <div class="order-card" id="order-${p.id}">
            <div class="order-card-header">
                <div class="order-card-info">
                    <span class="order-id">#${p.id}</span>
                    <span class="order-cliente">👤 ${escHtml(p.cliente)}</span>
                    <span class="order-meta">🕐 ${fecha}</span>
                    ${entregadoInfo}
                </div>
                <span class="order-total">$${Number(p.total).toLocaleString('es-AR')}</span>
            </div>
            <div class="order-items">${itemsHtml}</div>
            <div class="order-card-footer">
                ${actionBtn}
                <button class="btn btn-ghost btn-sm btn-icon-danger" onclick="confirmarEliminarPedido(${p.id})">🗑️ Eliminar</button>
            </div>
        </div>`;
    }).join('');
}

async function marcarEntregado(id) {
    try {
        await apiPedidosFetch(`/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ estado: 'entregado' })
        });
        showToast('✅ Pedido marcado como entregado.');
        loadPedidos('pendiente');
        loadPedidosBadge();
    } catch (err) {
        showToast('Error: ' + err.message, true);
    }
}

async function marcarPendiente(id) {
    try {
        await apiPedidosFetch(`/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ estado: 'pendiente' })
        });
        showToast('↩ Pedido vuelto a pendiente.');
        loadPedidos('entregado');
        loadPedidosBadge();
    } catch (err) {
        showToast('Error: ' + err.message, true);
    }
}

function confirmarEliminarPedido(id) {
    document.getElementById('confirmMsg').textContent = `¿Eliminar el pedido #${id}?`;
    document.getElementById('confirmModal').style.display = 'flex';
    confirmCb = async () => {
        try {
            await apiPedidosFetch(`/${id}`, { method: 'DELETE' });
            showToast('🗑️ Pedido eliminado.');
            // Refrescar la vista activa
            const viewPend = document.getElementById('view-pendientes');
            const viewEntr = document.getElementById('view-entregados');
            if (viewPend && viewPend.style.display !== 'none') loadPedidos('pendiente');
            if (viewEntr && viewEntr.style.display !== 'none') loadPedidos('entregado');
            loadPedidosBadge();
        } catch (err) {
            showToast('Error: ' + err.message, true);
        }
        closeConfirm();
    };
    document.getElementById('confirmBtn').onclick = confirmCb;
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
