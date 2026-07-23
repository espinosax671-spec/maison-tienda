/* ===================================================================
   PANEL DE ADMINISTRACIÓN - Lógica MULTI-TIENDA + GESTIÓN EMPLEADOS
   
   ACTUALIZADO: 
   - Soporte para Calzado Unisex
   - Banner con URL personalizada de la tienda + botón compartir
   - Logo dinámico con el nombre de la tienda del dueño
   - Sistema de personalización de tema (colores + fuente)
=================================================================== */

let adminUser = null;
let currentStoreId = null;
let currentStoreName = "";
let currentStoreSlug = null;
let currentUserRole = null;
let allProducts = [];
let allEmployees = [];
let currentFilter = "todos";
let pendingDeleteId = null;
let pendingDeleteEmployeeId = null;
let selectedImageFile = null;

// Variables del sistema de stock
let currentStockProduct = null;
let currentStockData = {};

// Variables del sistema de notificaciones
let notificationsMuted = false;
let notificationSound = null;
let orderSubscription = null;
let lastNotifiedOrderId = null;
let pendingNotificationOrder = null;

// Variables del sistema de diseño/tema
let currentTheme = {
  primary_color: '#d4a869',
  secondary_color: '#1a1410',
  accent_color: '#8f6b3f',
  font: 'Cormorant Garamond',
  template: 'elegante'
};

// Plantillas predefinidas
const DESIGN_TEMPLATES = {
  elegante: {
    name: 'Elegante',
    desc: 'Sofisticado y clásico',
    primary_color: '#d4a869',
    secondary_color: '#1a1410',
    accent_color: '#8f6b3f',
    font: 'Cormorant Garamond'
  },
  femenina: {
    name: 'Femenina',
    desc: 'Delicado y suave',
    primary_color: '#e8b4c8',
    secondary_color: '#2c1a20',
    accent_color: '#c17b95',
    font: 'Playfair Display'
  },
  moderna: {
    name: 'Moderna',
    desc: 'Limpio y minimalista',
    primary_color: '#2c3e50',
    secondary_color: '#1a252f',
    accent_color: '#5d7a94',
    font: 'Poppins'
  },
  deportiva: {
    name: 'Deportiva',
    desc: 'Energético y dinámico',
    primary_color: '#00c853',
    secondary_color: '#0a0a0a',
    accent_color: '#00875a',
    font: 'Montserrat'
  },
  naturaleza: {
    name: 'Naturaleza',
    desc: 'Cálido y orgánico',
    primary_color: '#6b7f3f',
    secondary_color: '#2c2818',
    accent_color: '#a08650',
    font: 'Cormorant Garamond'
  },
  nocturno: {
    name: 'Nocturno',
    desc: 'Misterioso y elegante',
    primary_color: '#6c5ce7',
    secondary_color: '#1e1e2e',
    accent_color: '#a29bfe',
    font: 'Playfair Display'
  }
};

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
// PROTECCIÓN DEL PANEL (MULTI-TIENDA)
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
    .select("id, store_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (staffError || !staff) {
    console.error("No está en staff_users:", staffError);
    await denyAccess("Tu cuenta no está autorizada para acceder al panel.");
    return;
  }

  if (!staff.store_id) {
    await denyAccess("Tu cuenta no está asociada a ninguna tienda. Contacta al soporte.");
    return;
  }

  currentStoreId = staff.store_id;
  currentUserRole = staff.role;
  window.currentStoreId = staff.store_id;
  window.currentUserRole = staff.role;

  const { data: store } = await supabaseClient
    .from("stores")
    .select("name, active, slug, theme_primary_color, theme_secondary_color, theme_accent_color, theme_font, theme_template")
    .eq("id", currentStoreId)
    .maybeSingle();

  if (store && !store.active) {
    await denyAccess("Tu tienda está desactivada. Contacta al soporte.");
    return;
  }

  currentStoreName = store?.name || "Mi Tienda";
  currentStoreSlug = store?.slug || null;

  // Cargar el tema actual
  if (store) {
    currentTheme = {
      primary_color: store.theme_primary_color || '#d4a869',
      secondary_color: store.theme_secondary_color || '#1a1410',
      accent_color: store.theme_accent_color || '#8f6b3f',
      font: store.theme_font || 'Cormorant Garamond',
      template: store.theme_template || 'elegante'
    };
  }

  gate.style.display = "none";
  noAccess.style.display = "none";
  adminApp.style.display = "block";

  document.getElementById("adminUserName").textContent =
    profile.full_name || user.user_metadata?.full_name || user.email;

  const adminLogo = document.querySelector(".admin-logo");
  if (adminLogo && currentStoreName) {
    const nameUpper = currentStoreName.toUpperCase();
    adminLogo.innerHTML = `${nameUpper} <em>panel</em>`;
    
    const nameLength = currentStoreName.length;
    if (nameLength <= 8) {
      adminLogo.setAttribute("data-length", "short");
    } else if (nameLength <= 16) {
      adminLogo.setAttribute("data-length", "medium");
    } else {
      adminLogo.setAttribute("data-length", "long");
    }
  }

  const storeNameEl = document.getElementById("adminStoreName");
  if (storeNameEl) storeNameEl.style.display = "none";

  document.title = `${currentStoreName} - Panel`;

  const esDueño = currentUserRole === "dueño";
  
  const tabEmpleados = document.getElementById("tabEmpleados");
  if (tabEmpleados) {
    tabEmpleados.style.display = esDueño ? "flex" : "none";
  }
  
  const tabDiseno = document.getElementById("tabDiseno");
  if (tabDiseno) {
    tabDiseno.style.display = esDueño ? "flex" : "none";
  }

  displayStoreUrlBanner();

  await loadProducts();
  initNotificationSystem();
  
  if (esDueño) {
    initDesignSystem();
  }
}

// ---------------------------------------------------------------
// Mostrar banner con la URL personalizada
// ---------------------------------------------------------------
function displayStoreUrlBanner() {
  const banner = document.getElementById("storeUrlBanner");
  const urlValueEl = document.getElementById("storeUrlValue");
  const viewBtn = document.getElementById("viewStoreBtn");
  const copyBtn = document.getElementById("copyStoreUrlBtn");
  const shareBtn = document.getElementById("shareStoreBtn");
  
  if (!banner) return;
  
  if (!currentStoreSlug) {
    banner.style.display = "none";
    console.warn("La tienda no tiene slug asignado");
    return;
  }
  
  const fullUrl = `${window.location.origin}/${currentStoreSlug}`;
  const shortUrl = fullUrl.replace(/^https?:\/\//, '');
  
  if (urlValueEl) urlValueEl.textContent = shortUrl;
  
  if (viewBtn) {
    viewBtn.href = `/${currentStoreSlug}`;
  }
  
  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(fullUrl);
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>Copiado</span>
        `;
        copyBtn.classList.add("copied");
        setTimeout(() => {
          copyBtn.innerHTML = originalHTML;
          copyBtn.classList.remove("copied");
        }, 2000);
      } catch (err) {
        console.error("Error al copiar:", err);
        alert("No se pudo copiar. Copia manualmente:\n\n" + fullUrl);
      }
    };
  }
  
  if (shareBtn) {
    shareBtn.onclick = () => {
      const message = `Visita mi tienda ${currentStoreName}\n\n${fullUrl}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, "_blank");
    };
  }
  
  banner.style.display = "block";
  
  console.log(`URL de tienda: ${fullUrl}`);
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
  if (orderSubscription) {
    await supabaseClient.removeChannel(orderSubscription);
    orderSubscription = null;
  }
  
  await supabaseClient.auth.signOut();
  adminUser = null;
  currentStoreId = null;
  currentStoreSlug = null;
  currentUserRole = null;
  window.currentStoreId = null;
  window.currentUserRole = null;
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
// Cargar productos (POR TIENDA)
// ---------------------------------------------------------------
async function loadProducts() {
  const table = document.getElementById("productTable");
  table.innerHTML = `<p class="loading-msg">Cargando productos...</p>`;

  if (!currentStoreId) {
    table.innerHTML = `<p class="empty-msg">No tienes una tienda asignada.</p>`;
    return;
  }

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("store_id", currentStoreId)
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
  
  let filtered;
  if (currentFilter === "todos") {
    filtered = allProducts;
  } else if (currentFilter === "dama") {
    filtered = allProducts.filter((p) => 
      p.category === "dama" || 
      p.category === "calzado_dama" || 
      p.category === "calzado_unisex"
    );
  } else if (currentFilter === "caballero") {
    filtered = allProducts.filter((p) => 
      p.category === "caballero" || 
      p.category === "calzado_caballero" || 
      p.category === "calzado_unisex"
    );
  } else {
    filtered = allProducts.filter((p) => p.category === currentFilter);
  }

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
          ${p.tag ? `<span>- ${escapeHtml(p.tag)}</span>` : ""}
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

// ---------------------------------------------------------------
// Etiquetas de categoría
// ---------------------------------------------------------------
function categoryLabel(c) {
  return { 
    dama: "Dama", 
    caballero: "Caballero", 
    calzado: "Calzado",
    calzado_dama: "Calzado Dama",
    calzado_caballero: "Calzado Caballero",
    calzado_unisex: "Calzado Unisex"
  }[c] || c;
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
      payload.store_id = currentStoreId;
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
    closeEmployeeModal();
    closeDeleteEmployeeModal();
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
  } else if (tabName === "empleados") {
    loadEmployees();
  } else if (tabName === "diseno") {
    refreshDesignUI();
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ===================================================================
// SISTEMA DE DISEÑO / PERSONALIZACIÓN
// ===================================================================

function initDesignSystem() {
  console.log("Inicializando sistema de diseño");
  
  renderTemplates();
  refreshDesignUI();
  setupColorPickers();
  setupFontPickers();
  
  const saveBtn = document.getElementById("saveDesignBtn");
  const resetBtn = document.getElementById("resetDesignBtn");
  
  if (saveBtn) {
    saveBtn.addEventListener("click", saveDesign);
  }
  
  if (resetBtn) {
    resetBtn.addEventListener("click", resetDesign);
  }
}

function renderTemplates() {
  const grid = document.getElementById("templatesGrid");
  if (!grid) return;
  
  grid.innerHTML = "";
  
  Object.keys(DESIGN_TEMPLATES).forEach((key) => {
    const template = DESIGN_TEMPLATES[key];
    const isActive = currentTheme.template === key;
    
    const card = document.createElement("div");
    card.className = `template-card ${isActive ? 'active' : ''}`;
    card.dataset.template = key;
    
    card.innerHTML = `
      <div class="template-colors">
        <div class="template-color" style="background: ${template.primary_color};"></div>
        <div class="template-color" style="background: ${template.secondary_color};"></div>
        <div class="template-color" style="background: ${template.accent_color};"></div>
      </div>
      <div class="template-name" style="font-family: '${template.font}', serif;">${template.name}</div>
      <div class="template-desc">${template.desc}</div>
    `;
    
    card.addEventListener("click", () => applyTemplate(key));
    grid.appendChild(card);
  });
}

function applyTemplate(templateKey) {
  const template = DESIGN_TEMPLATES[templateKey];
  if (!template) return;
  
  currentTheme.primary_color = template.primary_color;
  currentTheme.secondary_color = template.secondary_color;
  currentTheme.accent_color = template.accent_color;
  currentTheme.font = template.font;
  currentTheme.template = templateKey;
  
  refreshDesignUI();
  
  console.log(`Plantilla aplicada: ${template.name}`);
}

function refreshDesignUI() {
  const primaryColorInput = document.getElementById("themePrimaryColor");
  const secondaryColorInput = document.getElementById("themeSecondaryColor");
  const accentColorInput = document.getElementById("themeAccentColor");
  const primaryColorText = document.getElementById("themePrimaryColorText");
  const secondaryColorText = document.getElementById("themeSecondaryColorText");
  const accentColorText = document.getElementById("themeAccentColorText");
  
  if (primaryColorInput) primaryColorInput.value = currentTheme.primary_color;
  if (secondaryColorInput) secondaryColorInput.value = currentTheme.secondary_color;
  if (accentColorInput) accentColorInput.value = currentTheme.accent_color;
  if (primaryColorText) primaryColorText.value = currentTheme.primary_color.toUpperCase();
  if (secondaryColorText) secondaryColorText.value = currentTheme.secondary_color.toUpperCase();
  if (accentColorText) accentColorText.value = currentTheme.accent_color.toUpperCase();
  
  document.querySelectorAll(".font-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.font === currentTheme.font);
  });
  
  document.querySelectorAll(".template-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.template === currentTheme.template);
  });
  
  updatePreview();
}

function setupColorPickers() {
  const pairs = [
    { picker: "themePrimaryColor", text: "themePrimaryColorText", key: "primary_color" },
    { picker: "themeSecondaryColor", text: "themeSecondaryColorText", key: "secondary_color" },
    { picker: "themeAccentColor", text: "themeAccentColorText", key: "accent_color" }
  ];
  
  pairs.forEach(({ picker, text, key }) => {
    const pickerEl = document.getElementById(picker);
    const textEl = document.getElementById(text);
    
    if (pickerEl) {
      pickerEl.addEventListener("input", (e) => {
        currentTheme[key] = e.target.value;
        currentTheme.template = 'custom';
        if (textEl) textEl.value = e.target.value.toUpperCase();
        updatePreview();
        document.querySelectorAll(".template-card").forEach(c => c.classList.remove("active"));
      });
    }
    
    if (textEl) {
      textEl.addEventListener("input", (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          currentTheme[key] = val;
          currentTheme.template = 'custom';
          if (pickerEl) pickerEl.value = val;
          updatePreview();
          document.querySelectorAll(".template-card").forEach(c => c.classList.remove("active"));
        }
      });
    }
  });
}

function setupFontPickers() {
  document.querySelectorAll(".font-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      const font = btn.dataset.font;
      currentTheme.font = font;
      
      document.querySelectorAll(".font-option").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      updatePreview();
    });
  });
}

function updatePreview() {
  const preview = document.getElementById("designPreview");
  const previewHeader = document.getElementById("previewHeader");
  const previewLogo = document.getElementById("previewLogo");
  const previewName = document.querySelector("#designPreview .preview-name");
  const previewPrice = document.getElementById("previewPrice");
  const previewButton = document.getElementById("previewButton");
  
  if (!preview) return;
  
  if (previewLogo) previewLogo.style.fontFamily = `'${currentTheme.font}', serif`;
  if (previewName) previewName.style.fontFamily = `'${currentTheme.font}', serif`;
  
  if (previewLogo) previewLogo.style.color = currentTheme.secondary_color;
  if (previewName) previewName.style.color = currentTheme.secondary_color;
  if (previewPrice) previewPrice.style.color = currentTheme.primary_color;
  
  if (previewButton) {
    previewButton.style.background = `linear-gradient(135deg, ${currentTheme.primary_color}, ${currentTheme.accent_color})`;
  }
  
  if (previewLogo && currentStoreName) {
    previewLogo.textContent = currentStoreName.toUpperCase();
  }
}

async function saveDesign() {
  const btn = document.getElementById("saveDesignBtn");
  const msg = document.getElementById("designSaveMsg");
  
  if (!btn || !currentStoreId) return;
  
  btn.disabled = true;
  const originalHTML = btn.innerHTML;
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
    </svg>
    Guardando...
  `;
  
  try {
    const { error } = await supabaseClient
      .from("stores")
      .update({
        theme_primary_color: currentTheme.primary_color,
        theme_secondary_color: currentTheme.secondary_color,
        theme_accent_color: currentTheme.accent_color,
        theme_font: currentTheme.font,
        theme_template: currentTheme.template
      })
      .eq("id", currentStoreId);
    
    if (error) throw error;
    
    if (msg) {
      msg.textContent = "Diseño guardado correctamente. Los cambios ya se ven en tu tienda.";
      msg.className = "design-save-msg success";
      
      setTimeout(() => {
        msg.textContent = "";
        msg.className = "design-save-msg";
      }, 5000);
    }
    
    console.log("Diseño guardado en Supabase");
    
  } catch (err) {
    console.error("Error al guardar diseño:", err);
    if (msg) {
      msg.textContent = "Error al guardar. Intenta de nuevo.";
      msg.className = "design-save-msg error";
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}

function resetDesign() {
  if (!confirm("Restablecer al diseño original de MAISON?\n\nSe perderán los cambios que no hayas guardado.")) {
    return;
  }
  
  applyTemplate('elegante');
  
  const msg = document.getElementById("designSaveMsg");
  if (msg) {
    msg.textContent = "Diseño restablecido. Recuerda guardar los cambios.";
    msg.className = "design-save-msg success";
    
    setTimeout(() => {
      msg.textContent = "";
      msg.className = "design-save-msg";
    }, 4000);
  }
}

// ===================================================================
// GESTIÓN DE EMPLEADOS
// ===================================================================

const employeeOverlay = document.getElementById("employeeOverlay");
const employeeModal = document.getElementById("employeeModal");
const deleteEmployeeOverlay = document.getElementById("deleteEmployeeOverlay");
const deleteEmployeeModal = document.getElementById("deleteEmployeeModal");

document.getElementById("newEmployeeBtn")?.addEventListener("click", openEmployeeModal);
document.getElementById("employeeModalClose")?.addEventListener("click", closeEmployeeModal);
document.getElementById("cancelEmployeeBtn")?.addEventListener("click", closeEmployeeModal);
employeeOverlay?.addEventListener("click", closeEmployeeModal);

document.getElementById("cancelDeleteEmployeeBtn")?.addEventListener("click", closeDeleteEmployeeModal);
deleteEmployeeOverlay?.addEventListener("click", closeDeleteEmployeeModal);
document.getElementById("confirmDeleteEmployeeBtn")?.addEventListener("click", confirmDeleteEmployee);

function openEmployeeModal() {
  document.getElementById("employeeForm").reset();
  document.getElementById("employeeError").textContent = "";
  document.getElementById("employeeSuccess").textContent = "";
  
  const randomPass = Math.random().toString(36).slice(-8);
  document.getElementById("employeePassword").value = randomPass;
  
  employeeOverlay.classList.add("active");
  employeeModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeEmployeeModal() {
  if (!employeeOverlay || !employeeModal) return;
  employeeOverlay.classList.remove("active");
  employeeModal.classList.remove("active");
  document.body.style.overflow = "";
}

function closeDeleteEmployeeModal() {
  if (!deleteEmployeeOverlay || !deleteEmployeeModal) return;
  deleteEmployeeOverlay.classList.remove("active");
  deleteEmployeeModal.classList.remove("active");
  pendingDeleteEmployeeId = null;
}

async function loadEmployees() {
  const list = document.getElementById("employeesList");
  if (!list) return;
  
  list.innerHTML = `<p class="loading-msg">Cargando empleados...</p>`;

  if (!currentStoreId) {
    list.innerHTML = `<p class="empty-msg">No tienes tienda asignada.</p>`;
    return;
  }

  try {
    const { data, error } = await supabaseClient.rpc("obtener_empleados_tienda", {
      p_store_id: currentStoreId
    });

    if (error) throw error;

    allEmployees = data || [];
    renderEmployeesList();
    updateEmployeesCountBadge();
    
  } catch (err) {
    console.error("Error cargando empleados:", err);
    list.innerHTML = `<p class="empty-msg">No se pudieron cargar los empleados.</p>`;
  }
}

function updateEmployeesCountBadge() {
  const badge = document.getElementById("employeesCountBadge");
  if (!badge) return;
  
  const empleadosCount = allEmployees.filter(e => e.role === 'empleado').length;
  badge.textContent = empleadosCount;
}

function renderEmployeesList() {
  const list = document.getElementById("employeesList");
  if (!list) return;
  
  if (allEmployees.length === 0) {
    list.innerHTML = `
      <div class="employees-empty">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <h3>No hay empleados aún</h3>
        <p>Agrega tu primer empleado para que te ayude a gestionar la tienda.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = "";
  
  allEmployees.forEach((emp) => {
    const isOwner = emp.role === 'dueño';
    const card = document.createElement("div");
    card.className = `employee-card ${isOwner ? 'owner-card' : ''}`;
    card.dataset.employeeId = emp.id;
    
    const initials = getInitials(emp.full_name || emp.email);
    const fecha = emp.added_at 
      ? new Date(emp.added_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })
      : "-";
    
    card.innerHTML = `
      <div class="employee-avatar">${initials}</div>
      <div class="employee-info">
        <div class="employee-name">
          ${escapeHtml(emp.full_name || 'Sin nombre')}
          <span class="employee-role-badge ${isOwner ? 'dueno' : 'empleado'}">
            ${isOwner ? 'Dueño' : 'Empleado'}
          </span>
        </div>
        <div class="employee-details">
          <span class="employee-detail-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            ${escapeHtml(emp.email || '-')}
          </span>
          ${emp.phone ? `
            <span class="employee-detail-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              ${escapeHtml(emp.phone)}
            </span>
          ` : ''}
          <span class="employee-detail-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            ${emp.productos_creados || 0} productos
          </span>
          <span class="employee-detail-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Desde ${fecha}
          </span>
        </div>
      </div>
      <div class="employee-actions">
        ${!isOwner ? `
          <button class="btn-delete-employee" data-delete-employee="${emp.id}" data-name="${escapeHtml(emp.full_name || emp.email)}">
            Eliminar
          </button>
        ` : ''}
      </div>
    `;
    
    list.appendChild(card);
  });

  list.querySelectorAll("[data-delete-employee]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const empId = btn.dataset.deleteEmployee;
      const empName = btn.dataset.name;
      openDeleteEmployeeConfirm(empId, empName);
    });
  });
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function openDeleteEmployeeConfirm(empId, empName) {
  pendingDeleteEmployeeId = empId;
  document.getElementById("deleteEmployeeName").textContent = empName;
  deleteEmployeeOverlay.classList.add("active");
  deleteEmployeeModal.classList.add("active");
}

async function confirmDeleteEmployee() {
  if (!pendingDeleteEmployeeId) return;
  
  const btn = document.getElementById("confirmDeleteEmployeeBtn");
  btn.disabled = true;
  btn.textContent = "Eliminando...";
  
  try {
    const { data, error } = await supabaseClient.rpc("eliminar_empleado_de_tienda", {
      p_employee_id: pendingDeleteEmployeeId,
      p_owner_id: adminUser.id
    });
    
    if (error) throw error;
    
    if (data && data.success === false) {
      alert(data.error || "No se pudo eliminar el empleado.");
      return;
    }
    
    closeDeleteEmployeeModal();
    await loadEmployees();
    alert("Empleado eliminado correctamente.");
    
  } catch (err) {
    console.error("Error al eliminar empleado:", err);
    alert("No se pudo eliminar el empleado. Intenta de nuevo.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Eliminar";
  }
}

document.getElementById("employeeForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const errorEl = document.getElementById("employeeError");
  const successEl = document.getElementById("employeeSuccess");
  errorEl.textContent = "";
  successEl.textContent = "";
  
  const name = document.getElementById("employeeName").value.trim();
  const email = document.getElementById("employeeEmail").value.trim();
  const password = document.getElementById("employeePassword").value;
  const phone = document.getElementById("employeePhone").value.trim();
  const btn = document.getElementById("saveEmployeeBtn");
  
  if (!name || name.length < 3) {
    errorEl.textContent = "El nombre debe tener al menos 3 caracteres.";
    return;
  }
  
  if (!email) {
    errorEl.textContent = "El correo es obligatorio.";
    return;
  }
  
  if (!password || password.length < 6) {
    errorEl.textContent = "La contraseña debe tener al menos 6 caracteres.";
    return;
  }
  
  btn.disabled = true;
  btn.textContent = "Creando...";
  
  try {
    const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: "vendedor",
          whatsapp: phone,
        }
      }
    });
    
    if (signUpError) {
      if (signUpError.message.includes("already registered")) {
        errorEl.textContent = "Este correo ya está registrado. Usa otro correo.";
      } else {
        errorEl.textContent = signUpError.message;
      }
      return;
    }
    
    if (!signUpData.user) {
      errorEl.textContent = "No se pudo crear la cuenta. Intenta de nuevo.";
      return;
    }
    
    const { data, error } = await supabaseClient.rpc("agregar_empleado_a_tienda", {
      p_user_id: signUpData.user.id,
      p_full_name: name,
      p_phone: phone,
      p_store_id: currentStoreId
    });
    
    if (error) throw error;
    
    if (data && data.success === false) {
      errorEl.textContent = data.error || "Error al agregar el empleado.";
      return;
    }
    
    successEl.innerHTML = `
      <strong>Empleado creado correctamente</strong><br>
      Correo: <strong>${email}</strong><br>
      Contraseña: <strong>${password}</strong><br>
      <em style="font-size:11px;">Comparte estas credenciales con tu empleado.</em>
    `;
    
    document.getElementById("employeeForm").reset();
    
    setTimeout(() => {
      closeEmployeeModal();
      loadEmployees();
    }, 5000);
    
  } catch (err) {
    console.error("Error al crear empleado:", err);
    errorEl.textContent = err.message || "No se pudo crear el empleado. Intenta de nuevo.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Crear empleado";
  }
});

// ===================================================================
// CARGAR PEDIDOS DESDE SUPABASE (POR TIENDA)
// ===================================================================

async function loadOrders() {
  const list = document.getElementById("ordersList");
  list.innerHTML = `<p class="loading-msg">Cargando pedidos...</p>`;

  let query = supabaseClient.from("orders").select("*");
  
  if (currentStoreId) {
    query = query.eq("store_id", currentStoreId);
  } else {
    query = query.eq("seller_id", adminUser.id);
  }
  
  const { data, error } = await query.order("created_at", { ascending: false });

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
          <span class="order-item-meta">Talla ${item.size} - Cantidad: ${item.qty}</span>
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
  const confirmMsg = `Confirmar el pedido #${order.order_number}?\n\n` +
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
  const confirmMsg = `Cancelar el pedido #${order.order_number}?\n\n` +
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
  if (!confirm(`Marcar el pedido #${order.order_number} como ENTREGADO?`)) return;
  
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
// FORMATO DE PRECIO COLOMBIANO
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
// SISTEMA DE NOTIFICACIONES
// ===================================================================

function initNotificationSystem() {
  notificationsMuted = localStorage.getItem("maison_notif_muted") === "true";
  updateNotificationButtonUI();
  initNotificationSound();
  subscribeToNewOrders();
  setupNotificationUIListeners();
  checkNotificationPermission();
}

function initNotificationSound() {
  try {
    notificationSound = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmU=");
    notificationSound.volume = 0.5;
  } catch (err) {
    console.warn("No se pudo inicializar el sonido de notificación:", err);
  }
}

function setupNotificationUIListeners() {
  const notifBtn = document.getElementById("notifToggleBtn");
  if (notifBtn) {
    notifBtn.addEventListener("click", toggleNotificationsMute);
  }
  
  const allowBtn = document.getElementById("notifAllowBtn");
  const laterBtn = document.getElementById("notifLaterBtn");
  const closeBtn = document.getElementById("notifBannerClose");
  
  if (allowBtn) allowBtn.addEventListener("click", requestNotificationPermission);
  if (laterBtn) laterBtn.addEventListener("click", dismissNotificationBanner);
  if (closeBtn) closeBtn.addEventListener("click", dismissNotificationBanner);
  
  const toastClose = document.getElementById("onotifClose");
  const toastView = document.getElementById("onotifView");
  
  if (toastClose) toastClose.addEventListener("click", hideOrderNotificationToast);
  if (toastView) toastView.addEventListener("click", handleViewOrderFromNotification);
}

function checkNotificationPermission() {
  if (!("Notification" in window)) {
    console.log("Este navegador no soporta notificaciones");
    return;
  }
  
  if (Notification.permission !== "default") return;
  if (localStorage.getItem("maison_notif_banner_dismissed") === "true") return;
  
  setTimeout(() => {
    const banner = document.getElementById("notifPermissionBanner");
    if (banner) banner.style.display = "block";
  }, 2000);
}

async function requestNotificationPermission() {
  const banner = document.getElementById("notifPermissionBanner");
  
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === "granted") {
      new Notification("MAISON - Notificaciones activadas", {
        body: "Recibirás alertas cuando lleguen nuevos pedidos",
        icon: "/iconos/icon-192.png"
      });
    }
  } catch (err) {
    console.error("Error al solicitar permiso:", err);
  }
  
  if (banner) banner.style.display = "none";
  localStorage.setItem("maison_notif_banner_dismissed", "true");
}

function dismissNotificationBanner() {
  const banner = document.getElementById("notifPermissionBanner");
  if (banner) banner.style.display = "none";
  localStorage.setItem("maison_notif_banner_dismissed", "true");
}

function toggleNotificationsMute() {
  notificationsMuted = !notificationsMuted;
  localStorage.setItem("maison_notif_muted", notificationsMuted.toString());
  updateNotificationButtonUI();
}

function updateNotificationButtonUI() {
  const btn = document.getElementById("notifToggleBtn");
  if (!btn) return;
  
  const iconOn = btn.querySelector(".notif-icon-on");
  const iconOff = btn.querySelector(".notif-icon-off");
  
  if (notificationsMuted) {
    btn.classList.add("muted");
    btn.title = "Notificaciones silenciadas (clic para activar)";
    if (iconOn) iconOn.style.display = "none";
    if (iconOff) iconOff.style.display = "block";
  } else {
    btn.classList.remove("muted");
    btn.title = "Notificaciones activadas (clic para silenciar)";
    if (iconOn) iconOn.style.display = "block";
    if (iconOff) iconOff.style.display = "none";
  }
}

function subscribeToNewOrders() {
  if (!adminUser) return;
  
  if (orderSubscription) {
    supabaseClient.removeChannel(orderSubscription);
  }
  
  const filterStr = currentStoreId 
    ? `store_id=eq.${currentStoreId}` 
    : `seller_id=eq.${adminUser.id}`;
  
  orderSubscription = supabaseClient
    .channel("new-orders-channel")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "orders",
        filter: filterStr
      },
      (payload) => {
        console.log("Nuevo pedido recibido:", payload.new);
        handleNewOrderReceived(payload.new);
      }
    )
    .subscribe((status) => {
      console.log("Estado de suscripción:", status);
    });
}

function handleNewOrderReceived(order) {
  if (lastNotifiedOrderId === order.id) return;
  lastNotifiedOrderId = order.id;
  
  if (currentTab === "pedidos") {
    loadOrders();
  } else {
    allOrders.unshift(order);
    updateOrderCounts();
  }
  
  if (notificationsMuted) return;
  
  pendingNotificationOrder = order;
  showOrderNotificationToast(order);
  playNotificationSound();
  showBrowserNotification(order);
  
  const notifBtn = document.getElementById("notifToggleBtn");
  if (notifBtn) {
    notifBtn.classList.add("has-new");
    setTimeout(() => notifBtn.classList.remove("has-new"), 5000);
  }
}

function showOrderNotificationToast(order) {
  const toast = document.getElementById("orderNotificationToast");
  if (!toast) return;
  
  const customerText = order.customer_name || order.customer_email || "Cliente invitado";
  
  document.getElementById("onotifNumber").textContent = `#${order.order_number}`;
  document.getElementById("onotifCustomer").textContent = customerText;
  document.getElementById("onotifTotal").textContent = formatPrice(order.total);
  document.getElementById("onotifTime").textContent = "Ahora";
  
  toast.classList.remove("hiding");
  toast.classList.add("show");
  
  setTimeout(() => {
    if (toast.classList.contains("show")) {
      hideOrderNotificationToast();
    }
  }, 8000);
}

function hideOrderNotificationToast() {
  const toast = document.getElementById("orderNotificationToast");
  if (!toast) return;
  
  toast.classList.add("hiding");
  setTimeout(() => {
    toast.classList.remove("show", "hiding");
  }, 400);
}

function handleViewOrderFromNotification() {
  hideOrderNotificationToast();
  
  switchTab("pedidos");
  
  document.querySelectorAll("[data-order-filter]").forEach((c) => c.classList.remove("active"));
  const pendingChip = document.querySelector("[data-order-filter='pendiente']");
  if (pendingChip) pendingChip.classList.add("active");
  currentOrderFilter = "pendiente";
  
  setTimeout(() => {
    if (pendingNotificationOrder) {
      const orderCard = document.querySelector(`[data-order-id="${pendingNotificationOrder.id}"]`);
      if (orderCard) {
        orderCard.scrollIntoView({ behavior: "smooth", block: "center" });
        orderCard.style.animation = "none";
        setTimeout(() => {
          orderCard.style.animation = "pulse 1s ease-in-out 2";
        }, 100);
      }
    }
  }, 500);
}

function playNotificationSound() {
  if (!notificationSound || notificationsMuted) return;
  
  try {
    notificationSound.currentTime = 0;
    const playPromise = notificationSound.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.log("No se pudo reproducir sonido:", err);
      });
    }
  } catch (err) {
    console.warn("Error reproduciendo sonido:", err);
  }
}

function showBrowserNotification(order) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  
  try {
    const customerText = order.customer_name || order.customer_email || "Cliente invitado";
    const notification = new Notification("Nuevo pedido en MAISON", {
      body: `#${order.order_number} - ${customerText}\nTotal: ${formatPrice(order.total)}`,
      icon: "/iconos/icon-192.png",
      badge: "/iconos/icon-192.png",
      tag: `order-${order.id}`,
      requireInteraction: false
    });
    
    notification.onclick = () => {
      window.focus();
      handleViewOrderFromNotification();
      notification.close();
    };
    
    setTimeout(() => notification.close(), 10000);
    
  } catch (err) {
    console.warn("Error mostrando notificación:", err);
  }
}
