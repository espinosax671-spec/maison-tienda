/* ============================================
   MAISON - ADMIN JS COMPLETO
   Versión con Dashboard de Estadísticas
============================================ */

// ─── CONFIGURACIÓN SUPABASE ──────────────────
// Reutilizamos el cliente definido en js/supabase-client.js
const supabase = supabaseClient || window.supabaseClient;

// ─── ESTADO GLOBAL ───────────────────────────
let currentUser     = null;
let editingProduct  = null;
let allPedidos      = [];
let allProductos    = [];
let statsLoaded     = false;   // ← evitar recargar cada vez

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
    supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
            currentUser = session.user;
            showPanel();
        } else {
            currentUser = null;
            showLogin();
        }
    });

    // Comprobar sesión existente
    supabase.auth.getSession().then(({ data: { session } }) => {
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

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            errorEl.textContent = 'Credenciales incorrectas. Verifica tu email y contraseña.';
            errorEl.classList.remove('hidden');
            btnLogin.textContent = 'Ingresar';
            btnLogin.disabled    = false;
        }
    });

    // Logout
    document.getElementById('btnLogout').addEventListener('click', async () => {
        await supabase.auth.signOut();
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
    statsLoaded = false;
}

/* ══════════════════════════════════════════════
   NAVEGACIÓN DE PESTAÑAS
══════════════════════════════════════════════ */
function initNavTabs() {
    const tabs    = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            // Activar tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Mostrar contenido
            contents.forEach(c => c.classList.add('hidden'));
            document.getElementById(`tab-${target}`).classList.remove('hidden');

            // Cargar estadísticas al entrar (solo una vez, o si forzamos reload)
            if (target === 'estadisticas' && !statsLoaded) {
                loadStats();
            }
        });
    });
}

/* ══════════════════════════════════════════════
   PRODUCTOS — CRUD
══════════════════════════════════════════════ */
async function loadProducts() {
    const grid = document.getElementById('productsList');
    grid.innerHTML = '<div class="loading-spinner">Cargando productos...</div>';

    const { data, error } = await supabase
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
                <span class="empty-state-icon">📦</span>
                <p>No tienes productos aún. ¡Agrega el primero!</p>
            </div>`;
        return;
    }

    grid.innerHTML = products.map(p => `
        <div class="product-card">
            ${p.imagen_url
                ? `<img class="product-card-img" src="${p.imagen_url}" alt="${p.nombre}" onerror="this.style.display='none'">`
                : `<div class="product-card-img-placeholder">👗</div>`
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
                    <button class="btn-edit" onclick="editProduct('${p.id}')">✏️ Editar</button>
                    <button class="btn-delete" onclick="confirmDelete('${p.id}', '${escapeStr(p.nombre)}')">🗑️ Eliminar</button>
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
    const form    = document.getElementById('productForm');
    const btnCancel = document.getElementById('btnCancel');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSubmit');
        btn.disabled = true;
        btn.textContent = editingProduct ? '⏳ Guardando...' : '⏳ Agregando...';

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
            ({ error } = await supabase
                .from('productos')
                .update(productData)
                .eq('id', editingProduct)
                .eq('vendedor_id', currentUser.id));
        } else {
            productData.vendedor_id = currentUser.id;
            ({ error } = await supabase
                .from('productos')
                .insert([productData]));
        }

        if (error) {
            showToast('Error al guardar el producto.', 'error');
        } else {
            showToast(editingProduct ? '✅ Producto actualizado.' : '✅ Producto agregado.', 'success');
            resetForm();
            loadProducts();
            statsLoaded = false; // forzar recarga de estadísticas
        }

        btn.disabled = false;
        btn.textContent = editingProduct ? '💾 Guardar Cambios' : '✚ Agregar Producto';
    });

    btnCancel.addEventListener('click', resetForm);
}

function editProduct(id) {
    const product = allProductos.find(p => p.id === id);
    if (!product) return;

    editingProduct = id;
    document.getElementById('formTitle').textContent    = 'Editar Producto';
    document.getElementById('btnSubmit').textContent    = '💾 Guardar Cambios';
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
    document.getElementById('btnSubmit').textContent = '✚ Agregar Producto';
    document.getElementById('btnCancel').classList.add('hidden');
    document.getElementById('imagePreview').classList.add('hidden');
}

function initImagePreview() {
    document.getElementById('productImage').addEventListener('input', (e) => {
        updateImagePreview(e.target.value.trim());
    });
}

function updateImagePreview(url) {
    const preview  = document.getElementById('imagePreview');
    const imgEl    = document.getElementById('previewImg');
    if (url) {
        imgEl.src = url;
        preview.classList.remove('hidden');
        imgEl.onerror = () => preview.classList.add('hidden');
    } else {
        preview.classList.add('hidden');
    }
}

/* Busqueda de productos */
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
            const { error } = await supabase
                .from('productos')
                .delete()
                .eq('id', id)
                .eq('vendedor_id', currentUser.id);

            if (error) {
                showToast('Error al eliminar el producto.', 'error');
            } else {
                showToast('🗑️ Producto eliminado.', 'success');
                loadProducts();
                statsLoaded = false;
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

    // Obtener pedidos que contienen productos del vendedor
    const { data: items, error: itemsError } = await supabase
        .from('pedido_items')
        .select('pedido_id, cantidad, precio_unitario, productos(nombre, vendedor_id)')
        .eq('productos.vendedor_id', currentUser.id);

    if (itemsError) {
        list.innerHTML = '<div class="loading-spinner">Error al cargar pedidos.</div>';
        return;
    }

    // Obtener IDs únicos de pedidos
    const pedidoIds = [...new Set(
        (items || [])
            .filter(item => item.productos?.vendedor_id === currentUser.id)
            .map(item => item.pedido_id)
    )];

    if (!pedidoIds.length) {
        list.innerHTML = `
            <div class="empty-state">
                <span class="empty-state-icon">🛍️</span>
                <p>Aún no tienes pedidos.</p>
            </div>`;
        allPedidos = [];
        return;
    }

    const { data: pedidos, error: pedidosError } = await supabase
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
        list.innerHTML = `
            <div class="empty-state">
                <span class="empty-state-icon">🛍️</span>
                <p>No hay pedidos que coincidan.</p>
            </div>`;
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
                <span class="estado-badge estado-${pedido.estado}">
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
                    <button class="btn-update-estado"
                        onclick="updateEstado('${pedido.id}')">
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

    const { error } = await supabase
        .from('pedidos')
        .update({ estado: nuevoEstado })
        .eq('id', pedidoId);

    if (error) {
        showToast('Error al actualizar el estado.', 'error');
    } else {
        showToast(`✅ Estado actualizado a: ${nuevoEstado}`, 'success');
        // Actualizar localmente
        const pedido = allPedidos.find(p => p.id === pedidoId);
        if (pedido) pedido.estado = nuevoEstado;
        statsLoaded = false; // forzar recarga
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
   ESTADÍSTICAS — LÓGICA PRINCIPAL
══════════════════════════════════════════════ */
async function loadStats() {
    // Mostrar estado de carga
    document.getElementById('statsLoading').classList.remove('hidden');
    document.getElementById('statsContent').classList.add('hidden');

    try {
        // ── 1. Obtener TODOS los pedidos del vendedor (vía items)
        const { data: items, error: itemsError } = await supabase
            .from('pedido_items')
            .select(`
                pedido_id,
                cantidad,
                precio_unitario,
                productos(id, nombre, vendedor_id)
            `)
            .eq('productos.vendedor_id', currentUser.id);

        if (itemsError) throw itemsError;

        // Filtrar solo items del vendedor
        const myItems = (items || []).filter(
            item => item.productos?.vendedor_id === currentUser.id
        );

        // IDs únicos de pedidos
        const pedidoIds = [...new Set(myItems.map(i => i.pedido_id))];

        // Si no hay pedidos, mostrar vacío
        if (!pedidoIds.length) {
            renderStatsEmpty();
            return;
        }

        // ── 2. Obtener datos de los pedidos
        const { data: pedidos, error: pedidosError } = await supabase
            .from('pedidos')
            .select('id, created_at, total, estado, cliente_nombre, cliente_email')
            .in('id', pedidoIds)
            .order('created_at', { ascending: false });

        if (pedidosError) throw pedidosError;

        // ── 3. Calcular métricas y renderizar
        calcularYRenderizar(pedidos || [], myItems);
        statsLoaded = true;

    } catch (err) {
        console.error('Error cargando estadísticas:', err);
        document.getElementById('statsLoading').innerHTML =
            '<div class="loading-spinner">❌ Error al cargar estadísticas. Recarga la página.</div>';
    }
}

function calcularYRenderizar(pedidos, items) {
    /* ── MÉTRICAS GENERALES ── */
    const ahora     = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    const pedidosMes = pedidos.filter(p => new Date(p.created_at) >= inicioMes);

    const ingresosMes = pedidosMes
        .filter(p => p.estado !== 'cancelado')
        .reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);

    const totalPedidos = pedidos.length;

    const ingresosTotal = pedidos
        .filter(p => p.estado !== 'cancelado')
        .reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);

    const ticketPromedio = totalPedidos > 0
        ? ingresosTotal / totalPedidos
        : 0;

    // Renderizar tarjetas
    document.getElementById('statIngresos').textContent    = formatPrice(ingresosMes);
    document.getElementById('statIngresosSub').textContent =
        `${formatPrice(ingresosTotal)} histórico`;
    document.getElementById('statVentasMes').textContent   = pedidosMes.length;
    document.getElementById('statTotalPedidos').textContent = totalPedidos;
    document.getElementById('statTicket').textContent      = formatPrice(ticketPromedio);

    /* ── GRÁFICO DE BARRAS: últimos 30 días ── */
    renderBarChart(pedidos);

    /* ── TOP 5 PRODUCTOS ── */
    renderTopProducts(items);

    /* ── DISTRIBUCIÓN DE ESTADOS ── */
    renderEstadosChart(pedidos);

    /* ── PEDIDOS RECIENTES ── */
    renderRecentOrders(pedidos.slice(0, 5));

    // Mostrar contenido
    document.getElementById('statsLoading').classList.add('hidden');
    document.getElementById('statsContent').classList.remove('hidden');
}

/* ── Gráfico de barras: pedidos por día (últimos 30 días) ── */
function renderBarChart(pedidos) {
    const barChart  = document.getElementById('barChart');
    const labelsEl  = document.getElementById('barChartLabels');

    // Generar array de los últimos 30 días
    const dias = [];
    const ahora = new Date();

    for (let i = 29; i >= 0; i--) {
        const d = new Date(ahora);
        d.setDate(d.getDate() - i);
        dias.push({
            fecha: d.toISOString().split('T')[0],   // "2024-01-15"
            label: `${d.getDate()}/${d.getMonth() + 1}`,  // "15/1"
            count: 0
        });
    }

    // Contar pedidos por día
    pedidos.forEach(pedido => {
        const fechaPedido = new Date(pedido.created_at).toISOString().split('T')[0];
        const dia = dias.find(d => d.fecha === fechaPedido);
        if (dia) dia.count++;
    });

    // Valor máximo para escalar
    const maxCount = Math.max(...dias.map(d => d.count), 1);

    // Renderizar barras
    barChart.innerHTML = dias.map((dia, index) => {
        const heightPct = maxCount > 0 ? (dia.count / maxCount) * 100 : 0;
        const tooltip   = `${dia.label}: ${dia.count} pedido${dia.count !== 1 ? 's' : ''}`;
        return `
            <div class="bar-item">
                <div class="bar-fill"
                     style="height: ${heightPct}%"
                     data-value="${tooltip}"
                     title="${tooltip}">
                </div>
            </div>
        `;
    }).join('');

    // Renderizar labels (mostrar cada 5 días para no aglomerar)
    labelsEl.innerHTML = dias.map((dia, index) => {
        const show = (index % 5 === 0) || index === 29;
        return `<span class="bar-label ${show ? '' : 'hidden-label'}">${show ? dia.label : ''}</span>`;
    }).join('');
}

/* ── Top 5 productos más vendidos ── */
function renderTopProducts(items) {
    const container = document.getElementById('topProductsList');

    // Agrupar por producto
    const productMap = {};
    items.forEach(item => {
        const pid  = item.productos?.id;
        const name = item.productos?.nombre || 'Producto';
        if (!pid) return;
        if (!productMap[pid]) {
            productMap[pid] = { nombre: name, total: 0 };
        }
        productMap[pid].total += item.cantidad || 1;
    });

    // Ordenar y tomar top 5
    const top5 = Object.values(productMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    if (!top5.length) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-state-icon">🏆</span>
                <p>No hay datos de productos vendidos.</p>
            </div>`;
        return;
    }

    const maxUnits = top5[0].total;

    container.innerHTML = top5.map((product, index) => {
        const rank    = index + 1;
        const pct     = maxUnits > 0 ? (product.total / maxUnits) * 100 : 0;
        const rankClass = `rank-${rank}`;
        return `
            <div class="top-product-item">
                <div class="top-rank ${rankClass}">${rank}</div>
                <div class="top-product-info">
                    <div class="top-product-name" title="${product.nombre}">
                        ${product.nombre}
                    </div>
                    <div class="top-product-bar-wrap">
                        <div class="top-product-bar-bg">
                            <div class="top-product-bar-fill"
                                 style="width: ${pct}%">
                            </div>
                        </div>
                        <span class="top-product-units">${product.total} uds.</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/* ── Distribución de estados ── */
function renderEstadosChart(pedidos) {
    const container = document.getElementById('estadosChart');
    const total     = pedidos.length;

    if (!total) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-state-icon">📋</span>
                <p>No hay pedidos para mostrar.</p>
            </div>`;
        return;
    }

    // Contar por estado
    const estadoMap = {
        pendiente:  0,
        confirmado: 0,
        enviado:    0,
        entregado:  0,
        cancelado:  0
    };

    pedidos.forEach(p => {
        const estado = p.estado || 'pendiente';
        if (estadoMap.hasOwnProperty(estado)) {
            estadoMap[estado]++;
        }
    });

    // Emojis por estado
    const emojis = {
        pendiente:  '⏳',
        confirmado: '✅',
        enviado:    '🚚',
        entregado:  '🎉',
        cancelado:  '❌'
    };

    container.innerHTML = Object.entries(estadoMap).map(([estado, count]) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return `
            <div class="estado-item">
                <div class="estado-header-row">
                    <span class="estado-name">
                        <span class="estado-dot dot-${estado}"></span>
                        ${emojis[estado]} ${capitalizeFirst(estado)}
                    </span>
                    <div class="estado-stats">
                        <span class="estado-count">${count} pedidos</span>
                        <span class="estado-pct">${pct}%</span>
                    </div>
                </div>
                <div class="estado-bar-bg">
                    <div class="estado-bar-fill fill-${estado}"
                         style="width: ${pct}%">
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/* ── Pedidos recientes ── */
function renderRecentOrders(pedidos) {
    const container = document.getElementById('recentOrders');

    if (!pedidos.length) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-state-icon">🕒</span>
                <p>No hay pedidos recientes.</p>
            </div>`;
        return;
    }

    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>
                ${pedidos.map(p => `
                    <tr>
                        <td><strong>#${p.id.slice(-8).toUpperCase()}</strong></td>
                        <td>${p.cliente_nombre || p.cliente_email || '—'}</td>
                        <td>${formatDate(p.created_at)}</td>
                        <td><strong>${formatPrice(p.total)}</strong></td>
                        <td>
                            <span class="estado-badge estado-${p.estado || 'pendiente'}">
                                ${capitalizeFirst(p.estado || 'pendiente')}
                            </span>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

/* Estado vacío general */
function renderStatsEmpty() {
    document.getElementById('statsLoading').classList.add('hidden');
    document.getElementById('statsContent').classList.remove('hidden');

    // Limpiar métricas
    ['statIngresos','statVentasMes','statTotalPedidos','statTicket'].forEach(id => {
        document.getElementById(id).textContent = id.includes('stat') ? '0' : '$0';
    });

    ['barChart','topProductsList','estadosChart','recentOrders'].forEach(id => {
        document.getElementById(id).innerHTML = `
            <div class="empty-state">
                <span class="empty-state-icon">📊</span>
                <p>Sin datos disponibles.</p>
            </div>`;
    });
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
   TOAST
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

/* ── Exponer funciones globales para onclick en HTML ── */
window.editProduct    = editProduct;
window.confirmDelete  = confirmDelete;
window.updateEstado   = updateEstado;
