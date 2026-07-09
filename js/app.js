/* ===================================================================
   MAISON — Lógica de la tienda
   Edita NUMERO_WHATSAPP con tu número (código de país + número, sin +)
=================================================================== */

// EDITA ESTE NÚMERO — formato: código país + número, sin espacios ni +
const NUMERO_WHATSAPP = "573001234567";

// Clave para guardar el carrito en localStorage
const CART_STORAGE_KEY = "maison_cart_v1";

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
// PERSISTENCIA DEL CARRITO EN LOCALSTORAGE
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
      if (Array.isArray(parsed)) {
        return parsed;
      }
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

// ---------------------------------------------------------------
// Estado del carrito (se carga desde localStorage al iniciar)
// ---------------------------------------------------------------
let cart = loadCartFromStorage();

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
    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) return PRODUCTS;

    return data.map((p) => ({
      id: p.id,
      category: p.category,
      name: p.name,
      price: p.price,
      image: p.image_url || "",
      tag: p.tag || "",
      desc: p.description || "",
     sizes: p.sizes && p.sizes.length > 0 ? p.sizes : ["Única"],
      stock: p.stock || {},
    }));
  } catch (err) {
    console.error("No se pudo cargar el catálogo desde Supabase:", err);
    return PRODUCTS;
  }
}

// ---------------------------------------------------------------
// Render del catálogo (CON dataset para búsqueda y filtro de precio)
// ---------------------------------------------------------------
async function renderCatalog() {
  const grids = {
    dama: document.getElementById("damaGrid"),
    caballero: document.getElementById("caballeroGrid"),
    calzado: document.getElementById("calzadoGrid"),
  };

  STORE_PRODUCTS = await fetchProductsFromSupabase();

  STORE_PRODUCTS.forEach((product) => {
    const grid = grids[product.category];
    if (!grid) return;

    const card = document.createElement("article");
    card.className = "product-card reveal";
    // Data attributes para búsqueda
    card.dataset.productName = normalizeText(product.name);
    card.dataset.productCategory = normalizeText(product.category);
    card.dataset.productTag = normalizeText(product.tag);
    // Data attribute para filtro de precio
    card.dataset.productPrice = product.price;
    
    card.innerHTML = `
      <div class="product-image">
        ${product.tag ? `<span class="product-tag">${product.tag}</span>` : ""}
        <img src="${product.image}" alt="${product.name}" loading="lazy">
      </div>
      <div class="product-info">
        <span class="product-category">${categoryLabel(product.category)}</span>
        <h3 class="product-name">${product.name}</h3>
        <p class="product-price">${formatPrice(product.price)}</p>
      </div>
    `;
    card.addEventListener("click", () => openProductModal(product));
    grid.appendChild(card);
  });
}

function categoryLabel(category) {
  const labels = { dama: "Dama", caballero: "Caballero", calzado: "Calzado" };
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
// Modal de producto CON SELECTOR DE CANTIDAD Y STOCK
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
  document.getElementById("modalPrice").textContent = formatPrice(product.price);
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
// Render del carrito CON CONTROLES DE CANTIDAD
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

  let msg = "Hola! Quiero hacer este pedido:\n\n";
  
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
  const baseUrl = `https://wa.me/${NUMERO_WHATSAPP}`;
  
  const contactLink = document.getElementById("contactWhatsapp");
  if (contactLink) {
    contactLink.href = `${baseUrl}?text=${encodeURIComponent("Hola, tengo una pregunta sobre sus productos.")}`;
  }
}

// ---------------------------------------------------------------
// MENÚ MÓVIL
// ---------------------------------------------------------------
const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

menuToggle.addEventListener("click", () => {
  menuToggle.classList.toggle("active");
  mainNav.classList.toggle("open");
});

mainNav.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    menuToggle.classList.remove("active");
    mainNav.classList.remove("open");
  });
});

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
    header.style.transform = "translateY(-100%)";
  } else {
    header.style.transform = "translateY(0)";
  }
  lastScroll = current;
});

// ---------------------------------------------------------------
// Inicialización
// ---------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  renderCatalog();
  renderCart();
  updateWhatsappLinks();
  initScrollReveal();

  setTimeout(() => {
    document.getElementById("loader").classList.add("hidden");
  }, 600);
});

// Cierre con Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeCart();
    closeProductModal();
    closeSearchBar();
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

// ---------------------------------------------------------------
// SISTEMA DE PEDIDOS: guardar pedido antes de WhatsApp
// ---------------------------------------------------------------

async function createOrderInDatabase() {
  if (cart.length === 0) return null;
  
  try {
    const firstProductId = cart[0].id;
    const { data: productData, error: productError } = await supabaseClient
      .from("products")
      .select("created_by")
      .eq("id", firstProductId)
      .maybeSingle();
    
    if (productError) throw productError;
    
    const sellerId = productData?.created_by || null;
    
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
        seller_id: sellerId
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log("Pedido creado:", data.order_number);
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
    const whatsappUrl = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(message)}`;
    
    if (whatsappWindow) {
      whatsappWindow.location.href = whatsappUrl;
    } else {
      window.location.href = whatsappUrl;
    }
    
    if (order) {
      clearCart();
      closeCart();
      showToast("Pedido enviado", `#${order.order_number}`);
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

// Registrar el listener del botón de checkout
document.addEventListener("DOMContentLoaded", () => {
  const checkoutBtn = document.getElementById("checkoutWhatsapp");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", handleCheckoutClick);
  }
});

// ===================================================================
// SISTEMA DE BÚSQUEDA DE PRODUCTOS + FILTRO DE PRECIO (Mejoras #2 y #3)
// ===================================================================

// Función auxiliar: normaliza texto para búsqueda (sin tildes, minúsculas)
function normalizeText(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Estado global de los filtros
let currentSearchQuery = "";
let currentMinPrice = 0;
let currentMaxPrice = Infinity;

// Elementos de la búsqueda
const searchToggle = document.getElementById("searchToggle");
const searchBar = document.getElementById("searchBar");
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");
const searchResultsCount = document.getElementById("searchResultsCount");
const noResultsMsg = document.getElementById("noResultsMsg");
const noResultsText = document.getElementById("noResultsText");
const clearSearchBtn = document.getElementById("clearSearchBtn");

// Elementos del filtro de precio
const priceMinInput = document.getElementById("priceMinInput");
const priceMaxInput = document.getElementById("priceMaxInput");
const applyPriceFilterBtn = document.getElementById("applyPriceFilterBtn");
const clearPriceFilterBtn = document.getElementById("clearPriceFilterBtn");
const priceFilterActive = document.getElementById("priceFilterActive");
const priceRangeChips = document.querySelectorAll(".price-range-chip");

// Abrir/cerrar barra de búsqueda
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
  // Limpiar búsqueda y filtro al cerrar
  if (searchInput) searchInput.value = "";
  clearAllFilters();
}

// Escuchar clic en el botón de lupa (header)
if (searchToggle) {
  searchToggle.addEventListener("click", () => {
    if (searchBar.classList.contains("active")) {
      closeSearchBar();
    } else {
      openSearchBar();
    }
  });
}

// Escuchar clic en el botón cerrar (X)
if (searchClear) {
  searchClear.addEventListener("click", closeSearchBar);
}

// Escuchar clic en "Limpiar búsqueda" del mensaje sin resultados
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

// Ejecutar búsqueda al escribir (con debounce simple)
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
}

// ---------------------------------------------------------------
// FILTRO DE PRECIO
// ---------------------------------------------------------------

// Formatear inputs de precio en tiempo real
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

// Aplicar formato a los inputs de precio
formatPriceMiniInput(priceMinInput);
formatPriceMiniInput(priceMaxInput);

// Extraer número puro del input formateado
function extractPriceNumber(value) {
  if (!value) return 0;
  return parseInt(value.toString().replace(/\D/g, ""), 10) || 0;
}

// Botón "Aplicar" del filtro de precio
if (applyPriceFilterBtn) {
  applyPriceFilterBtn.addEventListener("click", () => {
    const minVal = extractPriceNumber(priceMinInput?.value);
    const maxVal = extractPriceNumber(priceMaxInput?.value);
    
    currentMinPrice = minVal || 0;
    currentMaxPrice = maxVal || Infinity;
    
    // Validar que min no sea mayor que max
    if (maxVal > 0 && minVal > maxVal) {
      alert("El precio mínimo no puede ser mayor que el máximo.");
      return;
    }
    
    // Quitar el estado activo de los chips
    priceRangeChips.forEach(chip => chip.classList.remove("active"));
    
    applyAllFilters();
    updatePriceFilterIndicator();
  });
}

// Botón "Limpiar" filtro de precio
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

// Chips de rangos sugeridos
priceRangeChips.forEach(chip => {
  chip.addEventListener("click", () => {
    const min = parseInt(chip.dataset.min, 10) || 0;
    const max = chip.dataset.max ? parseInt(chip.dataset.max, 10) : Infinity;
    
    // Marcar chip activo
    priceRangeChips.forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    
    // Llenar inputs con los valores
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
  });
});

// Actualizar el indicador de filtro activo
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

// Limpiar todos los filtros (búsqueda + precio)
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

// ---------------------------------------------------------------
// APLICAR TODOS LOS FILTROS (búsqueda + precio combinados)
// ---------------------------------------------------------------
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
    
    // Quitar clase de destello anterior
    card.classList.remove("search-highlight");
    
    // FILTRO 1: Búsqueda por texto
    const matchesSearch = 
      !normalizedQuery ||
      name.includes(normalizedQuery) || 
      category.includes(normalizedQuery) || 
      tag.includes(normalizedQuery);
    
    // FILTRO 2: Rango de precio
    const matchesPrice = 
      price >= currentMinPrice && price <= currentMaxPrice;
    
    // Ambos filtros deben coincidir
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
  
  // Ocultar catálogos completos sin resultados
  document.querySelectorAll(".catalog").forEach((catalog) => {
    if (categoriesWithResults.has(catalog.id)) {
      catalog.classList.remove("hidden-by-search");
    } else {
      catalog.classList.add("hidden-by-search");
    }
  });
  
  // Actualizar contador de resultados
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
  
  // Mostrar/ocultar mensaje de "No encontramos productos"
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
    
    // Scroll automático al primer resultado (solo si hay búsqueda activa)
    if (hasActiveFilters && firstMatchElement) {
      firstMatchElement.classList.add("search-highlight");
      
      setTimeout(() => {
        const headerHeight = 78;
        const searchBarHeight = searchBar.offsetHeight || 200;
        const offset = headerHeight + searchBarHeight + 30;
        
        const elementPosition = firstMatchElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
      }, 100);
      
      setTimeout(() => {
        firstMatchElement.classList.remove("search-highlight");
      }, 2100);
    } else if (!hasActiveFilters) {
      // Si no hay filtros, resetear
      resetAllProductVisibility();
    }
  }
}

// Resetear visibilidad de todos los productos
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

// ---------------------------------------------------------------
// BOTÓN VOLVER ARRIBA
// ---------------------------------------------------------------
const scrollTopBtn = document.getElementById("scrollTopBtn");

if (scrollTopBtn) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 400) {
      scrollTopBtn.classList.add("visible");
    } else {
      scrollTopBtn.classList.remove("visible");
    }
  });

  scrollTopBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
}
