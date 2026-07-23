/* ===================================================================
   MAISON - Lógica de la tienda
   Edita NUMERO_WHATSAPP con tu número (código de país + número, sin +)
   
   ACTUALIZADO: 
   - Soporte para calzado por género y unisex
   - Los pedidos guardan store_id para el sistema multi-tienda
   - Sistema multi-tienda con URLs personalizadas por slug
   - Aplicación de tema personalizado con contraste automático
   - Botones flotantes coordinados con el tema
=================================================================== */

const NUMERO_WHATSAPP = "573001234567";
const CART_STORAGE_KEY = "maison_cart_v1";

let currentStore = null;
let currentStoreSlug = null;
let storeWhatsapp = NUMERO_WHATSAPP;

// ---------------------------------------------------------------
// Detectar la tienda desde la URL
// ---------------------------------------------------------------
function detectStoreSlugFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  let slug = urlParams.get("tienda");
  
  if (!slug) {
    const pathname = window.location.pathname;
    const pathClean = pathname.replace(/^\/+/, "").replace(/\/+$/, "");
    
    const rutasReservadas = ['', 'admin', 'admin.html', 'index.html', 
                             'estadisticas', 'estadisticas.html',
                             'reset-password', 'reset-password.html'];
    
    if (pathClean && !rutasReservadas.includes(pathClean.toLowerCase())) {
      slug = pathClean;
    }
  }
  
  return slug;
}

// ---------------------------------------------------------------
// Cargar datos de la tienda desde Supabase
// ---------------------------------------------------------------
async function loadStoreBySlug(slug) {
  try {
    const { data, error } = await supabaseClient
      .from("stores")
      .select("*")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Error cargando tienda:", err);
    return null;
  }
}

// ---------------------------------------------------------------
// Aplicar tema personalizado (colores + fuente + fondos + contraste)
// ---------------------------------------------------------------
function applyStoreTheme(store) {
  if (!store) return;
  
  const primaryColor = store.theme_primary_color || '#d4a869';
  const secondaryColor = store.theme_secondary_color || '#1a1410';
  const accentColor = store.theme_accent_color || '#8f6b3f';
  const font = store.theme_font || 'Cormorant Garamond';
  
  let styleEl = document.getElementById("customStoreTheme");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "customStoreTheme";
    document.head.appendChild(styleEl);
  }
  
  const primaryRgb = hexToRgb(primaryColor);
  const secondaryRgb = hexToRgb(secondaryColor);
  const accentRgb = hexToRgb(accentColor);
  
  // Generar tonos suaves para fondos
  const bgSoft = lightenColor(primaryColor, 42);
  const bgLighter = lightenColor(primaryColor, 45);
  const bgTinted = lightenColor(primaryColor, 38);
  
  // Determinar contraste automático
  const isSecondaryDark = isColorDark(secondaryColor);
  const textColorDark = isSecondaryDark ? secondaryColor : '#1a1410';
  const textColorLight = '#ffffff';
  
  styleEl.textContent = `
    :root {
      --color-gold: ${primaryColor} !important;
      --color-gold-light: ${lightenColor(primaryColor, 15)} !important;
      --color-gold-dark: ${accentColor} !important;
      --color-ink: ${textColorDark} !important;
      --color-ink-soft: ${lightenColor(textColorDark, 40)} !important;
      --color-bg: ${bgLighter} !important;
      --color-panel: ${bgSoft} !important;
      --color-cream: ${bgSoft} !important;
      --color-beige: ${bgTinted} !important;
      --font-serif: '${font}', serif !important;
    }
    
    /* Fondos principales */
    body {
      background: ${bgLighter} !important;
    }
    
    .catalog:not(.catalog-dark) {
      background: ${bgSoft} !important;
    }
    
    .about {
      background: ${bgTinted} !important;
    }
    
    /* Fuente para elementos importantes */
    .logo,
    .hero-title,
    .section-title,
    .about-title,
    .product-name,
    .modal-name,
    .account-title {
      font-family: '${font}', serif !important;
    }
    
    /* TEXTOS CON MEJOR CONTRASTE */
    .hero-title,
    .hero-title em {
      color: ${textColorDark} !important;
      text-shadow: 0 2px 20px rgba(255, 255, 255, 0.5);
    }
    
    .hero-sub {
      color: ${textColorDark} !important;
      font-weight: 500;
      background: rgba(255, 255, 255, 0.7);
      padding: 12px 20px;
      border-radius: 8px;
      backdrop-filter: blur(5px);
      display: inline-block;
    }
    
    .about-title,
    .about-title em {
      color: ${textColorDark} !important;
    }
    
    .about-text {
      color: ${lightenColor(textColorDark, 25)} !important;
      font-weight: 500;
    }
    
    /* Botones primarios */
    .btn-primary {
      background: linear-gradient(135deg, ${primaryColor}, ${accentColor}) !important;
      color: #ffffff !important;
      border-color: ${primaryColor} !important;
    }
    
    .btn-primary:hover {
      background: linear-gradient(135deg, ${accentColor}, ${primaryColor}) !important;
      box-shadow: 0 6px 20px rgba(${primaryRgb}, 0.4) !important;
    }
    
    /* Precios */
    .product-price,
    .product-price-discounted,
    .modal-price-discounted {
      color: ${accentColor} !important;
    }
    
    /* Header */
    .site-header {
      background: rgba(255, 255, 255, 0.98) !important;
    }
    
    /* Logo */
    .logo {
      color: ${textColorDark} !important;
    }
    
    /* Nav links */
    .nav-link {
      color: ${textColorDark} !important;
    }
    
    .footer-col a:hover,
    .nav-link:hover {
      color: ${accentColor} !important;
    }
    
    /* Sección caballero (oscura) */
    .catalog.catalog-dark {
      background: ${secondaryColor} !important;
    }
    
    .catalog.catalog-dark .section-title,
    .catalog.catalog-dark .section-eyebrow {
      color: #ffffff !important;
    }
    
    /* Botones ghost */
    .btn-ghost {
      color: ${textColorDark} !important;
      border-color: ${textColorDark} !important;
      background: rgba(255, 255, 255, 0.5) !important;
    }
    
    .btn-ghost:hover {
      background: ${textColorDark} !important;
      color: #ffffff !important;
    }
    
    /* Botón hero */
    .hero-actions .btn-primary {
      background: linear-gradient(135deg, ${primaryColor}, ${accentColor}) !important;
    }
    
    /* Eyebrows y texto acentuado */
    .section-eyebrow,
    .hero-eyebrow {
      color: ${accentColor} !important;
      font-weight: 600;
    }
    
    /* Cart badge */
    .cart-count {
      background: ${accentColor} !important;
    }
    
    /* Cards de producto */
    .product-card {
      background: #ffffff !important;
    }
    
    /* Footer */
    .site-footer {
      background: ${secondaryColor} !important;
    }
    
    /* Hero section */
    .hero {
      background: ${bgTinted} !important;
    }
    
    /* Contact section */
    .contact {
      background: ${secondaryColor} !important;
    }
    
    /* Loader */
    .loader {
      background: ${bgLighter} !important;
    }
    
    .loader-mark {
      color: ${primaryColor} !important;
    }
    
    /* Search bar */
    .search-bar {
      background: ${bgSoft} !important;
    }
    
    /* Tabs y filtros activos */
    .filter-chip.active {
      background: ${secondaryColor} !important;
      color: #ffffff !important;
    }
    
    /* Categoría en las tarjetas */
    .product-category {
      color: ${accentColor} !important;
    }
    
    /* BOTONES FLOTANTES (Instalar App y Subir arriba) */
    #installAppBtn {
      background: linear-gradient(135deg, ${secondaryColor}, ${lightenColor(secondaryColor, 10)}) !important;
      color: ${primaryColor} !important;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35), 0 0 0 2px rgba(${primaryRgb}, 0.3) !important;
    }
    
    #installAppBtn:hover {
      background: linear-gradient(135deg, ${primaryColor}, ${accentColor}) !important;
      color: #ffffff !important;
      box-shadow: 0 12px 30px rgba(${primaryRgb}, 0.5) !important;
    }
    
    #scrollTopBtnFixed {
      background: linear-gradient(135deg, ${primaryColor}, ${accentColor}) !important;
      color: #ffffff !important;
      box-shadow: 0 6px 20px rgba(${primaryRgb}, 0.4) !important;
    }
    
    #scrollTopBtnFixed:hover {
      background: linear-gradient(135deg, ${accentColor}, ${primaryColor}) !important;
      box-shadow: 0 12px 30px rgba(${primaryRgb}, 0.6) !important;
    }
    
    /* Mejorar contraste en la sección "Pisada con carácter" (calzado) */
    .catalog .section-title {
      color: ${textColorDark} !important;
    }
    
    /* Modal producto */
    .modal-price {
      color: ${accentColor} !important;
    }
    
    /* Botón WhatsApp del carrito */
    .cart-footer .btn-primary {
      background: linear-gradient(135deg, ${primaryColor}, ${accentColor}) !important;
    }
    
    /* Total del carrito */
    .cart-total-row span:last-child {
      color: ${accentColor} !important;
    }
    
    /* Botón contacto WhatsApp */
    #contactWhatsapp.btn-primary.btn-large {
      background: linear-gradient(135deg, ${primaryColor}, ${accentColor}) !important;
    }
    
    /* Hero scroll indicator */
    .hero-scroll p,
    .hero-scroll span {
      color: ${textColorDark} !important;
    }
    
    /* Tag de producto (Nuevo, Destacado) */
    .product-tag {
      background: ${secondaryColor} !important;
      color: #ffffff !important;
    }
    
    /* Botón favorito */
    .favorite-btn.is-favorite {
      color: #e53935 !important;
    }
  `;
  
  console.log(`Tema aplicado: ${font} + ${primaryColor}`);
}

// ---------------------------------------------------------------
// Convertir color hex a RGB
// ---------------------------------------------------------------
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// ---------------------------------------------------------------
// Aclarar u oscurecer color hex
// ---------------------------------------------------------------
function lightenColor(hex, percent) {
  hex = hex.replace('#', '');
  const num = parseInt(hex, 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  
  return "#" + (0x1000000 + 
    (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 0 ? 0 : B) : 255)
  ).toString(16).slice(1);
}

// ---------------------------------------------------------------
// Determinar si un color es oscuro (para decidir contraste)
// ---------------------------------------------------------------
function isColorDark(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

// ---------------------------------------------------------------
// Aplicar información de la tienda al DOM
// ---------------------------------------------------------------
function applyStoreToDOM(store) {
  if (!store) return;
  
  const logoElements = document.querySelectorAll(".logo");
  logoElements.forEach((logo) => {
    logo.textContent = store.name;
    if (store.name.length > 12) {
      logo.style.fontSize = "clamp(1rem, 3vw, 1.5rem)";
      logo.style.letterSpacing = "0.15em";
    }
  });
  
  document.title = `${store.name} - Ropa y Calzado`;
  
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute("content", `${store.name} - Boutique de ropa y calzado premium.`);
  }
  
  const metaTitle = document.querySelector('meta[property="og:title"]');
  if (metaTitle) {
    metaTitle.setAttribute("content", store.name);
  }
  
  const footerBrand = document.querySelector(".footer-brand .logo");
  if (footerBrand) footerBrand.textContent = store.name;
  
  const footerText = document.querySelector(".footer-brand p");
  if (footerText) footerText.textContent = `Ropa y calzado premium.`;
  
  const footerLegal = document.querySelector(".footer-legal");
  if (footerLegal) {
    footerLegal.innerHTML = `© 2026 ${store.name}. Hecho con cuidado en Colombia. <a href="admin.html" class="admin-link">Panel</a>`;
  }
  
  if (store.whatsapp) {
    storeWhatsapp = store.whatsapp.replace(/\D/g, "");
    if (!storeWhatsapp.startsWith("57")) {
      storeWhatsapp = "57" + storeWhatsapp;
    }
  }
  
  applyStoreTheme(store);
  
  console.log(`Tienda cargada: ${store.name} (${store.slug})`);
}

// ---------------------------------------------------------------
// Mostrar mensaje cuando la tienda no existe
// ---------------------------------------------------------------
function showStoreNotFound(slug) {
  document.querySelectorAll(".catalog, .hero, .about, .contact").forEach(el => {
    el.style.display = "none";
  });
  
  const loader = document.getElementById("loader");
  if (loader) loader.classList.add("hidden");
  
  const errorDiv = document.createElement("div");
  errorDiv.id = "storeNotFound";
  errorDiv.style.cssText = `
    min-height: 80vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    background: linear-gradient(135deg, #f5efe3 0%, #ede4d3 100%);
  `;
  
  errorDiv.innerHTML = `
    <div style="max-width: 500px;">
      <h1 style="font-family: 'Cormorant Garamond', serif; font-size: 2.5rem; color: #1a1410; margin-bottom: 16px; font-weight: 500;">
        Tienda no encontrada
      </h1>
      <p style="font-family: 'Jost', sans-serif; color: #666; font-size: 1rem; line-height: 1.6; margin-bottom: 32px;">
        La tienda <strong>"${slug}"</strong> no existe o ya no está disponible.
      </p>
      <a href="/" style="
        display: inline-block;
        padding: 14px 32px;
        background: linear-gradient(135deg, #c9a96e, #8f6b3f);
        color: #ffffff;
        text-decoration: none;
        border-radius: 8px;
        font-family: 'Jost', sans-serif;
        font-size: 0.85rem;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        font-weight: 600;
        box-shadow: 0 6px 20px rgba(143, 107, 63, 0.3);
      ">
        Ir al inicio
      </a>
    </div>
  `;
  
  document.body.appendChild(errorDiv);
}

// ---------------------------------------------------------------
// Formato de precio en pesos colombianos
// ---------------------------------------------------------------
function formatPrice(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);
}

// ---------------------------------------------------------------
// PERSISTENCIA DEL CARRITO
// ---------------------------------------------------------------
function saveCartToStorage() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (err) {
    console.error("No se pudo guardar el carrito:", err);
  }
}

function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error("No se pudo cargar el carrito:", err);
  }
  return [];
}

function clearCartStorage() {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch (err) {
    console.error("No se pudo limpiar el carrito:", err);
  }
}

let cart = loadCartFromStorage();
let userFavorites = new Set();

function getCartKey(productId, size) {
  return `${productId}__${size}`;
}

function addToCart(product, size, quantity = 1) {
  const key = getCartKey(product.id, size);
  const existing = cart.find((item) => item.key === key);
  if (existing) {
    existing.qty += quantity;
  } else {
    cart.push({
      key,
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      size,
      qty: quantity,
    });
  }
  saveCartToStorage();
  renderCart();
  showToast(product.name, quantity);
  openCart();
}

function removeFromCart(key) {
  cart = cart.filter((item) => item.key !== key);
  saveCartToStorage();
  renderCart();
}

function updateCartQty(key, newQty) {
  const item = cart.find((i) => i.key === key);
  if (!item) return;
  if (newQty <= 0) {
    removeFromCart(key);
    return;
  }
  item.qty = newQty;
  saveCartToStorage();
  renderCart();
}

function clearCart() {
  cart = [];
  clearCartStorage();
  renderCart();
}

function cartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function cartCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

// ---------------------------------------------------------------
// Catálogo desde Supabase
// ---------------------------------------------------------------
let STORE_PRODUCTS = [];

async function fetchProductsFromSupabase() {
  try {
    let query = supabaseClient
      .from("products")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });
    
    if (currentStore && currentStore.id) {
      query = query.eq("store_id", currentStore.id);
    }
    
    const { data, error } = await query;

    if (error) throw error;
    if (!data || data.length === 0) {
      if (currentStore) return [];
      return typeof PRODUCTS !== "undefined" ? PRODUCTS : [];
    }

    return data.map((p) => ({
      id: p.id,
      category: p.category,
      name: p.name,
      price: p.price,
      original_price: p.original_price || null,
      discount_percent: p.discount_percent || 0,
      image: p.image_url || "",
      tag: p.tag || "",
      desc: p.description || "",
      sizes: p.sizes && p.sizes.length > 0 ? p.sizes : ["Única"],
      stock: p.stock || {},
    }));
  } catch (err) {
    console.error("No se pudo cargar el catálogo desde Supabase:", err);
    return typeof PRODUCTS !== "undefined" ? PRODUCTS : [];
  }
}

// ---------------------------------------------------------------
// Determinar en qué grid(s) va cada producto
// ---------------------------------------------------------------
function getGridsForCategory(category) {
  const mapping = {
    "dama": ["dama"],
    "caballero": ["caballero"],
    "calzado": ["calzado"],
    "calzado_dama": ["dama", "calzado"],
    "calzado_caballero": ["caballero", "calzado"],
    "calzado_unisex": ["dama", "caballero", "calzado"]
  };
  return mapping[category] || [];
}

// ---------------------------------------------------------------
// Render del catálogo
// ---------------------------------------------------------------
async function renderCatalog() {
  const grids = {
    dama: document.getElementById("damaGrid"),
    caballero: document.getElementById("caballeroGrid"),
    calzado: document.getElementById("calzadoGrid"),
  };

  STORE_PRODUCTS = await fetchProductsFromSupabase();
  
  if (currentStore && STORE_PRODUCTS.length === 0) {
    Object.values(grids).forEach(grid => {
      if (grid) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #666;">
            <h3 style="font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; margin-bottom: 8px; color: #1a1410;">
              Sin productos en esta categoría
            </h3>
            <p style="font-family: 'Jost', sans-serif;">
              ${currentStore.name} aún no tiene productos en esta categoría.
            </p>
          </div>
        `;
      }
    });
    return;
  }

  STORE_PRODUCTS.forEach((product) => {
    const targetGrids = getGridsForCategory(product.category);
    
    if (targetGrids.length === 0) {
      console.warn(`Categoría desconocida: ${product.category}`);
      return;
    }

    targetGrids.forEach((gridId) => {
      const grid = grids[gridId];
      if (!grid) return;

      const card = createProductCard(product);
      grid.appendChild(card);
    });
  });
}

// ---------------------------------------------------------------
// Crear la tarjeta de producto
// ---------------------------------------------------------------
function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card reveal";
  card.dataset.productName = normalizeText(product.name);
  card.dataset.productCategory = normalizeText(product.category);
  card.dataset.productTag = normalizeText(product.tag);
  card.dataset.productPrice = product.price;
  card.dataset.productId = product.id;
  
  const isFav = userFavorites.has(product.id);
  
  const hasDiscount = product.discount_percent && product.discount_percent > 0 && product.original_price;
  
  let priceHtml = "";
  if (hasDiscount) {
    priceHtml = `
      <div class="product-price-wrap">
        <span class="product-price-original">${formatPrice(product.original_price)}</span>
        <span class="product-price-discounted">${formatPrice(product.price)}</span>
      </div>
    `;
  } else {
    priceHtml = `<p class="product-price">${formatPrice(product.price)}</p>`;
  }
  
  let discountBadgeHtml = "";
  if (hasDiscount) {
    discountBadgeHtml = `
      <span class="discount-badge">
        <span class="discount-badge-percent">-${product.discount_percent}%</span>
        <span class="discount-badge-label">OFERTA</span>
      </span>
    `;
  }
  
  card.innerHTML = `
    <div class="product-image">
      ${product.tag ? `<span class="product-tag">${product.tag}</span>` : ""}
      ${discountBadgeHtml}
      <button type="button" class="favorite-btn ${isFav ? 'is-favorite' : ''}" data-favorite-btn="${product.id}" aria-label="Añadir a favoritos" title="Añadir a favoritos">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
      <img src="${product.image}" alt="${product.name}" loading="lazy">
    </div>
    <div class="product-info">
      <span class="product-category">${categoryLabel(product.category)}</span>
      <h3 class="product-name">${product.name}</h3>
      ${priceHtml}
    </div>
  `;
  
  card.addEventListener("click", (e) => {
    if (e.target.closest(".favorite-btn")) return;
    openProductModal(product);
  });
  
  const favBtn = card.querySelector(".favorite-btn");
  if (favBtn) {
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(product);
    });
  }
  
  return card;
}

// ---------------------------------------------------------------
// Etiquetas de categoría
// ---------------------------------------------------------------
function categoryLabel(category) {
  const labels = { 
    dama: "Dama", 
    caballero: "Caballero", 
    calzado: "Calzado",
    calzado_dama: "Calzado Dama",
    calzado_caballero: "Calzado Caballero",
    calzado_unisex: "Calzado Unisex"
  };
  return labels[category] || category;
}

// ---------------------------------------------------------------
// Helpers de stock
// ---------------------------------------------------------------
function getStockForSize(product, size) {
  if (!product.stock || typeof product.stock !== "object") return null;
  const qty = product.stock[size];
  return typeof qty === "number" ? qty : null;
}

function getTotalStock(product) {
  if (!product.stock || typeof product.stock !== "object") return 0;
  return Object.values(product.stock).reduce((sum, q) => sum + (Number(q) || 0), 0);
}

// ---------------------------------------------------------------
// Modal de producto
// ---------------------------------------------------------------
let currentProduct = null;
let currentSize = null;
let currentQuantity = 1;
let currentMaxStock = 99;

function openProductModal(product) {
  currentProduct = product;
  currentSize = null;
  currentQuantity = 1;
  currentMaxStock = 99;

  document.getElementById("modalImg").src = product.image;
  document.getElementById("modalImg").alt = product.name;
  document.getElementById("modalCategory").textContent = categoryLabel(product.category);
  document.getElementById("modalName").textContent = product.name;
  
  const modalPriceEl = document.getElementById("modalPrice");
  const hasDiscount = product.discount_percent && product.discount_percent > 0 && product.original_price;
  
  if (hasDiscount) {
    const savings = product.original_price - product.price;
    modalPriceEl.innerHTML = `
      <div class="modal-price-wrap">
        <span class="modal-price-original">${formatPrice(product.original_price)}</span>
        <span class="modal-price-discounted">${formatPrice(product.price)}</span>
        <span class="modal-discount-badge">-${product.discount_percent}%</span>
      </div>
      <div class="modal-savings-msg">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Ahorras ${formatPrice(savings)} con esta oferta
      </div>
    `;
  } else {
    modalPriceEl.innerHTML = formatPrice(product.price);
  }
  
  document.getElementById("modalDesc").textContent = product.desc;

  const sizesWrap = document.getElementById("modalSizes");
  sizesWrap.innerHTML = "";
  
  const hasStockConfig = product.stock && Object.keys(product.stock).length > 0;
  
  product.sizes.forEach((size) => {
    const btn = document.createElement("button");
    btn.className = "size-btn";
    btn.type = "button";
    
    const stockQty = getStockForSize(product, size);
    
    if (hasStockConfig) {
      if (stockQty === 0 || stockQty === null) {
        btn.classList.add("size-out");
        btn.disabled = true;
        btn.innerHTML = `${size}<span class="size-label">Agotado</span>`;
      } else if (stockQty < 3) {
        btn.classList.add("size-low");
        btn.innerHTML = `${size}<span class="size-label">Últimas ${stockQty}</span>`;
      } else {
        btn.textContent = size;
      }
    } else {
      btn.textContent = size;
    }
    
    if (!btn.disabled) {
      btn.addEventListener("click", () => {
        currentSize = size;
        currentMaxStock = hasStockConfig ? stockQty : 99;
        currentQuantity = 1;
        sizesWrap.querySelectorAll(".size-btn").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        renderQuantitySelector();
      });
    }
    
    sizesWrap.appendChild(btn);
  });
  
  const totalStock = hasStockConfig ? getTotalStock(product) : 999;
  const addBtn = document.getElementById("modalAddBtn");
  if (totalStock === 0) {
    addBtn.disabled = true;
    addBtn.textContent = "Producto agotado";
  } else {
    addBtn.disabled = false;
    addBtn.textContent = "Añadir a la selección";
  }

  renderQuantitySelector();
  closeShareMenu();

  document.getElementById("productOverlay").classList.add("active");
  document.getElementById("productModal").classList.add("active");
  document.body.style.overflow = "hidden";
}

function renderQuantitySelector() {
  let qtyWrap = document.getElementById("modalQuantityWrap");
  
  if (!qtyWrap) {
    qtyWrap = document.createElement("div");
    qtyWrap.id = "modalQuantityWrap";
    qtyWrap.className = "modal-quantity-wrap";
    const addBtn = document.getElementById("modalAddBtn");
    if (addBtn) addBtn.parentNode.insertBefore(qtyWrap, addBtn);
  }

  qtyWrap.innerHTML = `
    <label class="modal-quantity-label">Cantidad</label>
    <div class="quantity-selector">
      <button type="button" class="qty-btn" id="qtyMinusBtn" aria-label="Disminuir">-</button>
      <span class="qty-value" id="qtyValue">${currentQuantity}</span>
      <button type="button" class="qty-btn" id="qtyPlusBtn" aria-label="Aumentar">+</button>
    </div>
  `;

  const btnMinus = qtyWrap.querySelector("#qtyMinusBtn");
  const btnPlus = qtyWrap.querySelector("#qtyPlusBtn");
  const display = qtyWrap.querySelector("#qtyValue");

  btnMinus.onclick = () => {
    if (currentQuantity > 1) {
      currentQuantity--;
      display.textContent = currentQuantity;
    }
  };
  btnPlus.onclick = () => {
    if (currentQuantity < currentMaxStock) {
      currentQuantity++;
      display.textContent = currentQuantity;
    }
  };
}

function closeProductModal() {
  document.getElementById("productOverlay").classList.remove("active");
  document.getElementById("productModal").classList.remove("active");
  document.body.style.overflow = "";
  closeShareMenu();
}

document.getElementById("modalAddBtn").addEventListener("click", () => {
  if (!currentProduct) return;
  if (!currentSize) {
    const sizesWrap = document.getElementById("modalSizes");
    sizesWrap.style.outline = "1px solid #b00";
    setTimeout(() => (sizesWrap.style.outline = ""), 900);
    return;
  }
  addToCart(currentProduct, currentSize, currentQuantity);
  closeProductModal();
});

document.getElementById("modalClose").addEventListener("click", closeProductModal);
document.getElementById("productOverlay").addEventListener("click", closeProductModal);

// ---------------------------------------------------------------
// Render del carrito
// ---------------------------------------------------------------
function renderCart() {
  const itemsWrap = document.getElementById("cartItems");
  const countBadge = document.getElementById("cartCount");
  const totalLabel = document.getElementById("cartTotal");

  itemsWrap.innerHTML = "";
  countBadge.textContent = cartCount();
  totalLabel.textContent = formatPrice(cartTotal());

  if (cart.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "cart-empty";
    emptyMsg.id = "cartEmptyMsg";
    emptyMsg.textContent = "Aún no has añadido prendas.";
    itemsWrap.appendChild(emptyMsg);
    updateWhatsappLinks();
    return;
  }

  cart.forEach((item) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <img src="${item.image}" alt="${item.name}" class="cart-item-img">
      <div class="cart-item-info">
        <span class="cart-item-name">${item.name}</span>
        <span class="cart-item-meta">Talla ${item.size}</span>
        <div class="cart-item-controls">
          <div class="quantity-selector-small">
            <button type="button" class="qty-btn-small" data-minus="${item.key}" aria-label="Disminuir">-</button>
            <span class="qty-value-small">${item.qty}</span>
            <button type="button" class="qty-btn-small" data-plus="${item.key}" aria-label="Aumentar">+</button>
          </div>
          <span class="cart-item-price">${formatPrice(item.price * item.qty)}</span>
        </div>
        <button class="cart-item-remove" data-key="${item.key}">Quitar</button>
      </div>
    `;
    itemsWrap.appendChild(row);
  });

  itemsWrap.querySelectorAll("[data-minus]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const key = e.target.dataset.minus;
      const item = cart.find((i) => i.key === key);
      if (item) updateCartQty(key, item.qty - 1);
    });
  });

  itemsWrap.querySelectorAll("[data-plus]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const key = e.target.dataset.plus;
      const item = cart.find((i) => i.key === key);
      if (item) updateCartQty(key, item.qty + 1);
    });
  });

  itemsWrap.querySelectorAll(".cart-item-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => removeFromCart(e.target.dataset.key));
  });

  updateWhatsappLinks();
}

function openCart() {
  document.getElementById("cartOverlay").classList.add("active");
  document.getElementById("cartPanel").classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeCart() {
  document.getElementById("cartOverlay").classList.remove("active");
  document.getElementById("cartPanel").classList.remove("active");
  document.body.style.overflow = "";
}

document.getElementById("cartToggle").addEventListener("click", openCart);
document.getElementById("cartClose").addEventListener("click", closeCart);
document.getElementById("cartOverlay").addEventListener("click", closeCart);

// ---------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------
function buildOrderMessage(orderNumber = null) {
  if (cart.length === 0) return "Hola, quisiera más información sobre sus prendas.";

  const storeName = currentStore ? currentStore.name : "";
  let msg = storeName ? `Hola ${storeName}! Quiero hacer este pedido:\n\n` : "Hola! Quiero hacer este pedido:\n\n";
  
  if (orderNumber) {
    msg += `*Pedido #${orderNumber}*\n\n`;
  }
  
  cart.forEach((item) => {
    msg += `- ${item.name} (Talla ${item.size}) x ${item.qty} - ${formatPrice(item.price * item.qty)}\n`;
  });
  msg += `\n*Total: ${formatPrice(cartTotal())}*\n\n¿Cómo procedemos con el pago?`;
  return msg;
}

function updateWhatsappLinks() {
  const baseUrl = `https://wa.me/${storeWhatsapp}`;
  const storeName = currentStore ? currentStore.name : "";
  const greeting = storeName ? `Hola ${storeName}, ` : "Hola, ";
  
  const contactLink = document.getElementById("contactWhatsapp");
  if (contactLink) {
    contactLink.href = `${baseUrl}?text=${encodeURIComponent(greeting + "tengo una pregunta sobre sus productos.")}`;
  }
}

// ---------------------------------------------------------------
// MENÚ MÓVIL
// ---------------------------------------------------------------
const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    menuToggle.classList.toggle("active");
    mainNav.classList.toggle("open");
  });
}

if (mainNav) {
  mainNav.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      menuToggle.classList.remove("active");
      mainNav.classList.remove("open");
    });
  });
}

// ---------------------------------------------------------------
// Scroll reveal
// ---------------------------------------------------------------
function initScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

// ---------------------------------------------------------------
// Header scroll
// ---------------------------------------------------------------
let lastScroll = 0;
const header = document.getElementById("siteHeader");

window.addEventListener("scroll", () => {
  const current = window.scrollY;
  if (current > lastScroll && current > 120) {
    if (header) header.style.transform = "translateY(-100%)";
  } else {
    if (header) header.style.transform = "translateY(0)";
  }
  lastScroll = current;
});

// ---------------------------------------------------------------
// INICIALIZACIÓN
// ---------------------------------------------------------------
window.addEventListener("DOMContentLoaded", async () => {
  currentStoreSlug = detectStoreSlugFromUrl();
  
  if (currentStoreSlug) {
    console.log(`Cargando tienda: ${currentStoreSlug}`);
    
    currentStore = await loadStoreBySlug(currentStoreSlug);
    
    if (!currentStore) {
      console.warn(`Tienda "${currentStoreSlug}" no encontrada`);
      showStoreNotFound(currentStoreSlug);
      return;
    }
    
    applyStoreToDOM(currentStore);
    
    window.currentStore = currentStore;
    window.currentStoreSlug = currentStoreSlug;
  } else {
    console.log("Vista general (sin tienda específica)");
  }
  
  await loadUserFavorites();
  await renderCatalog();
  renderCart();
  updateWhatsappLinks();
  initScrollReveal();

  setTimeout(() => {
    const loader = document.getElementById("loader");
    if (loader) loader.classList.add("hidden");
  }, 600);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeCart();
    closeProductModal();
    closeSearchBar();
    closeShareMenu();
  }
});

// ---------------------------------------------------------------
// NOTIFICACIÓN TOAST
// ---------------------------------------------------------------
let toastTimeout = null;

function showToast(productName, quantity) {
  const toast = document.getElementById("toast");
  const message = document.getElementById("toastMessage");
  if (!toast || !message) return;

  message.textContent = `${productName} x ${quantity}`;
  toast.classList.add("active");

  if (toastTimeout) clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("active");
  }, 3000);
}

function showCustomToast(title, message) {
  const toast = document.getElementById("toast");
  const titleEl = toast?.querySelector(".toast-title");
  const messageEl = document.getElementById("toastMessage");
  
  if (!toast || !titleEl || !messageEl) return;

  titleEl.textContent = title;
  messageEl.textContent = message;
  toast.classList.add("active");

  if (toastTimeout) clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("active");
    setTimeout(() => {
      titleEl.textContent = "Añadido al carrito";
    }, 500);
  }, 3000);
}

// ---------------------------------------------------------------
// SISTEMA DE PEDIDOS
// ---------------------------------------------------------------

async function createOrderInDatabase() {
  if (cart.length === 0) return null;
  
  try {
    let storeId = currentStore ? currentStore.id : null;
    let sellerId = null;
    
    if (!storeId) {
      const firstProductId = cart[0].id;
      const { data: productData, error: productError } = await supabaseClient
        .from("products")
        .select("created_by, store_id")
        .eq("id", firstProductId)
        .maybeSingle();
      
      if (productError) throw productError;
      
      sellerId = productData?.created_by || null;
      storeId = productData?.store_id || null;
    } else {
      const firstProductId = cart[0].id;
      const { data: productData } = await supabaseClient
        .from("products")
        .select("created_by")
        .eq("id", firstProductId)
        .maybeSingle();
      
      sellerId = productData?.created_by || null;
    }
    
    const { data: authData } = await supabaseClient.auth.getUser();
    const user = authData?.user || null;
    
    let customerName = null;
    let customerPhone = null;
    let customerEmail = user?.email || null;
    
    if (user) {
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .maybeSingle();
      
      if (profile) {
        customerName = profile.full_name;
        customerPhone = profile.phone;
      }
    }
    
    const orderNumber = 'M' + new Date().toISOString().slice(2,10).replace(/-/g,'') + '-' + 
                        Math.random().toString(36).substring(2, 6).toUpperCase();
    
    const items = cart.map(item => ({
      product_id: item.id,
      name: item.name,
      price: item.price,
      size: item.size,
      qty: item.qty,
      subtotal: item.price * item.qty,
      image: item.image
    }));
    
    const { data, error } = await supabaseClient
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        customer_id: user?.id || null,
        items: items,
        total: cartTotal(),
        items_count: cartCount(),
        status: 'pendiente',
        seller_id: sellerId,
        store_id: storeId
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log("Pedido creado:", data.order_number, "Tienda:", storeId);
    return data;
    
  } catch (err) {
    console.error("Error al crear pedido:", err);
    return null;
  }
}

async function handleCheckoutClick(e) {
  e.preventDefault();
  
  if (cart.length === 0) {
    alert("Tu carrito está vacío");
    return;
  }
  
  const btn = document.getElementById("checkoutWhatsapp");
  const originalText = btn.innerHTML;
  
  const whatsappWindow = window.open("about:blank", "_blank");
  
  btn.innerHTML = "Procesando pedido...";
  btn.style.pointerEvents = "none";
  btn.style.opacity = "0.7";
  
  try {
    const order = await createOrderInDatabase();
    
    const message = buildOrderMessage(order?.order_number);
    const whatsappUrl = `https://wa.me/${storeWhatsapp}?text=${encodeURIComponent(message)}`;
    
    if (whatsappWindow) {
      whatsappWindow.location.href = whatsappUrl;
    } else {
      window.location.href = whatsappUrl;
    }
    
    if (order) {
      clearCart();
      closeCart();
      showToast("Pedido enviado", `#${order.order_number}`);
      
      if (typeof window.renderOrdersHistory === "function") {
        setTimeout(() => window.renderOrdersHistory(), 1000);
      }
    } else {
      alert("El pedido no se pudo guardar, pero se abrirá WhatsApp igual.");
    }
    
  } catch (err) {
    console.error("Error en checkout:", err);
    alert("Hubo un problema procesando el pedido. Intenta de nuevo.");
    if (whatsappWindow) whatsappWindow.close();
  } finally {
    btn.innerHTML = originalText;
    btn.style.pointerEvents = "";
    btn.style.opacity = "";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const checkoutBtn = document.getElementById("checkoutWhatsapp");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", handleCheckoutClick);
  }
});

// ===================================================================
// SISTEMA DE BÚSQUEDA + FILTRO DE PRECIO
// ===================================================================

function normalizeText(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

let currentSearchQuery = "";
let currentMinPrice = 0;
let currentMaxPrice = Infinity;

const searchToggle = document.getElementById("searchToggle");
const searchBar = document.getElementById("searchBar");
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");
const searchResultsCount = document.getElementById("searchResultsCount");
const noResultsMsg = document.getElementById("noResultsMsg");
const noResultsText = document.getElementById("noResultsText");
const clearSearchBtn = document.getElementById("clearSearchBtn");

const priceMinInput = document.getElementById("priceMinInput");
const priceMaxInput = document.getElementById("priceMaxInput");
const applyPriceFilterBtn = document.getElementById("applyPriceFilterBtn");
const clearPriceFilterBtn = document.getElementById("clearPriceFilterBtn");
const priceFilterActive = document.getElementById("priceFilterActive");
const priceRangeChips = document.querySelectorAll(".price-range-chip");

function openSearchBar() {
  if (!searchBar) return;
  searchBar.classList.add("active");
  document.body.classList.add("search-open");
  setTimeout(() => {
    if (searchInput) searchInput.focus();
  }, 300);
}

function closeSearchBar() {
  if (!searchBar) return;
  searchBar.classList.remove("active");
  document.body.classList.remove("search-open");
  if (searchInput) searchInput.value = "";
  clearAllFilters();
}

function closeSearchBarKeepFilters() {
  if (!searchBar) return;
  searchBar.classList.remove("active");
  document.body.classList.remove("search-open");
}

if (searchToggle) {
  searchToggle.addEventListener("click", () => {
    if (searchBar.classList.contains("active")) {
      closeSearchBar();
    } else {
      openSearchBar();
    }
  });
}

if (searchClear) {
  searchClear.addEventListener("click", closeSearchBar);
}

if (clearSearchBtn) {
  clearSearchBtn.addEventListener("click", () => {
    if (searchInput) {
      searchInput.value = "";
      currentSearchQuery = "";
      applyAllFilters();
      searchInput.focus();
    }
  });
}

let searchTimeout = null;
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value;
    currentSearchQuery = query;
    
    if (searchTimeout) clearTimeout(searchTimeout);
    
    searchTimeout = setTimeout(() => {
      applyAllFilters();
    }, 200);
  });
  
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchTimeout) clearTimeout(searchTimeout);
      applyAllFilters();
      closeSearchBarKeepFilters();
    }
  });
}

function formatPriceMiniInput(input) {
  if (!input) return;
  
  input.addEventListener("input", (e) => {
    const cursorPos = e.target.selectionStart;
    const oldLength = e.target.value.length;
    
    const numericValue = e.target.value.replace(/\D/g, "");
    let formatted = "";
    if (numericValue) {
      formatted = new Intl.NumberFormat("es-CO").format(parseInt(numericValue, 10));
    }
    e.target.value = formatted;
    
    const newLength = formatted.length;
    const diff = newLength - oldLength;
    const newCursorPos = Math.max(0, cursorPos + diff);
    e.target.setSelectionRange(newCursorPos, newCursorPos);
  });
}

formatPriceMiniInput(priceMinInput);
formatPriceMiniInput(priceMaxInput);

function extractPriceNumber(value) {
  if (!value) return 0;
  return parseInt(value.toString().replace(/\D/g, ""), 10) || 0;
}

if (applyPriceFilterBtn) {
  applyPriceFilterBtn.addEventListener("click", () => {
    const minVal = extractPriceNumber(priceMinInput?.value);
    const maxVal = extractPriceNumber(priceMaxInput?.value);
    
    currentMinPrice = minVal || 0;
    currentMaxPrice = maxVal || Infinity;
    
    if (maxVal > 0 && minVal > maxVal) {
      alert("El precio mínimo no puede ser mayor que el máximo.");
      return;
    }
    
    priceRangeChips.forEach(chip => chip.classList.remove("active"));
    
    applyAllFilters();
    updatePriceFilterIndicator();
    closeSearchBarKeepFilters();
  });
}

if (clearPriceFilterBtn) {
  clearPriceFilterBtn.addEventListener("click", () => {
    if (priceMinInput) priceMinInput.value = "";
    if (priceMaxInput) priceMaxInput.value = "";
    currentMinPrice = 0;
    currentMaxPrice = Infinity;
    priceRangeChips.forEach(chip => chip.classList.remove("active"));
    applyAllFilters();
    updatePriceFilterIndicator();
  });
}

priceRangeChips.forEach(chip => {
  chip.addEventListener("click", () => {
    const min = parseInt(chip.dataset.min, 10) || 0;
    const max = chip.dataset.max ? parseInt(chip.dataset.max, 10) : Infinity;
    
    priceRangeChips.forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    
    if (priceMinInput) {
      priceMinInput.value = min > 0 ? new Intl.NumberFormat("es-CO").format(min) : "";
    }
    if (priceMaxInput) {
      priceMaxInput.value = max !== Infinity ? new Intl.NumberFormat("es-CO").format(max) : "";
    }
    
    currentMinPrice = min;
    currentMaxPrice = max;
    
    applyAllFilters();
    updatePriceFilterIndicator();
    closeSearchBarKeepFilters();
  });
});

function updatePriceFilterIndicator() {
  if (!priceFilterActive) return;
  
  if (currentMinPrice === 0 && currentMaxPrice === Infinity) {
    priceFilterActive.classList.remove("visible");
    priceFilterActive.textContent = "";
    return;
  }
  
  let text = "";
  if (currentMinPrice > 0 && currentMaxPrice !== Infinity) {
    text = `Rango: $${new Intl.NumberFormat("es-CO").format(currentMinPrice)} - $${new Intl.NumberFormat("es-CO").format(currentMaxPrice)}`;
  } else if (currentMinPrice > 0) {
    text = `Desde: $${new Intl.NumberFormat("es-CO").format(currentMinPrice)}`;
  } else if (currentMaxPrice !== Infinity) {
    text = `Hasta: $${new Intl.NumberFormat("es-CO").format(currentMaxPrice)}`;
  }
  
  priceFilterActive.textContent = text;
  priceFilterActive.classList.add("visible");
}

function clearAllFilters() {
  currentSearchQuery = "";
  currentMinPrice = 0;
  currentMaxPrice = Infinity;
  
  if (priceMinInput) priceMinInput.value = "";
  if (priceMaxInput) priceMaxInput.value = "";
  priceRangeChips.forEach(chip => chip.classList.remove("active"));
  
  updatePriceFilterIndicator();
  applyAllFilters();
}

function applyAllFilters() {
  const normalizedQuery = normalizeText(currentSearchQuery);
  const allProductCards = document.querySelectorAll(".product-card");
  let visibleCount = 0;
  let firstMatchElement = null;
  const categoriesWithResults = new Set();
  
  allProductCards.forEach((card) => {
    const name = card.dataset.productName || "";
    const category = card.dataset.productCategory || "";
    const tag = card.dataset.productTag || "";
    const price = parseInt(card.dataset.productPrice, 10) || 0;
    
    card.classList.remove("search-highlight");
    
    const matchesSearch = 
      !normalizedQuery ||
      name.includes(normalizedQuery) || 
      category.includes(normalizedQuery) || 
      tag.includes(normalizedQuery);
    
    const matchesPrice = 
      price >= currentMinPrice && price <= currentMaxPrice;
    
    const matches = matchesSearch && matchesPrice;
    
    if (matches) {
      card.classList.remove("hidden-by-search");
      card.classList.remove("hidden-by-price");
      visibleCount++;
      
      if (!firstMatchElement) {
        firstMatchElement = card;
      }
      
      const parentCatalog = card.closest(".catalog");
      if (parentCatalog) {
        categoriesWithResults.add(parentCatalog.id);
      }
    } else {
      if (!matchesSearch) card.classList.add("hidden-by-search");
      if (!matchesPrice) card.classList.add("hidden-by-price");
    }
  });
  
  document.querySelectorAll(".catalog").forEach((catalog) => {
    if (categoriesWithResults.has(catalog.id)) {
      catalog.classList.remove("hidden-by-search");
    } else {
      catalog.classList.add("hidden-by-search");
    }
  });
  
  const hasActiveFilters = normalizedQuery || currentMinPrice > 0 || currentMaxPrice !== Infinity;
  
  if (searchResultsCount) {
    if (hasActiveFilters) {
      if (visibleCount === 0) {
        searchResultsCount.textContent = "0 resultados";
      } else if (visibleCount === 1) {
        searchResultsCount.textContent = "1 producto";
      } else {
        searchResultsCount.textContent = `${visibleCount} productos`;
      }
      searchResultsCount.classList.add("visible");
    } else {
      searchResultsCount.classList.remove("visible");
      searchResultsCount.textContent = "";
    }
  }
  
  if (hasActiveFilters && visibleCount === 0) {
    if (noResultsMsg) noResultsMsg.style.display = "block";
    if (noResultsText) {
      let msg = "No hay productos que coincidan con";
      if (normalizedQuery && (currentMinPrice > 0 || currentMaxPrice !== Infinity)) {
        msg += ` "${currentSearchQuery}" en ese rango de precio.`;
      } else if (normalizedQuery) {
        msg += ` "${currentSearchQuery}". Prueba con otra palabra.`;
      } else {
        msg += " ese rango de precio. Prueba ampliar el rango.";
      }
      noResultsText.textContent = msg;
    }
  } else {
    if (noResultsMsg) noResultsMsg.style.display = "none";
    
    if (hasActiveFilters && firstMatchElement) {
      firstMatchElement.classList.add("search-highlight");
      
      setTimeout(() => {
        const headerHeight = 78;
        const searchBarHeight = searchBar.classList.contains("active") ? (searchBar.offsetHeight || 200) : 0;
        const offset = headerHeight + searchBarHeight + 30;
        
        const elementPosition = firstMatchElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
      }, 400);
      
      setTimeout(() => {
        firstMatchElement.classList.remove("search-highlight");
      }, 2400);
    } else if (!hasActiveFilters) {
      resetAllProductVisibility();
    }
  }
}

function resetAllProductVisibility() {
  document.querySelectorAll(".product-card").forEach((card) => {
    card.classList.remove("hidden-by-search");
    card.classList.remove("hidden-by-price");
    card.classList.remove("search-highlight");
  });
  document.querySelectorAll(".catalog").forEach((catalog) => {
    catalog.classList.remove("hidden-by-search");
  });
  if (noResultsMsg) noResultsMsg.style.display = "none";
}

// ===================================================================
// SISTEMA DE COMPARTIR PRODUCTOS
// ===================================================================

const shareProductBtn = document.getElementById("shareProductBtn");
const shareMenu = document.getElementById("shareMenu");

function openShareMenu() {
  if (!shareMenu) return;
  shareMenu.classList.add("active");
}

function closeShareMenu() {
  if (!shareMenu) return;
  shareMenu.classList.remove("active");
}

if (shareProductBtn) {
  shareProductBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (shareMenu.classList.contains("active")) {
      closeShareMenu();
    } else {
      openShareMenu();
    }
  });
}

document.addEventListener("click", (e) => {
  if (shareMenu && shareMenu.classList.contains("active")) {
    if (!shareMenu.contains(e.target) && e.target !== shareProductBtn && !shareProductBtn?.contains(e.target)) {
      closeShareMenu();
    }
  }
});

function buildShareMessage(product) {
  const productUrl = generateProductUrl(product);
  const hasDiscount = product.discount_percent && product.discount_percent > 0 && product.original_price;
  const storeName = currentStore ? currentStore.name : "MAISON";
  
  let priceText = `Precio: ${formatPrice(product.price)}`;
  if (hasDiscount) {
    priceText = `Precio: ~${formatPrice(product.original_price)}~ *${formatPrice(product.price)}* (${product.discount_percent}% OFF)`;
  }
  
  return `Mira este producto de ${storeName}:

*${product.name}*
Categoría: ${categoryLabel(product.category)}
${priceText}

Ver más aquí: ${productUrl}

Ropa y calzado premium.`;
}

function generateProductUrl(product) {
  const baseUrl = window.location.origin;
  
  if (currentStoreSlug) {
    return `${baseUrl}/${currentStoreSlug}?producto=${product.id}`;
  }
  
  return `${baseUrl}/?producto=${product.id}`;
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (err) {
    console.error("Error al copiar al portapapeles:", err);
    return false;
  }
}

function shareToNetwork(network, product) {
  if (!product) return;
  
  const message = buildShareMessage(product);
  const productUrl = generateProductUrl(product);
  const encodedMessage = encodeURIComponent(message);
  const encodedUrl = encodeURIComponent(productUrl);
  
  let shareUrl = "";
  
  switch (network) {
    case "whatsapp":
      shareUrl = `https://wa.me/?text=${encodedMessage}`;
      window.open(shareUrl, "_blank");
      showCustomToast("Compartiendo...", `${product.name} por WhatsApp`);
      break;
      
    case "facebook":
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedMessage}`;
      window.open(shareUrl, "_blank", "width=600,height=400");
      showCustomToast("Compartiendo...", `${product.name} en Facebook`);
      break;
      
    case "instagram":
      copyToClipboard(message).then(success => {
        if (success) {
          showCustomToast("Mensaje copiado", "Pégalo en Instagram Stories o DM");
        } else {
          alert("No se pudo copiar. Copia manualmente el mensaje.");
        }
      });
      break;
      
    case "copy":
      copyToClipboard(productUrl).then(success => {
        if (success) {
          showCustomToast("Link copiado", "Puedes pegarlo donde quieras");
        } else {
          alert("No se pudo copiar el link.");
        }
      });
      break;
  }
  
  closeShareMenu();
}

document.querySelectorAll(".share-option").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const network = btn.dataset.share;
    shareToNetwork(network, currentProduct);
  });
});

function checkProductInUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get("producto");
  
  if (productId) {
    setTimeout(() => {
      const product = STORE_PRODUCTS.find(p => p.id === productId);
      if (product) {
        openProductModal(product);
      }
    }, 1500);
  }
}

window.addEventListener("load", checkProductInUrl);

// ===================================================================
// SISTEMA DE FAVORITOS
// ===================================================================

async function loadUserFavorites() {
  try {
    const { data: authData } = await supabaseClient.auth.getUser();
    const user = authData?.user;
    
    if (!user) {
      userFavorites = new Set();
      return;
    }
    
    const { data, error } = await supabaseClient
      .from("favorites")
      .select("product_id")
      .eq("user_id", user.id);
    
    if (error) {
      console.error("Error cargando favoritos:", error);
      return;
    }
    
    userFavorites = new Set((data || []).map(f => f.product_id));
    console.log(`Favoritos cargados: ${userFavorites.size}`);
    
  } catch (err) {
    console.error("Error en loadUserFavorites:", err);
  }
}

async function toggleFavorite(product) {
  try {
    const { data: authData } = await supabaseClient.auth.getUser();
    const user = authData?.user;
    
    if (!user) {
      showCustomToast("Inicia sesión", "Necesitas una cuenta para guardar favoritos");
      setTimeout(() => {
        const accountToggle = document.getElementById("accountToggle");
        if (accountToggle) accountToggle.click();
      }, 800);
      return;
    }
    
    const isFav = userFavorites.has(product.id);
    const btns = document.querySelectorAll(`[data-favorite-btn="${product.id}"]`);
    
    if (isFav) {
      const { error } = await supabaseClient
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", product.id);
      
      if (error) throw error;
      
      userFavorites.delete(product.id);
      
      btns.forEach((btn) => {
        btn.classList.add("removing");
        setTimeout(() => {
          btn.classList.remove("is-favorite");
          btn.classList.remove("removing");
          const svg = btn.querySelector("svg");
          if (svg) svg.setAttribute("fill", "none");
        }, 200);
      });
      
      showCustomToast("Quitado de favoritos", product.name);
      
    } else {
      const { error } = await supabaseClient
        .from("favorites")
        .insert({
          user_id: user.id,
          product_id: product.id
        });
      
      if (error) throw error;
      
      userFavorites.add(product.id);
      
      btns.forEach((btn) => {
        btn.classList.add("is-favorite");
        const svg = btn.querySelector("svg");
        if (svg) svg.setAttribute("fill", "currentColor");
      });
      
      showCustomToast("Agregado a favoritos", product.name);
    }
    
    renderFavoritesSection();
    
  } catch (err) {
    console.error("Error al modificar favorito:", err);
    alert("No se pudo actualizar el favorito. Intenta de nuevo.");
  }
}

async function renderFavoritesSection() {
  const favoritesGrid = document.getElementById("favoritesGrid");
  const favoritesCount = document.getElementById("favoritesCount");
  
  if (!favoritesGrid || !favoritesCount) return;
  
  const { data: authData } = await supabaseClient.auth.getUser();
  const user = authData?.user;
  
  if (!user) {
    favoritesGrid.innerHTML = `
      <p class="favorites-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <span>Inicia sesión para ver tus favoritos</span>
      </p>
    `;
    favoritesCount.textContent = "0";
    return;
  }
  
  const { data, error } = await supabaseClient
    .from("favorites")
    .select(`
      product_id,
      created_at,
      products (
        id,
        category,
        name,
        price,
        original_price,
        discount_percent,
        image_url,
        tag,
        description,
        sizes,
        stock,
        active
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error cargando favoritos completos:", error);
    return;
  }
  
  const validFavorites = (data || []).filter(f => f.products && f.products.active);
  
  favoritesCount.textContent = validFavorites.length;
  
  if (validFavorites.length === 0) {
    favoritesGrid.innerHTML = `
      <p class="favorites-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <span>Aún no tienes productos favoritos</span>
        <small>Toca el corazón en cualquier producto para guardarlo aquí</small>
      </p>
    `;
    return;
  }
  
  favoritesGrid.innerHTML = "";
  
  validFavorites.forEach((fav) => {
    const p = fav.products;
    const product = {
      id: p.id,
      category: p.category,
      name: p.name,
      price: p.price,
      original_price: p.original_price || null,
      discount_percent: p.discount_percent || 0,
      image: p.image_url || "",
      tag: p.tag || "",
      desc: p.description || "",
      sizes: p.sizes && p.sizes.length > 0 ? p.sizes : ["Única"],
      stock: p.stock || {}
    };
    
    const item = document.createElement("div");
    item.className = "favorite-item";
    item.innerHTML = `
      <button type="button" class="favorite-item-remove" data-remove-fav="${p.id}" title="Quitar de favoritos" aria-label="Quitar de favoritos">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <img src="${product.image}" alt="${product.name}" class="favorite-item-img">
      <div class="favorite-item-info">
        <div class="favorite-item-name">${product.name}</div>
        <div class="favorite-item-price">${formatPrice(product.price)}</div>
      </div>
    `;
    
    item.addEventListener("click", (e) => {
      if (e.target.closest("[data-remove-fav]")) return;
      const accountOverlay = document.getElementById("accountOverlay");
      const accountModal = document.getElementById("accountModal");
      if (accountOverlay) accountOverlay.classList.remove("active");
      if (accountModal) accountModal.classList.remove("active");
      document.body.style.overflow = "";
      
      setTimeout(() => {
        openProductModal(product);
      }, 300);
    });
    
    const removeBtn = item.querySelector("[data-remove-fav]");
    if (removeBtn) {
      removeBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await toggleFavorite(product);
      });
    }
    
    favoritesGrid.appendChild(item);
  });
}

window.loadUserFavorites = loadUserFavorites;
window.renderFavoritesSection = renderFavoritesSection;
window.userFavorites = userFavorites;

window.updateAllFavoriteButtons = function() {
  document.querySelectorAll("[data-favorite-btn]").forEach((btn) => {
    const productId = btn.dataset.favoriteBtn;
    const isFav = userFavorites.has(productId);
    
    if (isFav) {
      btn.classList.add("is-favorite");
      const svg = btn.querySelector("svg");
      if (svg) svg.setAttribute("fill", "currentColor");
    } else {
      btn.classList.remove("is-favorite");
      const svg = btn.querySelector("svg");
      if (svg) svg.setAttribute("fill", "none");
    }
  });
};

// ===================================================================
// SISTEMA DE HISTORIAL DE PEDIDOS
// ===================================================================

let userOrders = [];
let currentOrdersFilter = "todos";

async function renderOrdersHistory() {
  const list = document.getElementById("ordersHistoryList");
  const countBadge = document.getElementById("ordersHistoryCount");
  
  if (!list || !countBadge) return;
  
  list.innerHTML = `<p class="orders-history-loading">Cargando tus pedidos...</p>`;
  
  try {
    const { data: authData } = await supabaseClient.auth.getUser();
    const user = authData?.user;
    
    if (!user) {
      showEmptyOrdersMessage(list, "Inicia sesión para ver tus pedidos", "Cuando compres, tus pedidos aparecerán aquí");
      countBadge.textContent = "0";
      return;
    }
    
    const { data, error } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error cargando historial:", error);
      list.innerHTML = `<p class="orders-history-loading">No se pudieron cargar los pedidos.</p>`;
      return;
    }
    
    userOrders = data || [];
    countBadge.textContent = userOrders.length;
    
    if (userOrders.length === 0) {
      showEmptyOrdersMessage(list, "Aún no has hecho pedidos", "Cuando compres, tus pedidos aparecerán aquí");
      return;
    }
    
    displayOrdersList(list);
    
  } catch (err) {
    console.error("Error en renderOrdersHistory:", err);
    list.innerHTML = `<p class="orders-history-loading">Error al cargar los pedidos.</p>`;
  }
}

function showEmptyOrdersMessage(list, title, subtitle) {
  list.innerHTML = `
    <p class="orders-history-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
      <span>${title}</span>
      <small>${subtitle}</small>
    </p>
  `;
}

function displayOrdersList(list) {
  const filteredOrders = currentOrdersFilter === "todos"
    ? userOrders
    : userOrders.filter(o => o.status === currentOrdersFilter);
  
  if (filteredOrders.length === 0) {
    const filterLabels = {
      pendiente: "pendientes",
      confirmado: "confirmados",
      entregado: "entregados",
      cancelado: "cancelados"
    };
    showEmptyOrdersMessage(
      list, 
      `No tienes pedidos ${filterLabels[currentOrdersFilter] || ""}`,
      "Prueba con otro filtro"
    );
    return;
  }
  
  list.innerHTML = "";
  filteredOrders.forEach((order) => {
    list.appendChild(createOrderHistoryCard(order));
  });
}

function createOrderHistoryCard(order) {
  const card = document.createElement("div");
  card.className = `order-history-card ${order.status}`;
  
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  
  const statusLabels = {
    pendiente: "Pendiente",
    confirmado: "Confirmado",
    entregado: "Entregado",
    cancelado: "Cancelado"
  };
  
  let itemsHtml = `<div class="order-history-items">`;
  (order.items || []).forEach((item) => {
    itemsHtml += `
      <div class="order-history-item">
        <img src="${item.image || ''}" alt="${escapeHtml(item.name)}" class="order-history-item-img">
        <div class="order-history-item-info">
          <span class="order-history-item-name">${escapeHtml(item.name)}</span>
          <span class="order-history-item-meta">Talla ${item.size} - Cantidad: ${item.qty}</span>
        </div>
        <span class="order-history-item-price">${formatPrice(item.subtotal)}</span>
      </div>
    `;
  });
  itemsHtml += `</div>`;
  
  let actionsHtml = "";
  if (order.status !== "cancelado") {
    const whatsappMsg = `Hola! Tengo una consulta sobre mi pedido *#${order.order_number}*`;
    const whatsappUrl = `https://wa.me/${storeWhatsapp}?text=${encodeURIComponent(whatsappMsg)}`;
    
    actionsHtml = `
      <div class="order-history-actions">
        <a href="${whatsappUrl}" target="_blank" class="order-history-btn order-history-btn-whatsapp">
          <svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor">
            <path d="M16.003 3C9.373 3 4 8.373 4 15.003c0 2.647.858 5.093 2.316 7.09L4 29l7.116-2.267a11.94 11.94 0 0 0 4.887 1.038h.001C22.634 27.771 28 22.399 28 15.77c0-3.187-1.241-6.183-3.495-8.437A11.925 11.925 0 0 0 16.003 3zm5.458 14.32c-.299-.15-1.769-.873-2.043-.973-.274-.1-.474-.15-.673.15-.199.299-.772.973-.947 1.173-.174.199-.349.224-.648.075-.299-.15-1.264-.466-2.408-1.486-.89-.794-1.491-1.774-1.666-2.073-.174-.299-.019-.461.131-.61.135-.134.299-.349.449-.524.15-.174.199-.299.299-.499.1-.199.05-.374-.025-.524-.075-.15-.673-1.623-.923-2.222-.243-.583-.489-.504-.673-.513-.174-.008-.374-.01-.573-.01a1.098 1.098 0 0 0-.798.374c-.274.299-1.047 1.023-1.047 2.496 0 1.473 1.072 2.895 1.222 3.095.15.199 2.109 3.222 5.115 4.518.716.309 1.274.494 1.71.632.719.229 1.373.196 1.89.119.577-.086 1.769-.723 2.019-1.421.249-.698.249-1.297.174-1.421-.075-.125-.274-.199-.573-.349z"/>
          </svg>
          <span>Contactar</span>
        </a>
        <button type="button" class="order-history-btn order-history-btn-reorder" data-reorder="${order.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          <span>Volver a pedir</span>
        </button>
      </div>
    `;
  }
  
  card.innerHTML = `
    <div class="order-history-header-inner">
      <div class="order-history-info">
        <div class="order-history-number">#${order.order_number}</div>
        <div class="order-history-date">${dateStr}</div>
      </div>
      <span class="order-history-status ${order.status}">${statusLabels[order.status] || order.status}</span>
    </div>
    
    ${itemsHtml}
    
    <div class="order-history-total">
      <span class="order-history-total-label">Total</span>
      <span class="order-history-total-value">${formatPrice(order.total)}</span>
    </div>
    
    ${actionsHtml}
  `;
  
  const reorderBtn = card.querySelector("[data-reorder]");
  if (reorderBtn) {
    reorderBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleReorder(order);
    });
  }
  
  return card;
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function handleReorder(order) {
  if (!order || !order.items || order.items.length === 0) return;
  
  const confirmMsg = `Volver a pedir estos productos?\n\n${order.items.map(i => `- ${i.name} (Talla ${i.size}) x ${i.qty}`).join("\n")}\n\nTotal aproximado: ${formatPrice(order.total)}`;
  
  if (!confirm(confirmMsg)) return;
  
  let addedCount = 0;
  let notAvailable = [];
  
  for (const item of order.items) {
    const product = STORE_PRODUCTS.find(p => p.id === item.product_id);
    
    if (!product) {
      notAvailable.push(item.name);
      continue;
    }
    
    const stockQty = getStockForSize(product, item.size);
    if (stockQty === 0 || stockQty === null) {
      notAvailable.push(`${item.name} (Talla ${item.size})`);
      continue;
    }
    
    const key = getCartKey(product.id, item.size);
    const existing = cart.find(c => c.key === key);
    
    if (existing) {
      existing.qty += item.qty;
    } else {
      cart.push({
        key,
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        size: item.size,
        qty: item.qty
      });
    }
    addedCount++;
  }
  
  saveCartToStorage();
  renderCart();
  
  const accountOverlay = document.getElementById("accountOverlay");
  const accountModal = document.getElementById("accountModal");
  if (accountOverlay) accountOverlay.classList.remove("active");
  if (accountModal) accountModal.classList.remove("active");
  document.body.style.overflow = "";
  
  if (addedCount > 0 && notAvailable.length === 0) {
    showCustomToast("Productos añadidos", `${addedCount} producto(s) al carrito`);
    setTimeout(() => openCart(), 400);
  } else if (addedCount > 0 && notAvailable.length > 0) {
    alert(`Se agregaron ${addedCount} producto(s) al carrito.\n\nNo disponibles:\n- ${notAvailable.join("\n- ")}`);
    setTimeout(() => openCart(), 400);
  } else {
    alert("Los productos ya no están disponibles.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const filterButtons = document.querySelectorAll(".order-history-filter");
  
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      currentOrdersFilter = btn.dataset.historyFilter;
      
      const list = document.getElementById("ordersHistoryList");
      if (list && userOrders.length > 0) {
        displayOrdersList(list);
      }
    });
  });
});

window.renderOrdersHistory = renderOrdersHistory;

// ===================================================================
// SISTEMA DE PESTAÑAS DEL PERFIL
// ===================================================================

let currentProfileTab = "perfil";

document.addEventListener("DOMContentLoaded", () => {
  const profileTabs = document.querySelectorAll(".profile-tab");
  
  profileTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.profileTab;
      switchProfileTab(tabName);
    });
  });
  
  const editProfileBtn = document.getElementById("editProfileBtn");
  if (editProfileBtn) {
    editProfileBtn.addEventListener("click", () => {
      showProfileForm(true);
    });
  }
  
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
      showProfileForm(false);
    });
  }
});

function switchProfileTab(tabName) {
  currentProfileTab = tabName;
  
  document.querySelectorAll(".profile-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.profileTab === tabName);
  });
  
  document.querySelectorAll(".profile-tab-content").forEach((c) => {
    c.classList.remove("active");
  });
  
  const capitalized = tabName.charAt(0).toUpperCase() + tabName.slice(1);
  const targetContent = document.getElementById(`profileContent${capitalized}`);
  if (targetContent) targetContent.classList.add("active");
  
  if (tabName === "favoritos" && typeof window.renderFavoritesSection === "function") {
    window.renderFavoritesSection();
  }
  if (tabName === "pedidos" && typeof window.renderOrdersHistory === "function") {
    window.renderOrdersHistory();
  }
}

function showProfileForm(showForm) {
  const formView = document.getElementById("profileFormView");
  const infoView = document.getElementById("profileInfoView");
  const cancelBtn = document.getElementById("cancelEditBtn");
  
  if (showForm) {
    if (formView) formView.style.display = "block";
    if (infoView) infoView.style.display = "none";
    if (cancelBtn) cancelBtn.style.display = "inline-flex";
  } else {
    if (formView) formView.style.display = "none";
    if (infoView) infoView.style.display = "block";
    if (cancelBtn) cancelBtn.style.display = "none";
    updateProfileInfoView();
  }
}

function updateProfileInfoView() {
  const nameEl = document.getElementById("displayName");
  const phoneEl = document.getElementById("displayPhone");
  const addressEl = document.getElementById("displayAddress");
  
  const nameInput = document.getElementById("profileName");
  const phoneInput = document.getElementById("profilePhone");
  const addressInput = document.getElementById("profileAddress");
  
  if (nameEl && nameInput) nameEl.textContent = nameInput.value || "-";
  if (phoneEl && phoneInput) phoneEl.textContent = phoneInput.value || "-";
  if (addressEl && addressInput) addressEl.textContent = addressInput.value || "-";
}

function checkProfileHasData() {
  const name = document.getElementById("profileName")?.value?.trim();
  const phone = document.getElementById("profilePhone")?.value?.trim();
  
  if (name && phone) {
    showProfileForm(false);
    updateProfileInfoView();
  } else {
    showProfileForm(true);
  }
}

function updateProfileTabCounts(favCount, ordersCount) {
  const favCountEl = document.getElementById("profileTabFavoritesCount");
  const ordCountEl = document.getElementById("profileTabOrdersCount");
  
  if (favCountEl) {
    favCountEl.textContent = favCount || "0";
    favCountEl.setAttribute("data-count", favCount || "0");
  }
  if (ordCountEl) {
    ordCountEl.textContent = ordersCount || "0";
    ordCountEl.setAttribute("data-count", ordersCount || "0");
  }
}

window.switchProfileTab = switchProfileTab;
window.checkProfileHasData = checkProfileHasData;
window.updateProfileTabCounts = updateProfileTabCounts;
window.showProfileForm = showProfileForm;
window.updateProfileInfoView = updateProfileInfoView;
