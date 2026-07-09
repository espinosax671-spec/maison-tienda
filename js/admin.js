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
// Renderizar tabla de productos (CON stock)
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
      <div class="product-row-price">${formatPrice(p.price)}</div>
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

  // Resetear hint del precio
  const priceHint = document.getElementById("priceHint");
  if (priceHint) {
    priceHint.textContent = "Ingresa el precio sin puntos ni comas";
    priceHint.classList.remove("active");
  }

  if (productId) {
    const p = allProducts.find((x) => x.id === productId);
    document.getElementById("formTitle").textContent = "Editar producto";
    document.getElementById("productId").value = p.id;
    document.getElementById("productCategory").value = p.category;
    document.getElementById("productName").value = p.name;
    document.getElementById("productPrice").value = formatPriceInput(p.price);
    document.getElementById("productTag").value = p.tag || "";
    document.getElementById("productDesc").value = p.description || "";
    document.getElementById("productSizes").value = (p.sizes || []).join(", ");
    document.getElementById("productActive").checked = p.active;
    if (p.image_url) {
      document.getElementById("imagePreview").src = p.image_url;
      document.getElementById("imagePreview").style.display = "block";
    }
    
    // Actualizar el hint del precio con el valor cargado
    if (priceHint && p.price > 0) {
      priceHint.textContent = `Precio: $${formatPriceInput(p.price)} COP`;
      priceHint.classList.add("active");
    }
  } else {
    document.getElementById("formTitle").textContent = "Nuevo producto";
    document.getElementById("productId").value = "";
    document.getElementById("productActive").checked = true;
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

// Vista previa de imagen
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

    const payload = {
      category: document.getElementById("productCategory").value,
      name: document.getElementById("productName").value.trim(),
      price: parsePriceInput(document.getElementById("productPrice").value),
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
      payload.created_by = adminUser.id;
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
// Subir imagen a Supabase Storage (bucket: product_images)
// ---------------------------------------------------------------
async function uploadProductImage(file) {
  try {
    // Validar tamaño de imagen (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("La imagen no debe pesar más de 5MB.");
    }

    // Limpiar el nombre del archivo (sin tildes ni caracteres raros)
    const ext = file.name.split(".").pop().toLowerCase();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    console.log("Subiendo imagen:", fileName);

    // Subir al bucket product_images (con guion bajo)
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

    console.log("Imagen subida:", uploadData);

    // Obtener URL pública
    const { data: urlData } = supabaseClient.storage
      .from("product_images")
      .getPublicUrl(fileName);

    if (!urlData || !urlData.publicUrl) {
      throw new Error("No se pudo obtener la URL de la imagen.");
    }

    console.log("URL pública:", urlData.publicUrl);
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
  if (!currentStockProduct) {
    console.warn("renderStockList llamado sin producto activo");
    return;
  }

  const list = document.getElementById("stockList");
  if (!list) {
    console.error("No se encontró #stockList en el HTML");
    return;
  }

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

// Función auxiliar para calcular stock total
function getTotalStock(stock) {
  if (!stock || typeof stock !== "object") return 0;
  return Object.values(stock).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
}

// ===================================================================
// SISTEMA DE TABS (Productos / Pedidos)
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
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ===================================================================
// CARGAR PEDIDOS DESDE SUPABASE
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
  const counts = {
    pendiente: 0,
    confirmado: 0,
    entregado: 0,
    cancelado: 0
  };
  
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

function renderOrders() {
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
    list.appendChild(createOrderCard(order));
  });
}

function createOrderCard(order) {
  const card = document.createElement("div");
  card.className = `order-card ${order.status}`;
  
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
  
  // ============ BOTONES DE ACCIÓN REDISEÑADOS ============
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
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => handleConfirmOrder(order));
  }
  
  const cancelBtn = card.querySelector("[data-cancel]");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => handleCancelOrder(order));
  }
  
  const deliverBtn = card.querySelector("[data-deliver]");
  if (deliverBtn) {
    deliverBtn.addEventListener("click", () => handleDeliverOrder(order));
  }
  
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

// ===================================================================
// FILTROS DE PEDIDOS
// ===================================================================
document.querySelectorAll("[data-order-filter]").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("[data-order-filter]").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    currentOrderFilter = chip.dataset.orderFilter;
    renderOrders();
  });
});

// ===================================================================
// BOTÓN ACTUALIZAR
// ===================================================================
document.getElementById("refreshOrdersBtn").addEventListener("click", () => {
  loadOrders();
});

// ===================================================================
// CONFIRMAR PEDIDO (descuenta stock automáticamente)
// ===================================================================
async function handleConfirmOrder(order) {
  const confirmMsg = `¿Confirmar el pedido #${order.order_number}?\n\n` +
    `Se descontará el stock automáticamente:\n` +
    order.items.map(i => `- ${i.name} (Talla ${i.size}) x ${i.qty}`).join("\n") +
    `\n\nTotal: ${formatPrice(order.total)}`;
  
  if (!confirm(confirmMsg)) return;
  
  try {
    // 1. Descontar stock de cada producto
    for (const item of order.items) {
      await decrementStock(item.product_id, item.size, item.qty);
    }
    
    // 2. Actualizar estado del pedido
    const { error } = await supabaseClient
      .from("orders")
      .update({
        status: "confirmado",
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", order.id);
    
    if (error) throw error;
    
    // 3. Recargar pedidos y productos
    await loadOrders();
    await loadProducts();
    
    alert(`Pedido #${order.order_number} confirmado.\nStock actualizado.`);
    
  } catch (err) {
    console.error("Error al confirmar pedido:", err);
    alert("No se pudo confirmar el pedido. Intenta de nuevo.");
  }
}

// ===================================================================
// CANCELAR PEDIDO
// ===================================================================
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

// ===================================================================
// MARCAR COMO ENTREGADO
// ===================================================================
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

// ===================================================================
// DECREMENTAR STOCK (helper)
// ===================================================================
async function decrementStock(productId, size, qty) {
  const { data: product, error: fetchError } = await supabaseClient
    .from("products")
    .select("stock")
    .eq("id", productId)
    .maybeSingle();
  
  if (fetchError) throw fetchError;
  if (!product) {
    console.warn(`Producto ${productId} no encontrado`);
    return;
  }
  
  const currentStock = product.stock || {};
  const currentQty = Number(currentStock[size]) || 0;
  const newQty = Math.max(0, currentQty - qty);
  
  const newStock = { ...currentStock, [size]: newQty };
  
  const { error: updateError } = await supabaseClient
    .from("products")
    .update({ stock: newStock })
    .eq("id", productId);
  
  if (updateError) throw updateError;
  
  console.log(`Stock descontado: ${productId} - ${size}: ${currentQty} -> ${newQty}`);
}

// ===================================================================
// FORMATO DE PRECIO COLOMBIANO (con puntos de miles)
// ===================================================================

// Formatea un número con puntos como separador de miles: 219000 -> "219.000"
function formatPriceInput(value) {
  if (!value && value !== 0) return "";
  const numericValue = value.toString().replace(/\D/g, "");
  if (!numericValue) return "";
  return new Intl.NumberFormat("es-CO").format(parseInt(numericValue, 10));
}

// Extrae solo los dígitos de un texto formateado: "219.000" -> 219000
function parsePriceInput(formattedValue) {
  if (!formattedValue) return 0;
  const digitsOnly = formattedValue.toString().replace(/\D/g, "");
  return parseInt(digitsOnly, 10) || 0;
}

// Inicializar el input de precio con formato automático
document.addEventListener("DOMContentLoaded", () => {
  const priceInput = document.getElementById("productPrice");
  const priceHint = document.getElementById("priceHint");
  
  if (!priceInput) return;

  priceInput.addEventListener("input", (e) => {
    const cursorPos = e.target.selectionStart;
    const oldLength = e.target.value.length;
    
    const formatted = formatPriceInput(e.target.value);
    e.target.value = formatted;
    
    // Ajustar posición del cursor para que no salte al final
    const newLength = formatted.length;
    const diff = newLength - oldLength;
    const newCursorPos = Math.max(0, cursorPos + diff);
    e.target.setSelectionRange(newCursorPos, newCursorPos);
    
    // Actualizar hint con el valor legible en tiempo real
    const numericValue = parsePriceInput(formatted);
    if (priceHint && numericValue > 0) {
      priceHint.textContent = `Precio: $${formatted} COP`;
      priceHint.classList.add("active");
    } else if (priceHint) {
      priceHint.textContent = "Ingresa el precio sin puntos ni comas";
      priceHint.classList.remove("active");
    }
  });
  
  // Al perder el foco, asegurar que esté bien formateado
  priceInput.addEventListener("blur", (e) => {
    e.target.value = formatPriceInput(e.target.value);
  });
});
