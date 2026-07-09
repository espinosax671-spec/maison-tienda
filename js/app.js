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
// Render del catálogo
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
  
  // Verificar si el producto tiene stock configurado
  const hasStockConfig = product.stock && Object.keys(product.stock).length > 0;
  
  product.sizes.forEach((size) => {
    const btn = document.createElement("button");
    btn.className = "size-btn";
    btn.type = "button";
    
    const stockQty = getStockForSize(product, size);
    
    if (hasStockConfig) {
      if (stockQty === 0 || stockQty === null) {
        // AGOTADO
        btn.classList.add("size-out");
        btn.disabled = true;
        btn.innerHTML = `${size}<span class="size-label">Agotado</span>`;
      } else if (stockQty < 3) {
        // ÚLTIMAS UNIDADES
        btn.classList.add("size-low");
        btn.innerHTML = `${size}<span class="size-label">Últimas ${stockQty}</span>`;
      } else {
        // DISPONIBLE
        btn.textContent = size;
      }
    } else {
      // Sin stock configurado — comportamiento normal
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
  
  // Si TODAS las tallas están agotadas
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
    // Crear mensaje de carrito vacío dinámicamente
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
  
  // El link de contacto sigue igual
  const contactLink = document.getElementById("contactWhatsapp");
  if (contactLink) {
    contactLink.href = `${baseUrl}?text=${encodeURIComponent("Hola, tengo una pregunta sobre sus productos.")}`;
  }
  
  // El link de checkout YA NO se actualiza aquí — ahora se maneja con clic
}

// ---------------------------------------------------------------
// MENÚ MÓVIL (arreglado: usa clase "open" que coincide con el CSS)
// ---------------------------------------------------------------
const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

menuToggle.addEventListener("click", () => {
  menuToggle.classList.toggle("active");
  mainNav.classList.toggle("open"); // antes decía "active" — corregido
});

mainNav.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    menuToggle.classList.remove("active");
    mainNav.classList.remove("open"); // antes decía "active" — corregido
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
  renderCart(); // Ya carga el carrito desde localStorage automáticamente
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
    // Obtener el vendedor dueño del primer producto (asumimos que todo el pedido va al mismo vendedor)
    const firstProductId = cart[0].id;
    const { data: productData, error: productError } = await supabaseClient
      .from("products")
      .select("created_by")
      .eq("id", firstProductId)
      .maybeSingle();
    
    if (productError) throw productError;
    
    const sellerId = productData?.created_by || null;
    
    // Obtener info del cliente si está logueado
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
    
    // Generar número de pedido
    const orderNumber = 'M' + new Date().toISOString().slice(2,10).replace(/-/g,'') + '-' + 
                        Math.random().toString(36).substring(2, 6).toUpperCase();
    
    // Preparar items (guardamos toda la info importante)
    const items = cart.map(item => ({
      product_id: item.id,
      name: item.name,
      price: item.price,
      size: item.size,
      qty: item.qty,
      subtotal: item.price * item.qty,
      image: item.image
    }));
    
    // Insertar pedido
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
  
  // Abrir WhatsApp INMEDIATAMENTE (evita que el navegador bloquee)
  const whatsappWindow = window.open("about:blank", "_blank");
  
  btn.innerHTML = "Procesando pedido...";
  btn.style.pointerEvents = "none";
  btn.style.opacity = "0.7";
  
  try {
    // 1. Guardar pedido en la base de datos
    const order = await createOrderInDatabase();
    
    // 2. Construir mensaje de WhatsApp
    const message = buildOrderMessage(order?.order_number);
    const whatsappUrl = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(message)}`;
    
    // 3. Redirigir la ventana ya abierta a WhatsApp
    if (whatsappWindow) {
      whatsappWindow.location.href = whatsappUrl;
    } else {
      // Fallback: si se bloqueó la ventana, redirigir en la misma pestaña
      window.location.href = whatsappUrl;
    }
    
    // 4. Limpiar carrito
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
    // 5. Restaurar botón siempre
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
