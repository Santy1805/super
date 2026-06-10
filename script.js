/* =====================================================
   SUPERMERCADO LÍDER — Tienda
   Carga productos desde la API PHP + MySQL
   ===================================================== */

const API_URL = 'api.php/productos'; // ← mismo path que admin.js

const categoryLabels = {
    all:      'Todos los productos',
    frutas:   'Frutas',
    verduras: 'Verduras',
    bebidas:  'Bebidas',
    limpieza: 'Limpieza',
    otros:    'Otros',
};

let productsData    = [];
let cart            = JSON.parse(localStorage.getItem('lider_cart')) || [];
let currentCategory = 'all';
let drawerOpen      = false;

/* =====================================================
   CARGA INICIAL DESDE API
   ===================================================== */

async function fetchProducts() {
    try {
        const res  = await fetch(API_URL);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);
        productsData = json.data;
        updateFilterCounts();
        renderProducts();
        updateCartCount();
    } catch (err) {
        const container = document.getElementById('productsContainer');
        if (container) container.innerHTML = `
            <div class="empty-state">
                <span class="empty-state-icon">⚠️</span>
                <h3>No se pudo cargar el catálogo</h3>
                <p>${err.message}</p>
            </div>`;
    }
}

function updateFilterCounts() {
    const counts = { all: productsData.length };
    productsData.forEach(p => {
        counts[p.categoria] = (counts[p.categoria] || 0) + 1;
    });
    Object.keys(counts).forEach(cat => {
        const el = document.getElementById(`count-${cat}`);
        if (el) el.textContent = counts[cat] || 0;
    });
    const badge = document.getElementById('heroBadgeNum');
    if (badge) badge.textContent = productsData.length;
}

/* =====================================================
   RENDER PRODUCTOS
   ===================================================== */

function renderProducts(filter = currentCategory, searchTerm = '') {
    const container   = document.getElementById('productsContainer');
    const sectionTitle = document.getElementById('sectionTitle');
    const sectionCount = document.getElementById('sectionCount');
    if (!container) return;

    container.innerHTML = '';

    const filtered = productsData.filter(p => {
        const matchCat  = filter === 'all' || p.categoria === filter;
        const matchText = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        return matchCat && matchText;
    });

    if (sectionTitle) sectionTitle.textContent = categoryLabels[filter] || 'Productos';
    if (sectionCount) sectionCount.textContent = `${filtered.length} producto${filtered.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-state-icon">🔍</span>
                <h3>Sin resultados</h3>
                <p>No encontramos "${searchTerm}" en esta categoría.<br>Probá con otro término.</p>
            </div>`;
        return;
    }

    filtered.forEach((product, i) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.style.animationDelay = `${i * 40}ms`;
        card.innerHTML = `
            <div class="product-image-wrap">
                <div class="product-image cat-${product.categoria}" role="img" aria-label="${product.nombre}">
                    ${product.icono}
                </div>
                <span class="product-badge">${categoryLabels[product.categoria] || product.categoria}</span>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.nombre}</h3>
                <p class="product-price">
                    $${Number(product.precio).toLocaleString('es-AR')}
                    <span class="price-unit">ARS</span>
                </p>
                <button class="add-btn" onclick="addToCart(${product.id})">
                    <span>+</span> Agregar
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

function filterCategory(category) {
    currentCategory = category;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === category);
    });
    renderProducts(category, document.getElementById('searchInput').value);
}

document.getElementById('searchInput').addEventListener('input', e => {
    renderProducts(currentCategory, e.target.value.trim());
});

/* =====================================================
   CARRITO
   ===================================================== */

function addToCart(productId) {
    const product  = productsData.find(p => p.id == productId);
    const existing = cart.find(i => i.id == productId);

    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    saveCart();
    animateCartBtn();
    showToast(`${product.icono} ${product.nombre} agregado al carrito`);
}

function animateCartBtn() {
    const count = document.getElementById('cartCount');
    count.classList.remove('bump');
    void count.offsetWidth;
    count.classList.add('bump');
}

function updateCartCount() {
    const total = cart.reduce((s, i) => s + i.quantity, 0);
    document.getElementById('cartCount').textContent = total;
}

function toggleCart() {
    drawerOpen = !drawerOpen;
    const overlay = document.getElementById('drawerOverlay');
    const drawer  = document.getElementById('cartDrawer');
    overlay.style.display = drawerOpen ? 'block' : 'none';
    drawer.classList.toggle('open', drawerOpen);
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    if (drawerOpen) renderCartItems();
}

function renderCartItems() {
    const container = document.getElementById('cartItemsContainer');
    const footer    = document.getElementById('drawerFooter');
    const totalEl   = document.getElementById('cartTotal');
    const countEl   = document.getElementById('drawerCount');
    if (!container) return;

    const itemCount = cart.reduce((s, i) => s + i.quantity, 0);
    if (countEl) countEl.textContent = `${itemCount} ítem${itemCount !== 1 ? 's' : ''}`;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="drawer-empty">
                <span class="drawer-empty-icon">🛒</span>
                <h3>Tu carrito está vacío</h3>
                <p>Agregá productos para empezar tu compra.</p>
            </div>`;
        if (footer) footer.style.display = 'none';
        return;
    }

    container.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        const itemTotal = Number(item.precio) * item.quantity;
        total += itemTotal;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-emoji cat-${item.categoria}">${item.icono}</div>
            <div class="cart-item-info">
                <h4>${item.nombre}</h4>
                <p>$${Number(item.precio).toLocaleString('es-AR')} c/u</p>
            </div>
            <div class="cart-item-controls">
                <button class="quantity-btn" onclick="updateQuantity(${item.id}, -1)">−</button>
                <span class="quantity-num">${item.quantity}</span>
                <button class="quantity-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
            </div>
            <span class="cart-item-price">$${itemTotal.toLocaleString('es-AR')}</span>
            <button class="remove-btn" onclick="removeFromCart(${item.id})" aria-label="Eliminar">🗑</button>
        `;
        container.appendChild(div);
    });

    if (totalEl) totalEl.textContent = total.toLocaleString('es-AR');
    if (footer) footer.style.display = 'block';
}

function updateQuantity(productId, change) {
    const item = cart.find(i => i.id == productId);
    if (!item) return;
    item.quantity += change;
    if (item.quantity <= 0) cart = cart.filter(i => i.id != productId);
    saveCart();
    renderCartItems();
}

function removeFromCart(productId) {
    const item = cart.find(i => i.id == productId);
    if (item) showToast(`Eliminado: ${item.nombre}`);
    cart = cart.filter(i => i.id != productId);
    saveCart();
    renderCartItems();
}

function saveCart() {
    localStorage.setItem('lider_cart', JSON.stringify(cart));
    updateCartCount();
}

function checkout() {
    if (!cart.length) return;
    showToast('¡Gracias por tu compra en Supermercado Líder! 🎉');
    cart = [];
    saveCart();
    toggleCart();
}

/* =====================================================
   TOASTS
   ===================================================== */

function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

/* =====================================================
   INIT
   ===================================================== */

document.addEventListener('DOMContentLoaded', fetchProducts);
