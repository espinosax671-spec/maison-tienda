/* ===================================================================
   AUTENTICACIÓN — Registro, Login, Perfil, Sesión
   Sistema MULTI-TIENDA con creación automática de tienda
   Roles: comprador (tienda) y administrador (dueño de tienda)
   
   ACTUALIZADO: 
   - Detecta staff (dueño/empleado) y los redirige al panel
   - Genera slug automáticamente para la URL única de cada tienda
   - Muestra vista previa de la URL personalizada durante el registro
=================================================================== */

let currentUser = null;
let currentRole = null;
let isStaffUser = false;
let selectedRole = 'comprador';

// ⭐ NUEVO: Variables para el slug de la tienda
let currentStoreSlugPreview = null;
let slugCheckTimeout = null;

// ---------------------------------------------------------------
// ⭐ NUEVA FUNCIÓN: Generar slug desde un nombre
// Convierte "JR Store" → "jr-store"
// ---------------------------------------------------------------
function generateSlugFromName(name) {
  if (!name) return "";
  
  return name
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // Quitar tildes
    .replace(/[^a-z0-9\s-]/g, "")       // Solo letras, números, espacios y guiones
    .trim()
    .replace(/\s+/g, "-")               // Espacios → guiones
    .replace(/-+/g, "-")                // Múltiples guiones → uno solo
    .replace(/^-+|-+$/g, "");           // Quitar guiones al inicio/final
}

// ---------------------------------------------------------------
// ⭐ NUEVA FUNCIÓN: Verificar si un slug está disponible
// ---------------------------------------------------------------
async function isSlugAvailable(slug) {
  if (!slug) return false;
  
  try {
    const { data, error } = await supabaseClient
      .from("stores")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    
    if (error) {
      console.error("Error verificando slug:", error);
      return false;
    }
    
    // Si NO encontró nada, el slug está disponible
    return data === null;
  } catch (err) {
    console.error("Error en isSlugAvailable:", err);
    return false;
  }
}

// ---------------------------------------------------------------
// ⭐ NUEVA FUNCIÓN: Generar slug único (si existe, agregar número)
// ---------------------------------------------------------------
async function generateUniqueSlug(baseName) {
  let baseSlug = generateSlugFromName(baseName);
  if (!baseSlug) return null;
  
  let finalSlug = baseSlug;
  let counter = 1;
  
  while (!(await isSlugAvailable(finalSlug))) {
    counter++;
    finalSlug = `${baseSlug}-${counter}`;
    
    // Evitar loop infinito
    if (counter > 100) {
      finalSlug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }
  
  return finalSlug;
}

window.addEventListener("DOMContentLoaded", () => {

  const accountOverlay = document.getElementById("accountOverlay");
  const accountModal = document.getElementById("accountModal");
  const accountToggle = document.getElementById("accountToggle");
  const accountLabel = document.getElementById("accountLabel");

  const views = {
    login: document.getElementById("viewLogin"),
    register: document.getElementById("viewRegister"),
    confirm: document.getElementById("viewConfirm"),
    profile: document.getElementById("viewProfile"),
    vendor: document.getElementById("viewVendor"),
  };

  function showAccountView(name) {
    Object.values(views).forEach((v) => v && v.classList.remove("active"));
    if (views[name]) views[name].classList.add("active");
  }

  function openAccountModal() {
    accountOverlay.classList.add("active");
    accountModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeAccountModal() {
    accountOverlay.classList.remove("active");
    accountModal.classList.remove("active");
    document.body.style.overflow = "";
    clearAuthErrors();
  }

  function clearAuthErrors() {
    ["loginError", "registerError", "profileError", "profileSuccess"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = "";
    });
  }

  function toggleRoleTabs(show) {
    const roleTabs = document.getElementById("roleTabs");
    if (roleTabs) {
      roleTabs.classList.toggle("hidden", !show);
    }
  }

  // ---------------------------------------------------------------
  // SELECTOR DE ROL CON PESTAÑAS
  // ---------------------------------------------------------------
  const tabs = document.querySelectorAll(".role-tab");
  const loginEyebrow = document.getElementById("loginEyebrow");
  const registerEyebrow = document.getElementById("registerEyebrow");
  const vendorFields = document.getElementById("vendorFields");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      selectedRole = tab.dataset.roleTab;

      if (selectedRole === "vendedor") {
        if (loginEyebrow) loginEyebrow.textContent = "Acceso Dueño de Tienda";
        if (registerEyebrow) registerEyebrow.textContent = "Crea tu tienda MAISON";
        if (vendorFields) vendorFields.style.display = "block";
      } else {
        if (loginEyebrow) loginEyebrow.textContent = "Acceso Cliente";
        if (registerEyebrow) registerEyebrow.textContent = "Crear cuenta Cliente";
        if (vendorFields) vendorFields.style.display = "none";
      }
    });
  });

  // ---------------------------------------------------------------
  // ⭐ NUEVO: Vista previa de URL en tiempo real al escribir nombre de tienda
  // ---------------------------------------------------------------
  const registerStoreNameInput = document.getElementById("registerStoreName");
  
  if (registerStoreNameInput) {
    // Crear el elemento de vista previa dinámicamente si no existe
    let previewEl = document.getElementById("storeUrlPreview");
    if (!previewEl) {
      previewEl = document.createElement("div");
      previewEl.id = "storeUrlPreview";
      previewEl.className = "store-url-preview";
      previewEl.innerHTML = `
        <div class="url-preview-inner">
          <span class="url-preview-icon">🌐</span>
          <div class="url-preview-content">
            <span class="url-preview-label">Tu URL única será:</span>
            <span class="url-preview-value" id="urlPreviewValue">
              <span class="url-domain">${window.location.origin}/</span><span class="url-slug" id="urlSlugPreview">tu-tienda</span>
            </span>
            <span class="url-preview-status" id="urlPreviewStatus"></span>
          </div>
        </div>
      `;
      
      // Insertar después del input de nombre de tienda
      const parent = registerStoreNameInput.closest(".input-group");
      if (parent && parent.parentNode) {
        parent.parentNode.insertBefore(previewEl, parent.nextSibling);
      }
    }
    
    // Listener para actualizar la vista previa
    registerStoreNameInput.addEventListener("input", async (e) => {
      const storeName = e.target.value.trim();
      const slugPreviewEl = document.getElementById("urlSlugPreview");
      const statusEl = document.getElementById("urlPreviewStatus");
      const previewContainer = document.getElementById("storeUrlPreview");
      
      if (!storeName || storeName.length < 3) {
        if (slugPreviewEl) slugPreviewEl.textContent = "tu-tienda";
        if (statusEl) {
          statusEl.textContent = "";
          statusEl.className = "url-preview-status";
        }
        if (previewContainer) previewContainer.classList.remove("checking", "available", "taken");
        return;
      }
      
      const slug = generateSlugFromName(storeName);
      if (slugPreviewEl) slugPreviewEl.textContent = slug;
      
      // Mostrar "verificando" mientras se checa la disponibilidad
      if (statusEl) {
        statusEl.textContent = "⏳ Verificando disponibilidad...";
        statusEl.className = "url-preview-status checking";
      }
      if (previewContainer) {
        previewContainer.classList.add("checking");
        previewContainer.classList.remove("available", "taken");
      }
      
      // Debounce: esperar 500ms antes de verificar
      if (slugCheckTimeout) clearTimeout(slugCheckTimeout);
      slugCheckTimeout = setTimeout(async () => {
        const available = await isSlugAvailable(slug);
        
        if (available) {
          if (statusEl) {
            statusEl.textContent = "✅ URL disponible";
            statusEl.className = "url-preview-status available";
          }
          if (previewContainer) {
            previewContainer.classList.remove("checking", "taken");
            previewContainer.classList.add("available");
          }
          currentStoreSlugPreview = slug;
        } else {
          // Buscar slug único con número
          const uniqueSlug = await generateUniqueSlug(storeName);
          if (slugPreviewEl) slugPreviewEl.textContent = uniqueSlug;
          currentStoreSlugPreview = uniqueSlug;
          
          if (statusEl) {
            statusEl.textContent = `⚠️ Ya existe una tienda con ese nombre. Usaremos: ${uniqueSlug}`;
            statusEl.className = "url-preview-status taken";
          }
          if (previewContainer) {
            previewContainer.classList.remove("checking");
            previewContainer.classList.add("taken");
          }
        }
      }, 500);
    });
  }

  // ---------------------------------------------------------------
  // Botón "Ingresar" del header
  // ---------------------------------------------------------------
  accountToggle.addEventListener("click", () => {
    if (currentUser && isStaffUser) {
      window.location.href = "admin.html";
      return;
    }

    openAccountModal();
    if (currentUser) {
      toggleRoleTabs(false);
      const esVendedor = currentRole === "vendedor" || currentRole === "administrador";
      showAccountView(esVendedor ? "vendor" : "profile");
      
      if (!esVendedor) {
        if (typeof window.checkProfileHasData === "function") {
          window.checkProfileHasData();
        }
        
        if (typeof window.renderFavoritesSection === "function") {
          window.renderFavoritesSection();
        }
        
        if (typeof window.renderOrdersHistory === "function") {
          window.renderOrdersHistory();
        }
        
        updateTabCounters();
      }
    } else {
      toggleRoleTabs(true);
      showAccountView("login");
    }
  });

  document.getElementById("accountModalClose").addEventListener("click", closeAccountModal);
  accountOverlay.addEventListener("click", closeAccountModal);

  document.getElementById("goToRegister").addEventListener("click", () => {
    clearAuthErrors();
    showAccountView("register");
  });
  document.getElementById("goToLogin").addEventListener("click", () => {
    clearAuthErrors();
    showAccountView("login");
  });
  document.getElementById("confirmBackBtn").addEventListener("click", () => {
    showAccountView("login");
  });

  // ---------------------------------------------------------------
  // REGISTRO (MULTI-TIENDA)
  // ⭐ ACTUALIZADO: Genera slug automáticamente al registrar tienda
  // ---------------------------------------------------------------
  document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("registerError");
    errorEl.textContent = "";

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    const whatsapp = document.getElementById("registerWhatsapp")?.value.trim() || "";
    const storeName = document.getElementById("registerStoreName")?.value.trim() || "";
    const btn = document.getElementById("registerSubmitBtn");

    // Validaciones para dueño de tienda
    if (selectedRole === "vendedor") {
      if (!storeName) {
        errorEl.textContent = "Como dueño de tienda, necesitas ingresar el nombre de tu tienda.";
        return;
      }
      if (!whatsapp) {
        errorEl.textContent = "Como dueño necesitas ingresar tu número de WhatsApp.";
        return;
      }
      if (storeName.length < 3) {
        errorEl.textContent = "El nombre de tu tienda debe tener al menos 3 caracteres.";
        return;
      }
    }

    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = "<span>Creando cuenta...</span>";

    const roleParaGuardar = selectedRole === "vendedor" ? "administrador" : "comprador";

    // ⭐ NUEVO: Generar slug único ANTES de crear la cuenta (solo para dueños)
    let uniqueSlug = null;
    if (selectedRole === "vendedor") {
      uniqueSlug = currentStoreSlugPreview || await generateUniqueSlug(storeName);
      
      if (!uniqueSlug) {
        errorEl.textContent = "No se pudo generar una URL válida para tu tienda. Prueba con otro nombre.";
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        return;
      }
      
      console.log("🌐 Slug generado:", uniqueSlug);
    }

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: roleParaGuardar,
          whatsapp: whatsapp,
          store_name: storeName,
          store_slug: uniqueSlug, // ⭐ NUEVO
        },
      },
    });

    btn.disabled = false;
    btn.innerHTML = originalHtml;

    if (error) {
      errorEl.textContent = traduceErrorAuth(error.message);
      return;
    }

    if (data.session === null) {
      showAccountView("confirm");
      return;
    }

    await supabaseClient.from("profiles").upsert({
      id: data.user.id,
      full_name: name,
      phone: whatsapp,
      role: roleParaGuardar,
      updated_at: new Date().toISOString(),
    });

    // Si es dueño de tienda, crear la tienda con la función RPC
    if (selectedRole === "vendedor") {
      const { data: storeId, error: storeError } = await supabaseClient.rpc("registrar_vendedor_con_tienda", {
        user_id: data.user.id,
        nombre: name,
        whatsapp_num: whatsapp,
        nombre_tienda: storeName,
      });
      
      if (storeError) {
        console.error("Error al crear tienda:", storeError);
        errorEl.textContent = "Cuenta creada, pero hubo un problema al crear tu tienda. Contacta al soporte.";
        return;
      }
      
      // ⭐ NUEVO: Asignar el slug a la tienda recién creada
      if (storeId && uniqueSlug) {
        const { error: slugError } = await supabaseClient
          .from("stores")
          .update({ slug: uniqueSlug })
          .eq("id", storeId);
        
        if (slugError) {
          console.warn("Error asignando slug:", slugError);
          // No es crítico, la tienda se creó bien
        } else {
          console.log(`✅ Tienda creada con slug: ${uniqueSlug}`);
        }
      }
    }

    currentRole = roleParaGuardar;
    await onAuthSuccess(data.user, uniqueSlug);
  });

  // ---------------------------------------------------------------
  // LOGIN
  // ---------------------------------------------------------------
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("loginError");
    errorEl.textContent = "";

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const btn = document.getElementById("loginSubmitBtn");

    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = "<span>Ingresando...</span>";

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    btn.disabled = false;
    btn.innerHTML = originalHtml;

    if (error) {
      errorEl.textContent = traduceErrorAuth(error.message);
      return;
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    currentRole = profile?.role || data.user.user_metadata?.role || "comprador";

    await onAuthSuccess(data.user);
  });

  // ---------------------------------------------------------------
  // LOGOUT
  // ---------------------------------------------------------------
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    currentUser = null;
    currentRole = null;
    isStaffUser = false;
    
    if (typeof window.userFavorites !== "undefined") {
      window.userFavorites = new Set();
    }
    if (typeof window.updateAllFavoriteButtons === "function") {
      window.updateAllFavoriteButtons();
    }
    
    updateAccountUI();
    closeAccountModal();
  });

  // ---------------------------------------------------------------
  // PERFIL — Guardar datos
  // ---------------------------------------------------------------
  document.getElementById("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("profileError");
    const successEl = document.getElementById("profileSuccess");
    errorEl.textContent = "";
    successEl.textContent = "";

    const name = document.getElementById("profileName").value.trim();
    const phone = document.getElementById("profilePhone").value.trim();
    const address = document.getElementById("profileAddress").value.trim();
    const btn = document.getElementById("profileSaveBtn");

    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = "<span>Guardando...</span>";

    const { error } = await supabaseClient.from("profiles").upsert({
      id: currentUser.id,
      full_name: name,
      phone: phone,
      address: address,
      role: "comprador",
      updated_at: new Date().toISOString(),
    });

    btn.disabled = false;
    btn.innerHTML = originalHtml;

    if (error) {
      errorEl.textContent = "No se pudo guardar. Intenta de nuevo.";
      return;
    }

    successEl.textContent = "Datos guardados correctamente";
    document.getElementById("profileGreeting").textContent = `Hola, ${name.split(" ")[0]}`;
    
    setTimeout(() => {
      successEl.textContent = "";
      if (typeof window.showProfileForm === "function") {
        window.showProfileForm(false);
      }
    }, 1500);
  });

  // ---------------------------------------------------------------
  // RECUPERAR CONTRASEÑA
  // ---------------------------------------------------------------
  const forgotLinkTienda = document.getElementById("forgotPasswordLinkTienda");
  if (forgotLinkTienda) {
    forgotLinkTienda.addEventListener("click", async (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value.trim();
      const errorEl = document.getElementById("loginError");
      
      if (!email) {
        errorEl.textContent = "Ingresa tu correo primero para recuperar la contraseña.";
        return;
      }
      
      try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password.html"
        });
        
        if (error) throw error;
        
        errorEl.textContent = "";
        alert("Enviamos un enlace de recuperación a " + email + ". Revisa tu correo (y la carpeta de spam).");
      } catch (err) {
        errorEl.textContent = "No se pudo enviar el enlace. Intenta de nuevo.";
      }
    });
  }

  // ---------------------------------------------------------------
  // Verificar si el usuario es staff (dueño/empleado)
  // ---------------------------------------------------------------
  async function checkIfUserIsStaff(userId) {
    try {
      const { data, error } = await supabaseClient
        .from("staff_users")
        .select("id, store_id, role")
        .eq("id", userId)
        .maybeSingle();
      
      if (error) {
        console.warn("Error verificando staff:", error);
        return false;
      }
      
      return !!(data && data.store_id);
    } catch (err) {
      console.error("Error en checkIfUserIsStaff:", err);
      return false;
    }
  }

  // ---------------------------------------------------------------
  // Tras login/registro exitoso
  // ⭐ ACTUALIZADO: Muestra la URL de la tienda al dueño recién registrado
  // ---------------------------------------------------------------
  async function onAuthSuccess(user, newSlug = null) {
    currentUser = user;
    toggleRoleTabs(false);
    
    isStaffUser = await checkIfUserIsStaff(user.id);
    
    await loadProfileIntoForm();
    updateAccountUI();

    if (currentRole === "vendedor" || currentRole === "administrador" || isStaffUser) {
      showAccountView("vendor");
      const firstName = user.user_metadata?.full_name?.split(" ")[0] || "vendedor";
      const vendorGreeting = document.getElementById("vendorGreeting");
      if (vendorGreeting) {
        vendorGreeting.textContent = `¡Hola, ${firstName}!`;
      }
      
      // ⭐ NUEVO: Mostrar la URL de la tienda al dueño recién creado
      if (newSlug) {
        const vendorView = document.getElementById("viewVendor");
        if (vendorView) {
          const storeUrl = `${window.location.origin}/${newSlug}`;
          const urlInfoHtml = `
            <div style="
              margin: 20px 0;
              padding: 16px 20px;
              background: linear-gradient(135deg, rgba(212, 168, 105, 0.12), rgba(143, 107, 63, 0.06));
              border: 1px solid rgba(212, 168, 105, 0.3);
              border-radius: 10px;
              text-align: center;
            ">
              <div style="font-size: 12px; color: #8f6b3f; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; font-weight: 600;">
                Tu URL única de tienda
              </div>
              <div style="font-family: 'Jost', sans-serif; font-size: 14px; color: #1a1410; font-weight: 500; word-break: break-all;">
                ${storeUrl}
              </div>
              <div style="font-size: 11px; color: #666; margin-top: 8px; font-style: italic;">
                Compártela con tus clientes para que vean solo tu tienda
              </div>
              <button type="button" id="copyStoreUrlBtn" style="
                margin-top: 12px;
                padding: 8px 20px;
                background: linear-gradient(135deg, #c9a96e, #8f6b3f);
                color: #ffffff;
                border: none;
                border-radius: 20px;
                cursor: pointer;
                font-family: 'Jost', sans-serif;
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 1px;
                text-transform: uppercase;
              ">📋 Copiar URL</button>
            </div>
          `;
          
          // Insertar antes del botón "Ir al panel"
          const btnPanel = vendorView.querySelector(".btn-auth");
          if (btnPanel) {
            const urlDiv = document.createElement("div");
            urlDiv.innerHTML = urlInfoHtml;
            btnPanel.parentNode.insertBefore(urlDiv, btnPanel);
            
            // Botón copiar
            const copyBtn = document.getElementById("copyStoreUrlBtn");
            if (copyBtn) {
              copyBtn.addEventListener("click", async () => {
                try {
                  await navigator.clipboard.writeText(storeUrl);
                  copyBtn.textContent = "✅ ¡Copiado!";
                  setTimeout(() => {
                    copyBtn.textContent = "📋 Copiar URL";
                  }, 2000);
                } catch (err) {
                  console.error("Error al copiar:", err);
                }
              });
            }
          }
        }
      }
      
      setTimeout(() => {
        window.location.href = "admin.html";
      }, 4000); // Más tiempo para leer la URL
    } else {
      showAccountView("profile");
      
      if (typeof window.loadUserFavorites === "function") {
        await window.loadUserFavorites();
        
        if (typeof window.updateAllFavoriteButtons === "function") {
          window.updateAllFavoriteButtons();
        }
        
        if (typeof window.renderFavoritesSection === "function") {
          window.renderFavoritesSection();
        }
      }
      
      if (typeof window.renderOrdersHistory === "function") {
        window.renderOrdersHistory();
      }
      
      if (typeof window.checkProfileHasData === "function") {
        setTimeout(() => {
          window.checkProfileHasData();
        }, 300);
      }
      
      setTimeout(() => {
        updateTabCounters();
      }, 500);
    }
  }

  // ---------------------------------------------------------------
  // Actualizar contadores de favoritos y pedidos
  // ---------------------------------------------------------------
  async function updateTabCounters() {
    try {
      const { data: authData } = await supabaseClient.auth.getUser();
      const user = authData?.user;
      if (!user) return;
      
      let favCount = 0;
      if (typeof window.userFavorites !== "undefined") {
        favCount = window.userFavorites.size || 0;
      }
      
      let ordersCount = 0;
      try {
        const { data: ordersData, error } = await supabaseClient
          .from("orders")
          .select("id")
          .eq("customer_id", user.id);
        
        if (!error && ordersData) {
          ordersCount = ordersData.length;
        }
      } catch (err) {
        console.error("Error contando pedidos:", err);
      }
      
      if (typeof window.updateProfileTabCounts === "function") {
        window.updateProfileTabCounts(favCount, ordersCount);
      }
      
    } catch (err) {
      console.error("Error actualizando contadores:", err);
    }
  }

  async function loadProfileIntoForm() {
    if (!currentUser) return;

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    const fallbackName = currentUser.user_metadata?.full_name || "";

    if (document.getElementById("profileName")) {
      document.getElementById("profileName").value = profile?.full_name || fallbackName;
      document.getElementById("profilePhone").value = profile?.phone || "";
      document.getElementById("profileAddress").value = profile?.address || "";
    }

    const firstName = (profile?.full_name || fallbackName || currentUser.email).split(" ")[0];
    const profileGreeting = document.getElementById("profileGreeting");
    if (profileGreeting) profileGreeting.textContent = `Hola, ${firstName}`;
  }

  // ---------------------------------------------------------------
  // Actualizar UI del header según tipo de usuario
  // ---------------------------------------------------------------
  function updateAccountUI() {
    if (currentUser) {
      if (isStaffUser) {
        accountLabel.textContent = "Ir al panel";
        accountToggle.classList.add("logged-in");
        accountToggle.classList.add("is-staff");
        accountToggle.title = "Ir al panel de administración";
      } else {
        const name = currentUser.user_metadata?.full_name || currentUser.email;
        accountLabel.textContent = name.split(" ")[0];
        accountToggle.classList.add("logged-in");
        accountToggle.classList.remove("is-staff");
        accountToggle.title = "Mi cuenta";
      }
    } else {
      accountLabel.textContent = "Ingresar";
      accountToggle.classList.remove("logged-in");
      accountToggle.classList.remove("is-staff");
      accountToggle.title = "Iniciar sesión";
    }
  }

  // ---------------------------------------------------------------
  // Inicialización: revisar sesión activa
  // ---------------------------------------------------------------
  async function initAuth() {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
      currentUser = data.session.user;

      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", currentUser.id)
        .maybeSingle();

      currentRole = profile?.role || currentUser.user_metadata?.role || "comprador";
      
      isStaffUser = await checkIfUserIsStaff(currentUser.id);
      
      await loadProfileIntoForm();
      
      if (!isStaffUser && currentRole !== "vendedor" && currentRole !== "administrador" && typeof window.loadUserFavorites === "function") {
        await window.loadUserFavorites();
        
        setTimeout(() => {
          if (typeof window.updateAllFavoriteButtons === "function") {
            window.updateAllFavoriteButtons();
          }
        }, 500);
      }
    }
    updateAccountUI();
  }

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    
    if (currentUser) {
      isStaffUser = await checkIfUserIsStaff(currentUser.id);
    } else {
      isStaffUser = false;
    }
    
    updateAccountUI();
  });

  initAuth();
});

// ---------------------------------------------------------------
// Traducción de errores
// ---------------------------------------------------------------
function traduceErrorAuth(message) {
  const map = {
    "Invalid login credentials": "Correo o contraseña incorrectos.",
    "User already registered": "Ese correo ya tiene una cuenta. Intenta iniciar sesión.",
    "Email not confirmed": "Debes confirmar tu correo antes de ingresar.",
    "Password should be at least 6 characters": "La contraseña debe tener al menos 6 caracteres.",
  };
  return map[message] || "Ocurrió un error. Intenta de nuevo.";
}

// ---------------------------------------------------------------
// ⭐ CSS INYECTADO: Estilos para la vista previa de URL
// ---------------------------------------------------------------
(function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .store-url-preview {
      margin: 12px 0;
      padding: 14px 16px;
      background: linear-gradient(135deg, rgba(212, 168, 105, 0.08), rgba(143, 107, 63, 0.04));
      border: 1px solid rgba(212, 168, 105, 0.25);
      border-radius: 10px;
      transition: all 0.3s ease;
    }
    
    .store-url-preview.available {
      background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05));
      border-color: rgba(76, 175, 80, 0.3);
    }
    
    .store-url-preview.taken {
      background: linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(255, 152, 0, 0.05));
      border-color: rgba(255, 152, 0, 0.3);
    }
    
    .store-url-preview.checking {
      background: linear-gradient(135deg, rgba(158, 158, 158, 0.08), rgba(158, 158, 158, 0.04));
    }
    
    .url-preview-inner {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    
    .url-preview-icon {
      font-size: 20px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    
    .url-preview-content {
      flex: 1;
      min-width: 0;
    }
    
    .url-preview-label {
      display: block;
      font-size: 10px;
      color: #8f6b3f;
      letter-spacing: 1px;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 6px;
      font-family: 'Jost', sans-serif;
    }
    
    .url-preview-value {
      display: block;
      font-family: 'Jost', sans-serif;
      font-size: 13px;
      color: #1a1410;
      word-break: break-all;
      line-height: 1.4;
    }
    
    .url-domain {
      color: #666;
      font-weight: 400;
    }
    
    .url-slug {
      color: #8f6b3f;
      font-weight: 700;
      background: rgba(212, 168, 105, 0.15);
      padding: 2px 6px;
      border-radius: 4px;
    }
    
    .store-url-preview.available .url-slug {
      color: #2e7d32;
      background: rgba(76, 175, 80, 0.15);
    }
    
    .store-url-preview.taken .url-slug {
      color: #ef6c00;
      background: rgba(255, 152, 0, 0.15);
    }
    
    .url-preview-status {
      display: block;
      margin-top: 8px;
      font-size: 11px;
      font-family: 'Jost', sans-serif;
      font-weight: 500;
      transition: all 0.3s ease;
    }
    
    .url-preview-status.available {
      color: #2e7d32;
    }
    
    .url-preview-status.taken {
      color: #ef6c00;
    }
    
    .url-preview-status.checking {
      color: #666;
      font-style: italic;
    }
    
    @media (max-width: 480px) {
      .url-preview-value {
        font-size: 12px;
      }
      .url-preview-status {
        font-size: 10px;
      }
    }
  `;
  document.head.appendChild(style);
})();
