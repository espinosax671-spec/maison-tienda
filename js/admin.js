/* ===================================================================
   PANEL DE ADMINISTRACIÓN — Lógica
   Requiere: js/supabase-client.js cargado antes que este archivo
   Protegido: solo vendedores autorizados pueden acceder
=================================================================== */

let adminUser = null;
let allProducts = [];
let currentFilter = "todos";
let pendingDeleteId = null;
let selectedImageFile = null;

// Variables del sistema de stock
let currentStockProduct = null;
let currentStockData = {};

// ============ VARIABLES DEL SISTEMA DE NOTIFICACIONES (Mejora #7) ============
let notificationsEnabled = true;         // ¿Están activas las notificaciones?
let notificationsMuted = false;          // ¿Silenciado por el vendedor?
let notificationCheckInterval = null;    // Timer para chequear pedidos nuevos
const NOTIFICATION_CHECK_INTERVAL = 30000; // Cada 30 segundos
const LAST_ORDER_KEY = "maison_last_order_id"; // localStorage key

// ---------------------------------------------------------------
// Elementos
// ---------------------------------------------------------------
const gate = document.getElementById("gate");
const noAccess = document.getElementById("noAccess");
const adminApp = document.getElementById("adminApp");

// ---------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------
document.getElementById("gateForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("gateError");
  errorEl.textContent = "";

  const email = document.getElementById("gateEmail").value.trim();
  const password = document.getElementById("gatePassword").value;
  const btn = document.getElementById("gateSubmitBtn");

  btn.disabled = true;
  btn.textContent = "Ingresando...";

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = "Ingresar al panel";

  if (error) {
    errorEl.textContent = "Correo o contraseña incorrectos.";
    return;
  }

  await checkStaffAndEnter(data.user);
});

// ---------------------------------------------------------------
// PROTECCIÓN DEL PANEL
// ---------------------------------------------------------------
async function checkStaffAndEnter(user) {
  adminUser = user;

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    console.error("No se pudo verificar el perfil:", profileError);
    await denyAccess("No se pudo verificar tu cuenta.");
    return;
  }

  const rolesPermitidos = ["vendedor", "administrador"];
  if (!rolesPermitidos.includes(profile.role)) {
    await denyAccess("Esta cuenta no tiene permisos para acceder al panel.");
    return;
  }

  const { data: staff, error: staffError } = await supabaseClient
    .from("staff_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (staffError || !staff) {
    console.error("No está en staff_users:", staffError);
    await denyAccess("Tu cuenta no está autorizada para acceder al panel.");
    return;
  }

  gate.style.display = "none";
  noAccess.style.display = "none";
  adminApp.style.display = "block";

  document.getElementById("adminUserName").textContent =
    profile.full_name || user.user_metadata?.full_name || user.email;

  await loadProducts();
  
  // ============ INICIAR SISTEMA DE NOTIFICACIONES ============
  initNotificationSystem();
}

async function denyAccess(mensaje) {
  await supabaseClient.auth.signOut();
  adminUser = null;
  alert(mensaje + "\n\nSerás redirigido a la tienda.");
  window.location.href = "index.html";
}

// ---------------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------------
document.getElementById("logoutBtn").addEventListener("click", doLogout);
document.getElementById("noAccessLogout").addEventListener("click", doLogout);

async function doLogout() {
  stopNotificationCheck(); // Detener notificaciones
  await supabaseClient.auth.signOut();
  adminUser = null;
  adminApp.style.display = "none";
  noAccess.style.display = "none";
  gate.style.display = "flex";
  window.location.href = "index.html";
}

// ---------------------------------------------------------------
// Revisar sesión existente al cargar
// ---------------------------------------------------------------
async function initAdmin() {
  const { data } = await supabaseClient.auth.getSession();
  
  if (data.session) {
    await checkStaffAndEnter(data.session.user);
  } else {
    gate.style.display = "flex";
    adminApp.style.display = "none";
    noAccess.style.display = "none";
  }
}

window.addEventListener("DOMContentLoaded", initAdmin);

// ---------------------------------------------------------------
// Cargar productos
// ---------------------------------------------------------------
async function loadProducts() {
  const table = document.getElementById("productTable");
  table.innerHTML = `<p class="loading-msg">Cargando productos...</p>`;

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("created_by", adminUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    table.innerHTML = `<p class="empty-msg">No se pudieron cargar los productos.</p>`;
    console.error(error);
    return;
  }

  allProducts = data;
  renderProductTable();
}

// ---------------------------------------------------------------
// Renderizar tabla de productos
// ---------------------------------------------------------------
function renderProductTable() {
  const table = document.getElementById("productTable");
  const filtered = currentFilter === "todos"
    ? allProducts
    : allProducts.filter((p) => p.category === currentFilter);

  if (filtered.length === 0) {
    table.innerHTML = `<p class="empty-msg">No hay productos en esta categoría todavía.</p>`;
    return;
  }

  table.innerHTML = "";
  filtered.forEach((p) => {
    const totalStock = getTotalStock(p.stock);
    const stockClass = totalStock === 0 ? 'out' : totalStock < 5 ? 'low' : '';
    
    const hasDiscount = p.discount_percent && p.discount_percent > 0 && p.original_price;
    
    let priceHtml = '';
    if (hasDiscount) {
      priceHtml = `
        <div class="product-row-price">
          <span class="price-original-small">${formatPrice(p.original_price)}</span>
          <span class="price-new-small">${formatPrice(p.price)}</span>
          <span class="discount-badge-small">-${p.discount_percent}%</span>
        </div>
      `;
    } else {
      priceHtml = `<div class="product-row-price">${formatPrice(p.price)}</div>`;
    }

    const row = document.createElement("div");
    row.className = "product-row";
    row.innerHTML = `
      <img src="${p.image_url || ''}" alt="${p.name}" class="product-row-img">
      <div class="product-row-info">
        <div class="product-row-name">${escapeHtml(p.name)}</div>
        <div class="product-row-meta">
          <span>${categoryLabel(p.category)}</span>
          ${p.tag ? `<span>· ${escapeHtml(p.tag)}</span>` : ""}
          <span class="stock-badge ${stockClass}">
            ${totalStock} en stock
          </span>
        </div>
      </div>
      ${priceHtml}
      <span class="status-pill ${p.active ? "active" : "inactive"}">${p.active ? "Visible" : "Oculto"}</span>
      <div class="product-row-actions">
        <button class="btn-stock" data-stock="${p.id}">Stock</button>
        <button class="icon-btn" data-edit="${p.id}">Editar</button>
        <button class="icon-btn danger" data-delete="${p.id}">Eliminar</button>
      </div>
    `;
    table.appendChild(row);
  });

  table.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openProductForm(btn.dataset.edit));
  });
  table.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteConfirm(btn.dataset.delete));
  });
  table.querySelectorAll("[data-stock]").forEach((btn) => {
    btn.addEventListener("click", () => openStockModal(btn.dataset.stock));
  });
}

function categoryLabel(c) {
  return { dama: "Dama", caballero: "Caballero", calzado: "Calzado" }[c] || c;
}

function formatPrice(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------------
// Filtros de PRODUCTOS
// ---------------------------------------------------------------
document.querySelectorAll("[data-filter]").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    currentFilter = chip.dataset.filter;
    renderProductTable();
  });
});

// ---------------------------------------------------------------
// Modal: crear o editar producto
// ---------------------------------------------------------------
const formModal = document.getElementById("productFormModal");
const formOverlay = document.getElementById("modalOverlay");

document.getElementById("newProductBtn").addEventListener("click", () => openProductForm(null));
document.getElementById("formModalClose").addEventListener("click", closeProductForm);
document.getElementById("cancelFormBtn").addEventListener("click", closeProductForm);
formOverlay.addEventListener("click", closeProductForm);

function openProductForm(productId) {
  document.getElementById("formError").textContent = "";
  document.getElementById("productForm").reset();
  document.getElementById("imagePreview").style.display = "none";
  selectedImageFile = null;

  const priceHint = document.getElementById("priceHint");
  if (priceHint) {
    priceHint.textContent = "Ingresa el precio sin puntos ni comas";
    priceHint.classList.remove("active");
  }

  document.getElementById("productInitialStock").value = "5";
  document.getElementById("productDiscount").value = "0";
  updateDiscountPreview();

  if (productId) {
    const p = allProducts.find((x) => x.id === productId);
    document.getElementById("formTitle").textContent = "Editar producto";
    document.getElementById("productId").value = p.id;
    document.getElementById("productCategory").value = p.category;
    document.getElementById("productName").value = p.name;
    
    const hasDiscount = p.discount_percent && p.discount_percent > 0 && p.original_price;
    const priceToShow = hasDiscount ? p.original_price : p.price;
    document.getElementById("productPrice").value = formatPriceInput(priceToShow);
    
    document.getElementById("productDiscount").value = p.discount_percent || 0;
    
    document.getElementById("productTag").value = p.tag || "";
    document.getElementById("productDesc").value = p.description || "";
    document.getElementById("productSizes").value = (p.sizes || []).join(", ");
    document.getElementById("productActive").checked = p.active;
    
    const stockInitialLabel = document.getElementById("productInitialStock").closest("label");
    if (stockInitialLabel) stockInitialLabel.style.display = "none";
    
    if (p.image_url) {
      document.getElementById("imagePreview").src = p.image_url;
      document.getElementById("imagePreview").style.display = "block";
    }
    
    if (priceHint && priceToShow > 0) {
      priceHint.textContent = `Precio: $${formatPriceInput(priceToShow)} COP`;
      priceHint.classList.add("active");
    }
    
    updateDiscountPreview();
  } else {
    document.getElementById("formTitle").textContent = "Nuevo producto";
    document.getElementById("productId").value = "";
    document.getElementById("productActive").checked = true;
    
    const stockInitialLabel = document.getElementById("productInitialStock").closest("label");
    if (stockInitialLabel) stockInitialLabel.style.display = "flex";
  }

  formOverlay.classList.add("active");
  formModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeProductForm() {
  formOverlay.classList.remove("active");
  formModal.classList.remove("active");
  document.body.style.overflow = "";
}

document.getElementById("productImageFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  selectedImageFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById("imagePreview").src = ev.target.result;
    document.getElementById("imagePreview").style.display = "block";
  };
  reader.readAsDataURL(file);
});

// ---------------------------------------------------------------
// Guardar producto
// ---------------------------------------------------------------
document.getElementById("productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("formError");
  errorEl.textContent = "";

  const saveBtn = document.getElementById("saveProductBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Guardando...";

  try {
    const id = document.getElementById("productId").value;
    const sizesRaw = document.getElementById("productSizes").value;
    const sizes = sizesRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let imageUrl = id
      ? allProducts.find((p) => p.id === id)?.image_url || null
      : null;

    if (selectedImageFile) {
      imageUrl = await uploadProductImage(selectedImageFile);
    }
    
    const priceInput = parsePriceInput(document.getElementById("productPrice").value);
    const discountInput = parseInt(document.getElementById("productDiscount").value, 10) || 0;
    
    let finalPrice = priceInput;
    let originalPrice = null;
    let discountPercent = 0;
    
    if (discountInput > 0 && discountInput <= 99) {
      originalPrice = priceInput;
      finalPrice = Math.round(priceInput * (1 - discountInput / 100));
      discountPercent = discountInput;
    }

    const payload = {
      category: document.getElementById("productCategory").value,
      name: document.getElementById("productName").value.trim(),
      price: finalPrice,
      original_price: originalPrice,
      discount_percent: discountPercent,
      tag: document.getElementById("productTag").value.trim(),
      description: document.getElementById("productDesc").value.trim(),
      sizes,
      active: document.getElementById("productActive").checked,
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { error } = await supabaseClient.from("products").update(payload).eq("id", id);
      if (error) throw error;
    } else {
      const initialStock = parseInt(document.getElementById("productInitialStock").value, 10) || 0;
      
      const stockObject = {};
      sizes.forEach((size) => {
        stockObject[size] = initialStock;
      });
      
      payload.created_by = adminUser.id;
      payload.stock = stockObject;
      
      const { error } = await supabaseClient.from("products").insert(payload);
      if (error) throw error;
    }

    closeProductForm();
    await loadProducts();
  } catch (err) {
    console.error(err);
    errorEl.textContent = err.message || "No se pudo guardar el producto. Intenta de nuevo.";
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Guardar producto";
  }
});

// ---------------------------------------------------------------
// Subir imagen
// ---------------------------------------------------------------
async function uploadProductImage(file) {
  try {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("La imagen no debe pesar más de 5MB.");
    }

    const ext = file.name.split(".").pop().toLowerCase();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from("product_images")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type
      });

    if (uploadError) {
      console.error("Error al subir imagen:", uploadError);
      throw new Error(`Error al subir imagen: ${uploadError.message}`);
    }

    const { data: urlData } = supabaseClient.storage
      .from("product_images")
      .getPublicUrl(fileName);

    if (!urlData || !urlData.publicUrl) {
      throw new Error("No se pudo obtener la URL de la imagen.");
    }

    return urlData.publicUrl;

  } catch (err) {
    console.error("Error completo:", err);
    throw err;
  }
}

// ---------------------------------------------------------------
// Eliminar producto
// ---------------------------------------------------------------
const deleteOverlay = document.getElementById("deleteOverlay");
const deleteModal = document.getElementById("deleteConfirmModal");

function openDeleteConfirm(productId) {
  pendingDeleteId = productId;
  deleteOverlay.classList.add("active");
  deleteModal.classList.add("active");
}

function closeDeleteConfirm() {
  pendingDeleteId = null;
  deleteOverlay.classList.remove("active");
  deleteModal.classList.remove("active");
}

document.getElementById("cancelDeleteBtn").addEventListener("click", closeDeleteConfirm);
deleteOverlay.addEventListener("click", closeDeleteConfirm);

document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  const { error } = await supabaseClient.from("products").delete().eq("id", pendingDeleteId);
  closeDeleteConfirm();
  if (error) {
    console.error(error);
    return;
  }
  await loadProducts();
});

// ---------------------------------------------------------------
// Cierre con Escape
// ---------------------------------------------------------------
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeProductForm();
    closeDeleteConfirm();
    closeStockModal();
    hideOrderNotificationToast();
  }
});

// ---------------------------------------------------------------
// RECUPERAR CONTRASEÑA
// ---------------------------------------------------------------
document.getElementById("forgotPasswordLink").addEventListener("click", function(e) {
  e.preventDefault();
  document.getElementById("resetOverlay").classList.add("active");
  document.getElementById("resetModal").classList.add("active");
});

document.getElementById("resetModalClose").addEventListener("click", cerrarReset);
document.getElementById("cancelResetBtn").addEventListener("click", cerrarReset);
document.getElementById("resetOverlay").addEventListener("click", cerrarReset);

function cerrarReset() {
  document.getElementById("resetOverlay").classList.remove("active");
  document.getElementById("resetModal").classList.remove("active");
  document.getElementById("resetForm").reset();
  document.getElementById("resetError").textContent = "";
  document.getElementById("resetSuccess").textContent = "";
}

document.getElementById("resetForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  
  const email = document.getElementById("resetEmail").value.trim();
  const errorEl = document.getElementById("resetError");
  const successEl = document.getElementById("resetSuccess");
  const btn = document.getElementById("sendResetBtn");
  
  errorEl.textContent = "";
  successEl.textContent = "";
  btn.disabled = true;
  btn.textContent = "Enviando...";
  
  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password.html"
    });
    
    if (error) throw error;
    
    successEl.innerHTML = "Enviamos el enlace a <strong>" + email + "</strong>. Revisa tu correo (y spam).";
    document.getElementById("resetEmail").value = "";
    
    setTimeout(cerrarReset, 5000);
  } catch (err) {
    errorEl.textContent = err.message || "Error al enviar. Intenta de nuevo.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Enviar enlace";
  }
});

// ---------------------------------------------------------------
// GESTIÓN DE INVENTARIO / STOCK
// ---------------------------------------------------------------
const stockOverlay = document.getElementById("stockOverlay");
const stockModal = document.getElementById("stockModal");

function openStockModal(productId) {
  const product = allProducts.find((p) => p.id === productId);
  if (!product) return;

  currentStockProduct = product;
  currentStockData = { ...(product.stock || {}) };

  (product.sizes || []).forEach((size) => {
    if (currentStockData[size] === undefined) {
      currentStockData[size] = 0;
    }
  });

  document.getElementById("stockProductName").textContent = product.name;
  document.getElementById("stockError").textContent = "";
  renderStockList();

  stockOverlay.classList.add("active");
  stockModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeStockModal() {
  if (!stockOverlay || !stockModal) return;
  stockOverlay.classList.remove("active");
  stockModal.classList.remove("active");
  document.body.style.overflow = "";
  currentStockProduct = null;
  currentStockData = {};
}

function renderStockList() {
  if (!currentStockProduct) return;

  const list = document.getElementById("stockList");
  if (!list) return;

  list.innerHTML = "";

  const sizes = currentStockProduct.sizes || [];
  
  if (sizes.length === 0) {
    list.innerHTML = `<p style="text-align:center; color:#999; padding:1rem;">Este producto no tiene tallas configuradas.</p>`;
    return;
  }
  
  sizes.forEach((size) => {
    const qty = currentStockData[size] || 0;
    const row = document.createElement("div");
    row.className = "stock-row";
    if (qty === 0) row.classList.add("out-of-stock");
    else if (qty < 3) row.classList.add("low-stock");

    let statusText = "Disponible";
    let statusClass = "";
    if (qty === 0) {
      statusText = "Agotado";
      statusClass = "out";
    } else if (qty < 3) {
      statusText = "Stock bajo";
      statusClass = "low";
    }

    row.innerHTML = `
      <div>
        <div class="stock-size-label">${size}</div>
        <div class="stock-status ${statusClass}">${statusText}</div>
      </div>
      <div class="stock-controls">
        <button type="button" class="stock-btn" data-size="${size}" data-action="minus">-</button>
        <input type="number" class="stock-input" data-size="${size}" value="${qty}" min="0" max="9999">
        <button type="button" class="stock-btn" data-size="${size}" data-action="plus">+</button>
      </div>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll(".stock-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!currentStockProduct) return;
      const size = btn.dataset.size;
      const action = btn.dataset.action;
      const current = Number(currentStockData[size]) || 0;

      if (action === "plus") {
        currentStockData[size] = current + 1;
      } else if (action === "minus" && current > 0) {
        currentStockData[size] = current - 1;
      }

      renderStockList();
    });
  });

  list.querySelectorAll(".stock-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      if (!currentStockProduct) return;
      const size = e.target.dataset.size;
      const value = Math.max(0, parseInt(e.target.value) || 0);
      currentStockData[size] = value;
      updateStockTotal();
    });
    input.addEventListener("blur", () => {
      if (currentStockProduct) renderStockList();
    });
  });

  updateStockTotal();
}

function updateStockTotal() {
  const total = Object.values(currentStockData).reduce(
    (sum, qty) => sum + (Number(qty) || 0),
    0
  );
  document.getElementById("stockTotalDisplay").textContent = total;
}

document.getElementById("saveStockBtn").addEventListener("click", async () => {
  if (!currentStockProduct) return;

  const btn = document.getElementById("saveStockBtn");
  const errorEl = document.getElementById("stockError");
  errorEl.textContent = "";
  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    const { error } = await supabaseClient
      .from("products")
      .update({ stock: currentStockData })
      .eq("id", currentStockProduct.id);

    if (error) throw error;

    closeStockModal();
    await loadProducts();
  } catch (err) {
    console.error(err);
    errorEl.textContent = "No se pudo guardar el stock. Intenta de nuevo.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar stock";
  }
});

document.getElementById("cancelStockBtn").addEventListener("click", closeStockModal);
document.getElementById("stockModalClose").addEventListener("click", closeStockModal);
if (stockOverlay) stockOverlay.addEventListener("click", closeStockModal);

function getTotalStock(stock) {
  if (!stock || typeof stock !== "object") return 0;
  return Object.values(stock).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
}

// ===================================================================
// SISTEMA DE TABS
// ===================================================================
let currentTab = "productos";
let allOrders = [];
let currentOrderFilter = "pendiente";

document.querySelectorAll(".admin-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const tabName = tab.dataset.tab;
    switchTab(tabName);
  });
});

function switchTab(tabName) {
  currentTab = tabName;
  
  document.querySelectorAll(".admin-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tabName);
  });
  
  document.querySelectorAll(".admin-view").forEach((v) => {
    v.classList.remove("active");
  });
  
  const targetView = document.getElementById(`view${capitalize(tabName)}`);
  if (targetView) targetView.classList.add("active");
  
  if (tabName === "pedidos") {
    loadOrders();
    // Quitar la alerta de pedidos nuevos cuando el vendedor entra al tab
    const badge = document.getElementById("pendingOrdersBadge");
    if (badge) badge.classList.remove("new-order-alert");
  }

  if (tabName === "estadisticas") {
    loadStatistics();
  }
}

document.getElementById("refreshStatsBtn").addEventListener("click", () => {
  loadStatistics();
});

// ===================================================================
// ESTADÍSTICAS — Dashboard
// ===================================================================
async function loadStatistics() {
  const salesChartEl = document.getElementById("salesChart");
  const topProductsEl = document.getElementById("topProducts");
  const statusDistEl = document.getElementById("statusDistribution");

  salesChartEl.innerHTML = `<p class="loading-msg">Cargando gráfico...</p>`;
  topProductsEl.innerHTML = `<p class="loading-msg">Cargando productos...</p>`;
  statusDistEl.innerHTML = `<p class="loading-msg">Cargando distribución...</p>`;

  // Traemos TODOS los pedidos del vendedor (una sola consulta, reutilizada
  // para las 4 tarjetas + gráfico + top productos + distribución de estados)
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .eq("seller_id", adminUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando estadísticas:", error);
    salesChartEl.innerHTML = `<p class="empty-msg">No se pudieron cargar las estadísticas.</p>`;
    topProductsEl.innerHTML = "";
    statusDistEl.innerHTML = "";
    return;
  }

  const orders = data || [];

  renderStatCards(orders);
  renderSalesChart(orders);
  renderTopProducts(orders);
  renderStatusDistribution(orders);
}

function renderStatCards(orders) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  // "Ventas del mes" e "Ingresos del mes" no cuentan pedidos cancelados
  const ordersThisMonth = orders.filter((o) => {
    const d = new Date(o.created_at);
    return (
      d.getMonth() === thisMonth &&
      d.getFullYear() === thisYear &&
      o.status !== "cancelado"
    );
  });

  const ingresosMes = ordersThisMonth.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const ventasMes = ordersThisMonth.length;
  const pedidosTotales = orders.length;
  const ticketPromedio = ventasMes > 0 ? ingresosMes / ventasMes : 0;

  document.getElementById("statVentasMes").textContent = ventasMes;
  document.getElementById("statPedidosTotales").textContent = pedidosTotales;
  document.getElementById("statIngresosMes").textContent = formatPrice(ingresosMes);
  document.getElementById("statTicketPromedio").textContent = formatPrice(ticketPromedio);
}

function renderSalesChart(orders) {
  const salesChartEl = document.getElementById("salesChart");
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Construimos los últimos 30 días (de más antiguo a más reciente)
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({ date: d, total: 0 });
  }

  orders.forEach((o) => {
    if (o.status === "cancelado") return;
    const d = new Date(o.created_at);
    d.setHours(0, 0, 0, 0);
    const dayEntry = days.find((day) => day.date.getTime() === d.getTime());
    if (dayEntry) dayEntry.total += Number(o.total) || 0;
  });

  const maxTotal = Math.max(...days.map((d) => d.total), 1);

  salesChartEl.innerHTML = "";
  days.forEach((day) => {
    const heightPct = Math.max((day.total / maxTotal) * 100, day.total > 0 ? 4 : 0);
    const dateLabel = day.date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });

    const wrap = document.createElement("div");
    wrap.className = "sales-bar-wrap";
    wrap.innerHTML = `
      <span class="sales-bar-tooltip">${dateLabel}: ${formatPrice(day.total)}</span>
      <div class="sales-bar" style="height: ${heightPct}%;"></div>
    `;
    salesChartEl.appendChild(wrap);
  });
}

function renderTopProducts(orders) {
  const topProductsEl = document.getElementById("topProducts");
  const productMap = {};

  orders.forEach((o) => {
    if (o.status === "cancelado") return;
    (o.items || []).forEach((item) => {
      const key = item.product_id || item.name;
      if (!productMap[key]) {
        productMap[key] = { name: item.name, qty: 0 };
      }
      productMap[key].qty += Number(item.qty) || 0;
    });
  });

  const top5 = Object.values(productMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  if (top5.length === 0) {
    topProductsEl.innerHTML = `<p class="empty-msg">Aún no hay productos vendidos.</p>`;
    return;
  }

  const maxQty = top5[0].qty || 1;

  topProductsEl.innerHTML = top5
    .map((p, i) => `
      <div class="top-product-row">
        <span class="top-product-rank">${i + 1}.</span>
        <div class="top-product-info">
          <span class="top-product-name">${escapeHtml(p.name)}</span>
          <div class="top-product-bar-track">
            <div class="top-product-bar-fill" style="width: ${(p.qty / maxQty) * 100}%;"></div>
          </div>
        </div>
        <span class="top-product-qty">${p.qty} uds</span>
      </div>
    `)
    .join("");
}

function renderStatusDistribution(orders) {
  const statusDistEl = document.getElementById("statusDistribution");
  const statuses = ["pendiente", "confirmado", "entregado", "cancelado"];
  const counts = { pendiente: 0, confirmado: 0, entregado: 0, cancelado: 0 };

  orders.forEach((o) => {
    if (counts[o.status] !== undefined) counts[o.status]++;
  });

  const total = orders.length;

  if (total === 0) {
    statusDistEl.innerHTML = `<p class="empty-msg">Aún no hay pedidos registrados.</p>`;
    return;
  }

  statusDistEl.innerHTML = statuses
    .map((status) => {
      const pct = total > 0 ? Math.round((counts[status] / total) * 100) : 0;
      return `
        <div class="status-row">
          <span class="status-dot ${status}"></span>
          <span class="status-name">${statusLabel(status)}</span>
          <div class="status-bar-track">
            <div class="status-bar-fill ${status}" style="width: ${pct}%;"></div>
          </div>
          <span class="status-pct">${pct}%</span>
        </div>
      `;
    })
    .join("");
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ===================================================================
// CARGAR PEDIDOS
// ===================================================================
async function loadOrders() {
  const list = document.getElementById("ordersList");
  list.innerHTML = `<p class="loading-msg">Cargando pedidos...</p>`;

  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .eq("seller_id", adminUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando pedidos:", error);
    list.innerHTML = `<p class="empty-msg">No se pudieron cargar los pedidos.</p>`;
    return;
  }

  allOrders = data || [];
  updateOrderCounts();
  renderOrders();
}

function updateOrderCounts() {
  const counts = { pendiente: 0, confirmado: 0, entregado: 0, cancelado: 0 };
  
  allOrders.forEach((order) => {
    if (counts[order.status] !== undefined) {
      counts[order.status]++;
    }
  });
  
  document.getElementById("countPendiente").textContent = counts.pendiente;
  document.getElementById("countConfirmado").textContent = counts.confirmado;
  document.getElementById("countEntregado").textContent = counts.entregado;
  document.getElementById("countCancelado").textContent = counts.cancelado;
  
  const badge = document.getElementById("pendingOrdersBadge");
  if (counts.pendiente > 0) {
    badge.textContent = counts.pendiente;
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
  }
}

function renderOrders(highlightOrderId = null) {
  const list = document.getElementById("ordersList");
  const filtered = currentOrderFilter === "todos"
    ? allOrders
    : allOrders.filter((o) => o.status === currentOrderFilter);
  
  if (filtered.length === 0) {
    const mensajes = {
      pendiente: "No hay pedidos pendientes por revisar.",
      confirmado: "No hay pedidos confirmados.",
      entregado: "No hay pedidos entregados.",
      cancelado: "No hay pedidos cancelados.",
      todos: "Aún no hay pedidos."
    };
    list.innerHTML = `<p class="empty-msg">${mensajes[currentOrderFilter]}</p>`;
    return;
  }
  
  list.innerHTML = "";
  filtered.forEach((order) => {
    const card = createOrderCard(order);
    // Destacar el pedido nuevo si aplica
    if (highlightOrderId && order.id === highlightOrderId) {
      card.classList.add("new-order");
      setTimeout(() => {
        card.classList.remove("new-order");
      }, 3000);
    }
    list.appendChild(card);
  });
}

function createOrderCard(order) {
  const card = document.createElement("div");
  card.className = `order-card ${order.status}`;
  card.dataset.orderId = order.id;
  
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  
  let customerHtml = `<div class="order-customer">`;
  if (order.customer_name) {
    customerHtml += `
      <div class="customer-item">
        <strong>Cliente:</strong>
        <span>${escapeHtml(order.customer_name)}</span>
      </div>
    `;
  }
  if (order.customer_phone) {
    const cleanPhone = order.customer_phone.replace(/\D/g, "");
    customerHtml += `
      <div class="customer-item">
        <strong>WhatsApp:</strong>
        <a href="https://wa.me/57${cleanPhone}" target="_blank">${order.customer_phone}</a>
      </div>
    `;
  }
  if (order.customer_email) {
    customerHtml += `
      <div class="customer-item">
        <strong>Email:</strong>
        <span>${escapeHtml(order.customer_email)}</span>
      </div>
    `;
  }
  if (!order.customer_name && !order.customer_phone && !order.customer_email) {
    customerHtml += `<div class="customer-item"><em>Cliente sin datos (invitado)</em></div>`;
  }
  customerHtml += `</div>`;
  
  let itemsHtml = `<div class="order-items">`;
  (order.items || []).forEach((item) => {
    itemsHtml += `
      <div class="order-item">
        <img src="${item.image || ''}" alt="${escapeHtml(item.name)}" class="order-item-img">
        <div class="order-item-info">
          <span class="order-item-name">${escapeHtml(item.name)}</span>
          <span class="order-item-meta">Talla ${item.size} · Cantidad: ${item.qty}</span>
        </div>
        <span class="order-item-price">${formatPrice(item.subtotal)}</span>
      </div>
    `;
  });
  itemsHtml += `</div>`;
  
  let actionsHtml = `<div class="order-actions">`;
  
  if (order.customer_phone) {
    const cleanPhone = order.customer_phone.replace(/\D/g, "");
    actionsHtml += `
      <a href="https://wa.me/57${cleanPhone}?text=${encodeURIComponent(`Hola! Sobre tu pedido #${order.order_number}...`)}" 
         target="_blank" class="btn-action btn-whatsapp" aria-label="Contactar por WhatsApp" title="Contactar por WhatsApp">
        <svg viewBox="0 0 32 32" width="20" height="20" fill="currentColor">
          <path d="M16.003 3C9.373 3 4 8.373 4 15.003c0 2.647.858 5.093 2.316 7.09L4 29l7.116-2.267a11.94 11.94 0 0 0 4.887 1.038h.001C22.634 27.771 28 22.399 28 15.77c0-3.187-1.241-6.183-3.495-8.437A11.925 11.925 0 0 0 16.003 3zm0 21.771h-.003a9.94 9.94 0 0 1-5.062-1.386l-.363-.216-4.222 1.346 1.36-4.114-.236-.377a9.929 9.929 0 0 1-1.523-5.291c0-5.487 4.466-9.953 9.953-9.953a9.888 9.888 0 0 1 7.036 2.914 9.884 9.884 0 0 1 2.914 7.04c0 5.488-4.466 9.953-9.855 9.953l.001.084zm5.458-7.451c-.299-.15-1.769-.873-2.043-.973-.274-.1-.474-.15-.673.15-.199.299-.772.973-.947 1.173-.174.199-.349.224-.648.075-.299-.15-1.264-.466-2.408-1.486-.89-.794-1.491-1.774-1.666-2.073-.174-.299-.019-.461.131-.61.135-.134.299-.349.449-.524.15-.174.199-.299.299-.499.1-.199.05-.374-.025-.524-.075-.15-.673-1.623-.923-2.222-.243-.583-.489-.504-.673-.513-.174-.008-.374-.01-.573-.01a1.098 1.098 0 0 0-.798.374c-.274.299-1.047 1.023-1.047 2.496 0 1.473 1.072 2.895 1.222 3.095.15.199 2.109 3.222 5.115 4.518.716.309 1.274.494 1.71.632.719.229 1.373.196 1.89.119.577-.086 1.769-.723 2.019-1.421.249-.698.249-1.297.174-1.421-.075-.125-.274-.199-.573-.349z"/>
        </svg>
      </a>
    `;
  }
  
  if (order.status === "pendiente") {
    actionsHtml += `
      <button class="btn-action btn-cancel" data-cancel="${order.id}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        <span>Cancelar</span>
      </button>
      <button class="btn-action btn-confirm" data-confirm="${order.id}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>Confirmar</span>
      </button>
    `;
  } else if (order.status === "confirmado") {
    actionsHtml += `
      <button class="btn-action btn-deliver" data-deliver="${order.id}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
        <span>Marcar entregado</span>
      </button>
    `;
  }
  
  actionsHtml += `</div>`;
  
  card.innerHTML = `
    <div class="order-header">
      <div>
        <div class="order-number">#${order.order_number}</div>
        <div class="order-date">${dateStr}</div>
      </div>
      <span class="order-status ${order.status}">${statusLabel(order.status)}</span>
    </div>
    
    ${customerHtml}
    ${itemsHtml}
    
    <div class="order-total-row">
      <span class="order-total-label">Total del pedido</span>
      <span class="order-total-value">${formatPrice(order.total)}</span>
    </div>
    
    ${actionsHtml}
  `;
  
  const confirmBtn = card.querySelector("[data-confirm]");
  if (confirmBtn) confirmBtn.addEventListener("click", () => handleConfirmOrder(order));
  
  const cancelBtn = card.querySelector("[data-cancel]");
  if (cancelBtn) cancelBtn.addEventListener("click", () => handleCancelOrder(order));
  
  const deliverBtn = card.querySelector("[data-deliver]");
  if (deliverBtn) deliverBtn.addEventListener("click", () => handleDeliverOrder(order));
  
  return card;
}

function statusLabel(status) {
  const labels = {
    pendiente: "Pendiente",
    confirmado: "Confirmado",
    entregado: "Entregado",
    cancelado: "Cancelado"
  };
  return labels[status] || status;
}

document.querySelectorAll("[data-order-filter]").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("[data-order-filter]").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    currentOrderFilter = chip.dataset.orderFilter;
    renderOrders();
  });
});

document.getElementById("refreshOrdersBtn").addEventListener("click", () => {
  loadOrders();
});

async function handleConfirmOrder(order) {
  const confirmMsg = `¿Confirmar el pedido #${order.order_number}?\n\n` +
    `Se descontará el stock automáticamente:\n` +
    order.items.map(i => `- ${i.name} (Talla ${i.size}) x ${i.qty}`).join("\n") +
    `\n\nTotal: ${formatPrice(order.total)}`;
  
  if (!confirm(confirmMsg)) return;
  
  try {
    for (const item of order.items) {
      await decrementStock(item.product_id, item.size, item.qty);
    }
    
    const { error } = await supabaseClient
      .from("orders")
      .update({
        status: "confirmado",
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", order.id);
    
    if (error) throw error;
    
    await loadOrders();
    await loadProducts();
    
    alert(`Pedido #${order.order_number} confirmado.\nStock actualizado.`);
    
  } catch (err) {
    console.error("Error al confirmar pedido:", err);
    alert("No se pudo confirmar el pedido. Intenta de nuevo.");
  }
}

async function handleCancelOrder(order) {
  const confirmMsg = `¿Cancelar el pedido #${order.order_number}?\n\n` +
    `No se descontará ningún stock (el pedido no había sido confirmado).`;
  
  if (!confirm(confirmMsg)) return;
  
  try {
    const { error } = await supabaseClient
      .from("orders")
      .update({
        status: "cancelado",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", order.id);
    
    if (error) throw error;
    
    await loadOrders();
    alert(`Pedido #${order.order_number} cancelado.`);
    
  } catch (err) {
    console.error("Error al cancelar pedido:", err);
    alert("No se pudo cancelar el pedido.");
  }
}

async function handleDeliverOrder(order) {
  if (!confirm(`¿Marcar el pedido #${order.order_number} como ENTREGADO?`)) return;
  
  try {
    const { error } = await supabaseClient
      .from("orders")
      .update({
        status: "entregado",
        updated_at: new Date().toISOString()
      })
      .eq("id", order.id);
    
    if (error) throw error;
    
    await loadOrders();
    alert(`Pedido #${order.order_number} marcado como entregado.`);
    
  } catch (err) {
    console.error("Error:", err);
    alert("No se pudo actualizar el pedido.");
  }
}

async function decrementStock(productId, size, qty) {
  const { data: product, error: fetchError } = await supabaseClient
    .from("products")
    .select("stock")
    .eq("id", productId)
    .maybeSingle();
  
  if (fetchError) throw fetchError;
  if (!product) return;
  
  const currentStock = product.stock || {};
  const currentQty = Number(currentStock[size]) || 0;
  const newQty = Math.max(0, currentQty - qty);
  
  const newStock = { ...currentStock, [size]: newQty };
  
  const { error: updateError } = await supabaseClient
    .from("products")
    .update({ stock: newStock })
    .eq("id", productId);
  
  if (updateError) throw updateError;
}

// ===================================================================
// FORMATO DE PRECIO
// ===================================================================
function formatPriceInput(value) {
  if (!value && value !== 0) return "";
  const numericValue = value.toString().replace(/\D/g, "");
  if (!numericValue) return "";
  return new Intl.NumberFormat("es-CO").format(parseInt(numericValue, 10));
}

function parsePriceInput(formattedValue) {
  if (!formattedValue) return 0;
  const digitsOnly = formattedValue.toString().replace(/\D/g, "");
  return parseInt(digitsOnly, 10) || 0;
}

function updateDiscountPreview() {
  const priceInput = document.getElementById("productPrice");
  const discountInput = document.getElementById("productDiscount");
  const preview = document.getElementById("discountPreview");
  
  if (!priceInput || !discountInput || !preview) return;
  
  const price = parsePriceInput(priceInput.value);
  const discount = parseInt(discountInput.value, 10) || 0;
  
  if (discount > 0 && discount <= 99 && price > 0) {
    const newPrice = Math.round(price * (1 - discount / 100));
    const savings = price - newPrice;
    
    preview.classList.add("active");
    preview.innerHTML = `
      <span class="discount-preview-label">Descuento del ${discount}% aplicado:</span>
      <div class="discount-preview-values">
        <span class="discount-preview-old">${formatPrice(price)}</span>
        <span class="discount-preview-new">${formatPrice(newPrice)}</span>
        <span class="discount-preview-savings">Ahorras ${formatPrice(savings)}</span>
      </div>
    `;
  } else {
    preview.classList.remove("active");
    preview.innerHTML = `<span class="discount-preview-label">Sin descuento aplicado</span>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const priceInput = document.getElementById("productPrice");
  const priceHint = document.getElementById("priceHint");
  const discountInput = document.getElementById("productDiscount");
  
  if (!priceInput) return;

  priceInput.addEventListener("input", (e) => {
    const cursorPos = e.target.selectionStart;
    const oldLength = e.target.value.length;
    
    const formatted = formatPriceInput(e.target.value);
    e.target.value = formatted;
    
    const newLength = formatted.length;
    const diff = newLength - oldLength;
    const newCursorPos = Math.max(0, cursorPos + diff);
    e.target.setSelectionRange(newCursorPos, newCursorPos);
    
    const numericValue = parsePriceInput(formatted);
    if (priceHint && numericValue > 0) {
      priceHint.textContent = `Precio: $${formatted} COP`;
      priceHint.classList.add("active");
    } else if (priceHint) {
      priceHint.textContent = "Ingresa el precio sin puntos ni comas";
      priceHint.classList.remove("active");
    }
    
    updateDiscountPreview();
  });
  
  priceInput.addEventListener("blur", (e) => {
    e.target.value = formatPriceInput(e.target.value);
  });
  
  if (discountInput) {
    discountInput.addEventListener("input", (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val)) val = 0;
      if (val < 0) val = 0;
      if (val > 99) val = 99;
      e.target.value = val;
      
      updateDiscountPreview();
    });
  }
});

// ===================================================================
// SISTEMA DE NOTIFICACIONES DE PEDIDOS NUEVOS (Mejora #7)
// ===================================================================

// ---------------------------------------------------------------
// Inicializar sistema de notificaciones
// ---------------------------------------------------------------
function initNotificationSystem() {
  console.log("Inicializando sistema de notificaciones...");
  
  // Cargar estado del silenciador desde localStorage
  const savedMuteState = localStorage.getItem("maison_notifications_muted");
  notificationsMuted = savedMuteState === "true";
  updateNotifToggleBtn();
  
  // Configurar el botón de silenciar
  const notifToggleBtn = document.getElementById("notifToggleBtn");
  if (notifToggleBtn) {
    notifToggleBtn.addEventListener("click", toggleNotificationsMute);
  }
  
  // Configurar botones del banner de permisos
  setupNotificationBanner();
  
  // Verificar si necesitamos pedir permiso
  checkNotificationPermission();
  
  // Iniciar el chequeo periódico
  startNotificationCheck();
}

// ---------------------------------------------------------------
// Verificar y solicitar permisos de notificación
// ---------------------------------------------------------------
function checkNotificationPermission() {
  if (!("Notification" in window)) {
    console.log("Este navegador no soporta notificaciones");
    return;
  }
  
  // Si el usuario ya respondió (default/granted/denied), no molestar
  if (Notification.permission === "granted") {
    console.log("Permiso de notificaciones concedido");
    return;
  }
  
  if (Notification.permission === "denied") {
    console.log("Permisos de notificaciones bloqueados por el usuario");
    return;
  }
  
  // Si ya vio el banner recientemente, no mostrarlo
  const bannerLastShown = localStorage.getItem("maison_notif_banner_shown");
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  
  if (bannerLastShown && (now - parseInt(bannerLastShown, 10)) < oneDayMs) {
    return;
  }
  
  // Mostrar banner de permisos
  setTimeout(() => {
    const banner = document.getElementById("notifPermissionBanner");
    if (banner) banner.classList.add("show");
  }, 2000);
}

// ---------------------------------------------------------------
// Configurar botones del banner de permisos
// ---------------------------------------------------------------
function setupNotificationBanner() {
  const banner = document.getElementById("notifPermissionBanner");
  const allowBtn = document.getElementById("notifAllowBtn");
  const laterBtn = document.getElementById("notifLaterBtn");
  const closeBtn = document.getElementById("notifBannerClose");
  
  if (allowBtn) {
    allowBtn.addEventListener("click", async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          console.log("Permisos concedidos");
          // Notificación de bienvenida
          setTimeout(() => {
            showBrowserNotification(
              "MAISON — Notificaciones activadas",
              "Te avisaremos cuando lleguen pedidos nuevos."
            );
          }, 500);
        }
      } catch (err) {
        console.error("Error al solicitar permisos:", err);
      }
      banner.classList.remove("show");
      localStorage.setItem("maison_notif_banner_shown", Date.now().toString());
    });
  }
  
  if (laterBtn) {
    laterBtn.addEventListener("click", () => {
      banner.classList.remove("show");
      localStorage.setItem("maison_notif_banner_shown", Date.now().toString());
    });
  }
  
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      banner.classList.remove("show");
      localStorage.setItem("maison_notif_banner_shown", Date.now().toString());
    });
  }
}

// ---------------------------------------------------------------
// Toggle: silenciar/activar notificaciones
// ---------------------------------------------------------------
function toggleNotificationsMute() {
  notificationsMuted = !notificationsMuted;
  localStorage.setItem("maison_notifications_muted", notificationsMuted.toString());
  updateNotifToggleBtn();
  
  // Feedback visual
  const btn = document.getElementById("notifToggleBtn");
  if (btn) {
    btn.style.transform = "scale(0.9)";
    setTimeout(() => {
      btn.style.transform = "";
    }, 200);
  }
  
  console.log(`Notificaciones ${notificationsMuted ? "silenciadas" : "activadas"}`);
}

function updateNotifToggleBtn() {
  const btn = document.getElementById("notifToggleBtn");
  const iconOn = btn?.querySelector(".notif-icon-on");
  const iconOff = btn?.querySelector(".notif-icon-off");
  
  if (!btn) return;
  
  if (notificationsMuted) {
    btn.classList.add("muted");
    btn.title = "Notificaciones silenciadas";
    if (iconOn) iconOn.style.display = "none";
    if (iconOff) iconOff.style.display = "block";
  } else {
    btn.classList.remove("muted");
    btn.title = "Notificaciones activadas";
    if (iconOn) iconOn.style.display = "block";
    if (iconOff) iconOff.style.display = "none";
  }
}

// ---------------------------------------------------------------
// Iniciar chequeo periódico de pedidos nuevos
// ---------------------------------------------------------------
function startNotificationCheck() {
  // Guardar el ID del último pedido conocido al iniciar
  saveLastKnownOrderId();
  
  // Chequear cada 30 segundos
  if (notificationCheckInterval) clearInterval(notificationCheckInterval);
  
  notificationCheckInterval = setInterval(checkForNewOrders, NOTIFICATION_CHECK_INTERVAL);
  console.log("Chequeo de pedidos nuevos iniciado (cada 30s)");
}

function stopNotificationCheck() {
  if (notificationCheckInterval) {
    clearInterval(notificationCheckInterval);
    notificationCheckInterval = null;
  }
}

// ---------------------------------------------------------------
// Guardar el ID del último pedido conocido
// ---------------------------------------------------------------
async function saveLastKnownOrderId() {
  try {
    const { data, error } = await supabaseClient
      .from("orders")
      .select("id, created_at")
      .eq("seller_id", adminUser.id)
      .order("created_at", { ascending: false })
      .limit(1);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      localStorage.setItem(LAST_ORDER_KEY, data[0].created_at);
    } else {
      localStorage.setItem(LAST_ORDER_KEY, new Date().toISOString());
    }
  } catch (err) {
    console.error("Error guardando último pedido:", err);
  }
}

// ---------------------------------------------------------------
// Chequear si hay pedidos nuevos
// ---------------------------------------------------------------
async function checkForNewOrders() {
  if (!adminUser) return;
  
  try {
    const lastKnownDate = localStorage.getItem(LAST_ORDER_KEY) || new Date().toISOString();
    
    // Buscar pedidos más nuevos que el último conocido
    const { data, error } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("seller_id", adminUser.id)
      .gt("created_at", lastKnownDate)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      console.log(`${data.length} pedido(s) nuevo(s) detectado(s)`);
      
      // Notificar sobre el pedido más reciente
      const newestOrder = data[0];
      handleNewOrderNotification(newestOrder, data.length);
      
      // Actualizar el último pedido conocido
      localStorage.setItem(LAST_ORDER_KEY, newestOrder.created_at);
      
      // Si estamos en el tab de pedidos, recargar
      if (currentTab === "pedidos") {
        await loadOrders();
      } else {
        // Solo actualizar contadores del badge
        await updatePendingBadge();
      }
    }
  } catch (err) {
    console.error("Error chequeando pedidos nuevos:", err);
  }
}

// ---------------------------------------------------------------
// Actualizar solo el badge del tab (sin cargar toda la lista)
// ---------------------------------------------------------------
async function updatePendingBadge() {
  try {
    const { data, error } = await supabaseClient
      .from("orders")
      .select("status")
      .eq("seller_id", adminUser.id)
      .eq("status", "pendiente");
    
    if (error) throw error;
    
    const badge = document.getElementById("pendingOrdersBadge");
    if (badge) {
      const count = data.length;
      badge.textContent = count;
      if (count > 0) {
        badge.style.display = "inline-block";
        badge.classList.add("new-order-alert");
      } else {
        badge.style.display = "none";
        badge.classList.remove("new-order-alert");
      }
    }
  } catch (err) {
    console.error("Error actualizando badge:", err);
  }
}

// ---------------------------------------------------------------
// Manejar notificación de pedido nuevo
// ---------------------------------------------------------------
function handleNewOrderNotification(order, totalNewCount) {
  if (notificationsMuted) {
    console.log("Notificaciones silenciadas, no se muestra");
    return;
  }
  
  // 1. Sonido de campanita
  playNotificationSound();
  
  // 2. Notificación del navegador
  const customerName = order.customer_name || "Cliente";
  showBrowserNotification(
    `Nuevo pedido #${order.order_number}`,
    `${customerName} · ${formatPrice(order.total)}`,
    order.id
  );
  
  // 3. Toast dorado en el panel
  showOrderNotificationToast(order);
  
  // 4. Actualizar badge del tab con alerta
  const badge = document.getElementById("pendingOrdersBadge");
  if (badge) {
    badge.classList.add("new-order-alert");
  }
}

// ---------------------------------------------------------------
// Reproducir sonido de campanita (Web Audio API)
// ---------------------------------------------------------------
function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    
    // 3 tonos: Do, Mi, Sol (acorde elegante)
    const frequencies = [880, 1108, 1318];
    
    frequencies.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = freq;
      oscillator.type = "sine";
      
      // Fade in y out suave para sonar elegante
      const startTime = ctx.currentTime + (i * 0.15);
      const duration = 0.3;
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    });
    
    console.log("Sonido de notificación reproducido");
  } catch (err) {
    console.error("Error reproduciendo sonido:", err);
  }
}

// ---------------------------------------------------------------
// Notificación del navegador
// ---------------------------------------------------------------
function showBrowserNotification(title, body, orderId = null) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  
  try {
    const notification = new Notification(title, {
      body: body,
      icon: "https://akkuzsztdcseybbxhedb.supabase.co/storage/v1/object/public/product_images/logo-maison.png", // Cambia esto por tu logo
      badge: "https://akkuzsztdcseybbxhedb.supabase.co/storage/v1/object/public/product_images/logo-maison.png",
      tag: `order-${orderId}`, // Evita duplicados
      requireInteraction: false, // Se cierra sola después de unos segundos
      silent: false
    });
    
    // Click en la notificación → ir al pedido
    notification.onclick = function() {
      window.focus();
      if (orderId) {
        switchTab("pedidos");
        setTimeout(() => {
          const orderCard = document.querySelector(`[data-order-id="${orderId}"]`);
          if (orderCard) {
            orderCard.scrollIntoView({ behavior: "smooth", block: "center" });
            orderCard.classList.add("new-order");
            setTimeout(() => orderCard.classList.remove("new-order"), 3000);
          }
        }, 500);
      }
      notification.close();
    };
    
    // Auto-cerrar después de 8 segundos
    setTimeout(() => notification.close(), 8000);
    
  } catch (err) {
    console.error("Error mostrando notificación:", err);
  }
}

// ---------------------------------------------------------------
// Toast de notificación en el panel
// ---------------------------------------------------------------
let orderToastTimeout = null;

function showOrderNotificationToast(order) {
  const toast = document.getElementById("orderNotificationToast");
  if (!toast) return;
  
  // Llenar datos
  document.getElementById("onotifNumber").textContent = `#${order.order_number}`;
  document.getElementById("onotifCustomer").textContent = order.customer_name || "Cliente sin datos";
  document.getElementById("onotifTotal").textContent = formatPrice(order.total);
  document.getElementById("onotifTime").textContent = "Ahora";
  
  // Configurar botón "Ver pedido"
  const viewBtn = document.getElementById("onotifView");
  if (viewBtn) {
    viewBtn.onclick = () => {
      switchTab("pedidos");
      setTimeout(() => {
        const orderCard = document.querySelector(`[data-order-id="${order.id}"]`);
        if (orderCard) {
          orderCard.scrollIntoView({ behavior: "smooth", block: "center" });
          orderCard.classList.add("new-order");
          setTimeout(() => orderCard.classList.remove("new-order"), 3000);
        }
      }, 400);
      hideOrderNotificationToast();
    };
  }
  
  // Configurar botón cerrar
  const closeBtn = document.getElementById("onotifClose");
  if (closeBtn) {
    closeBtn.onclick = hideOrderNotificationToast;
  }
  
  // Mostrar toast
  toast.classList.add("show");
  
  // Auto-cerrar después de 8 segundos
  if (orderToastTimeout) clearTimeout(orderToastTimeout);
  orderToastTimeout = setTimeout(hideOrderNotificationToast, 8000);
}

function hideOrderNotificationToast() {
  const toast = document.getElementById("orderNotificationToast");
  if (toast) toast.classList.remove("show");
  if (orderToastTimeout) clearTimeout(orderToastTimeout);
}
