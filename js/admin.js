/* ============================================
   MAISON - PANEL DE VENDEDOR
   Funciones: Login, Productos (CRUD), Pedidos
============================================ */

// Cliente Supabase (viene de supabase-client.js)
const db = supabaseClient;

// Estado global
let currentUser    = null;
let editingProduct = null;
let allPedidos     = [];
let allProductos   = [];

/* ══════════════════════════════════════════════
   INICIALIZACIÓN
══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initNavTabs();
    initProductForm();
    initProductSearch();
    initFilters();
    initModal();
    initImagePreview();
});

/* ══════════════════════════════════════════════
   AUTENTICACIÓN
══════════════════════════════════════════════ */
function initAuth() {
    // Escuchar cambios de sesión
    db.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
            currentUser = session.user;
            showPanel();
        } else {
            currentUser = null;
            showLogin();
        }
    });

    // Comprobar sesión existente
    db.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
            currentUser = session.user;
            showPanel();
        }
    });

    // Formulario de login
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email    = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorEl  = document.getElementById('loginError');
        const btnLogin = e.target.querySelector('.btn-login');

        errorEl.classList.add('hidden');
        btnLogin.textContent = 'Ingresando...';
        btnLogin.disabled    = true;

        const { error } = await db.auth.signInWithPassword({ email, password });

        if (error) {
            errorEl.textContent = 'Credenciales incorrectas. Verifica tu email y contraseña.';
            errorEl.classList.remove('hidden');
            btnLogin.textContent = 'Ingresar';
            btnLogin.disabled    = false;
        }
    });

    // Logout
    document.getElementById('btnLogout').addEventListener('click', async () => {
        await db.auth.signOut();
    });
}

function showPanel() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('userEmail').textContent = currentUser.email;
    loadProducts();
    loadPedidos();
}

function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
}

/* ══════════════════════════════════════════════
   NAVEGACIÓN DE PESTAÑAS
══════════════════════════════════════════════ */
function initNavTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            contents.forEach(c => c.classList.add('hidden'));
            document.getElementById(`tab-${target}`).classList.remove('hidden');
        });
    });
}

/* ══════════════════════════════════════════════
   PRODUCTOS - CRUD
══════════════════════════════════════════════ */
async function loadProducts() {
    const grid = document.getElementById('productsList');
    grid.innerHTML = '<div class="loading-spinner">Cargando productos...</div>';

    const { data, error } = await db
        .from('productos')
        .select('*')
        .eq('vendedor_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        grid.innerHTML = '<div class="loading-spinner">Error al cargar productos.</div>';
        return;
    }

    allProductos = data || [];
    renderProducts(allProductos);
}

function renderProducts(products) {
    const grid = document.getElementById('productsList');

    if (!products.length) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <p>No tienes productos aún. Agrega el primero.</p>
            </div>`;
        return;
    }

    grid.innerHTML = products.map(p => `
        <div class="product-card">
            ${p.imagen_url
                ? `<img class="product-card-img" src="${p.imagen_url}" alt="${p.nombre}" onerror="this.style.display='none'">`
                : `<div class="product-card-img-placeholder">Sin imagen</div>`
            }
            <div class="product-card-body">
                <div class="product-card-name" title="${p.nombre}">${p.nombre}</div>
                <div class="product-card-cat">${p.categoria || 'Sin categoría'}</div>
                <div class="product-card-meta">
                    <span class="product-card-price">${formatPrice(p.precio)}</span>
                    <span class="product-card-stock ${getStockClass(p.stock)}">
                        ${p.stock} en stock
                    </span>
                </div>
                <div class="product-card-actions">
                    <button class="btn-edit" onclick="editProduct('${p.id}')">Editar</button>
                    <button class="btn-delete" onclick="confirmDelete('${p.id}', '${escapeStr(p.nombre)}')">Eliminar</button>
                </div>
            </div>
        </div>
    `).join('');
}

function getStockClass(stock) {
    if (stock <= 0)  return 'stock-out';
    if (stock <= 5)  return 'stock-low';
    return 'stock-ok';
}

/* Formulario de producto */
function initProductForm() {
    const form = document.getElementById('productForm');
    const btnCancel = document.getElementById('btnCancel');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSubmit');
        btn.disabled = true;
        btn.textContent = editingProduct ? 'Guardando...' : 'Agregando...';

        const productData = {
            nombre:      document.getElementById('productName').value.trim(),
            precio:      parseFloat(document.getElementById('productPrice').value),
            categoria:   document.getElementById('productCategory').value,
            stock:       parseInt(document.getElementById('productStock').value),
            descripcion: document.getElementById('productDescription').value.trim(),
            imagen_url:  document.getElementById('productImage').value.trim(),
        };

        let error;
        if (editingProduct) {
            ({ error } = await db
                .from('productos')
                .update(productData)
                .eq('id', editingProduct)
                .eq('vendedor_id', currentUser.id));
        } else {
            productData.vendedor_id = currentUser.id;
            ({ error } = await db
                .from('productos')
                .insert([productData]));
        }

        if (error) {
            showToast('Error al guardar el producto.', 'error');
            console.error(error);
        } else {
            showToast(editingProduct ? 'Producto actualizado correctamente.' : 'Producto agregado correctamente.', 'success');
            resetForm();
            loadProducts();
        }

        btn.disabled = false;
        btn.textContent = editingProduct ? 'Guardar Cambios' : 'Agregar Producto';
    });

    btnCancel.addEventListener('click', resetForm);
}

function editProduct(id) {
    const product = allProductos.find(p => p.id === id);
    if (!product) return;

    editingProduct = id;
    document.getElementById('formTitle').textContent = 'Editar Producto';
    document.getElementById('btnSubmit').textContent = 'Guardar Cambios';
    document.getElementById('btnCancel').classList.remove('hidden');

    document.getElementById('productName').value        = product.nombre || '';
    document.getElementById('productPrice').value       = product.precio || '';
    document.getElementById('productCategory').value    = product.categoria || '';
    document.getElementById('productStock').value       = product.stock || '';
    document.getElementById('productDescription').value = product.descripcion || '';
    document.getElementById('productImage').value       = product.imagen_url || '';

    updateImagePreview(product.imagen_url);

    // Scroll al formulario
    document.getElementById('productForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
    editingProduct = null;
    document.getElementById('productForm').reset();
    document.getElementById('formTitle').textContent = 'Agregar Nuevo Producto';
    document.getElementById('btnSubmit').textContent = 'Agregar Producto';
    document.getElementById('btnCancel').classList.add('hidden');
    document.getElementById('imagePreview').classList.add('hidden');
}

/* Preview de imagen */
function initImagePreview() {
    document.getElementById('productImage').addEventListener('input', (e) => {
        updateImagePreview(e.target.value.trim());
    });
}

function updateImagePreview(url) {
    const preview = document.getElementById('imagePreview');
    const imgEl = document.getElementById('previewImg');
    if (url) {
        imgEl.src = url;
        preview.classList.remove('hidden');
        imgEl.onerror = () => preview.classList.add('hidden');
    } else {
        preview.classList.add('hidden');
    }
}

/* Búsqueda de productos */
function initProductSearch() {
    document.getElementById('searchProducts').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allProductos.filter(p =>
            p.nombre.toLowerCase().includes(term) ||
            (p.categoria && p.categoria.toLowerCase().includes(term))
        );
        renderProducts(filtered);
    });
}

/* Confirmar y eliminar producto */
function confirmDelete(id, nombre) {
    showModal(
        '¿Eliminar producto?',
        `Vas a eliminar "${nombre}". Esta acción no se puede deshacer.`,
        async () => {
            const { error } = await db
                .from('productos')
                .delete()
                .eq('id', id)
                .eq('vendedor_id', currentUser.id);

            if (error) {
                showToast('Error al eliminar el producto.', 'error');
            } else {
                showToast('Producto eliminado correctamente.', 'success');
                loadProducts();
            }
        }
    );
}

/* ══════════════════════════════════════════════
   PEDIDOS
══════════════════════════════════════════════ */
async function loadPedidos() {
    const list = document.getElementById('pedidosList');
    list.innerHTML = '<div class="loading-spinner">Cargando pedidos...</div>';

    // Obtener items de pedidos que contienen productos del vendedor
    const { data: items, error: itemsError } = await db
        .from('pedido_items')
        .select('pedido_id, cantidad, precio_unitario, productos(nombre, vendedor_id)')
        .eq('productos.vendedor_id', currentUser.id);

    if (itemsError) {
        list.innerHTML = '<div class="loading-spinner">Error al cargar pedidos.</div>';
        console.error(itemsError);
        return;
    }

    // IDs únicos de pedidos
    const pedidoIds = [...new Set(
        (items || [])
            .filter(item => item.productos?.vendedor_id === currentUser.id)
            .map(item => item.pedido_id)
    )];

    if (!pedidoIds.length) {
        list.innerHTML = `<div class="empty-state"><p>Aún no tienes pedidos.</p></div>`;
        allPedidos = [];
        return;
    }

    // Obtener datos de los pedidos
    const { data: pedidos, error: pedidosError } = await db
        .from('pedidos')
        .select('*')
        .in('id', pedidoIds)
        .order('created_at', { ascending: false });

    if (pedidosError) {
        list.innerHTML = '<div class="loading-spinner">Error al cargar pedidos.</div>';
        return;
    }

    // Enriquecer con items
    allPedidos = (pedidos || []).map(pedido => ({
        ...pedido,
        items: (items || []).filter(
            item => item.pedido_id === pedido.id &&
                    item.productos?.vendedor_id === currentUser.id
        )
    }));

    renderPedidos(allPedidos);
}

function renderPedidos(pedidos) {
    const list = document.getElementById('pedidosList');

    if (!pedidos.length) {
        list.innerHTML = `<div class="empty-state"><p>No hay pedidos que coincidan.</p></div>`;
        return;
    }

    list.innerHTML = pedidos.map(pedido => `
        <div class="pedido-card">
            <div class="pedido-header">
                <span class="pedido-id">Pedido #${pedido.id.slice(-8).toUpperCase()}</span>
                <span class="pedido-cliente">
                    ${pedido.cliente_nombre || pedido.cliente_email || 'Cliente'}
                </span>
                <span class="pedido-fecha">${formatDate(pedido.created_at)}</span>
                <span class="pedido-total">${formatPrice(pedido.total)}</span>
                <span class="estado-badge estado-${pedido.estado || 'pendiente'}">
                    ${pedido.estado || 'pendiente'}
                </span>
            </div>
            <div class="pedido-body">
                <div class="pedido-items">
                    ${pedido.items.map(item => `
                        <div class="pedido-item">
                            <span>${item.productos?.nombre || 'Producto'}</span>
                            <span>${item.cantidad} × ${formatPrice(item.precio_unitario)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="pedido-actions">
                    <label>Cambiar estado:</label>
                    <select id="estado-${pedido.id}">
                        ${['pendiente','confirmado','enviado','entregado','cancelado'].map(e => `
                            <option value="${e}" ${pedido.estado === e ? 'selected' : ''}>
                                ${capitalizeFirst(e)}
                            </option>
                        `).join('')}
                    </select>
                    <button class="btn-update-estado" onclick="updateEstado('${pedido.id}')">
                        Actualizar
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function updateEstado(pedidoId) {
    const select = document.getElementById(`estado-${pedidoId}`);
    const nuevoEstado = select.value;

    const { error } = await db
        .from('pedidos')
        .update({ estado: nuevoEstado })
        .eq('id', pedidoId);

    if (error) {
        showToast('Error al actualizar el estado.', 'error');
    } else {
        showToast(`Estado actualizado a: ${nuevoEstado}`, 'success');
        // Actualizar localmente
        const pedido = allPedidos.find(p => p.id === pedidoId);
        if (pedido) pedido.estado = nuevoEstado;
    }
}

/* Filtros de pedidos */
function initFilters() {
    document.getElementById('filterEstado').addEventListener('change', applyFilters);
    document.getElementById('filterFecha').addEventListener('change', applyFilters);
}

function applyFilters() {
    const estado = document.getElementById('filterEstado').value;
    const fecha  = document.getElementById('filterFecha').value;

    let filtered = [...allPedidos];

    if (estado) {
        filtered = filtered.filter(p => p.estado === estado);
    }

    if (fecha) {
        filtered = filtered.filter(p => {
            const pedidoFecha = new Date(p.created_at).toISOString().split('T')[0];
            return pedidoFecha === fecha;
        });
    }

    renderPedidos(filtered);
}

/* ══════════════════════════════════════════════
   MODAL DE CONFIRMACIÓN
══════════════════════════════════════════════ */
let modalCallback = null;

function initModal() {
    document.getElementById('modalConfirm').addEventListener('click', () => {
        if (modalCallback) modalCallback();
        closeModal();
    });
    document.getElementById('modalCancel').addEventListener('click', closeModal);
    document.getElementById('confirmModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
}

function showModal(title, message, onConfirm) {
    document.getElementById('modalTitle').textContent   = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('confirmModal').classList.remove('hidden');
    modalCallback = onConfirm;
}

function closeModal() {
    document.getElementById('confirmModal').classList.add('hidden');
    modalCallback = null;
}

/* ══════════════════════════════════════════════
   TOAST DE NOTIFICACIONES
══════════════════════════════════════════════ */
let toastTimeout = null;

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className   = `toast toast-${type}`;

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3500);
}

/* ══════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════ */

/** Formatea precio en CLP */
function formatPrice(amount) {
    if (!amount && amount !== 0) return '$0';
    return new Intl.NumberFormat('es-CL', {
        style:    'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Math.round(amount));
}

/** Formatea fecha en formato legible */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-CL', {
        day:   '2-digit',
        month: 'short',
        year:  'numeric'
    });
}

/** Primera letra mayúscula */
function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Escapar comillas para HTML */
function escapeStr(str) {
    return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════
   EXPONER FUNCIONES GLOBALES
══════════════════════════════════════════════ */
window.editProduct   = editProduct;
window.confirmDelete = confirmDelete;
window.updateEstado  = updateEstado;
