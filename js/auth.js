/* ===================================================================
   AUTENTICACIÓN — Registro, Login, Perfil, Sesión
   Con roles: comprador (tienda) y vendedor (panel admin)
   Integrado con sistema de FAVORITOS (Mejora #5)
   Integrado con HISTORIAL DE PEDIDOS (Mejora #8)
=================================================================== */

let currentUser = null;
let currentRole = null;
let selectedRole = 'comprador';

// ---------------------------------------------------------------
// TODO EL CÓDIGO SE EJECUTA CUANDO EL DOM ESTÁ LISTO
// ---------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {

  // ---------------------------------------------------------------
  // Elementos del modal de cuenta
  // ---------------------------------------------------------------
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
        if (loginEyebrow) loginEyebrow.textContent = "Acceso Vendedor";
        if (registerEyebrow) registerEyebrow.textContent = "Crear cuenta Vendedor";
        if (vendorFields) vendorFields.style.display = "block";
      } else {
        if (loginEyebrow) loginEyebrow.textContent = "Acceso Cliente";
        if (registerEyebrow) registerEyebrow.textContent = "Crear cuenta Cliente";
        if (vendorFields) vendorFields.style.display = "none";
      }
    });
  });

  // ---------------------------------------------------------------
  // Botón "Ingresar" del header
  // ---------------------------------------------------------------
  accountToggle.addEventListener("click", () => {
    openAccountModal();
    if (currentUser) {
      toggleRoleTabs(false);
      showAccountView(currentRole === "vendedor" ? "vendor" : "profile");
      
      // Al abrir el perfil de cliente, cargar favoritos e historial
      if (currentRole !== "vendedor") {
        if (typeof window.renderFavoritesSection === "function") {
          window.renderFavoritesSection();
        }
        // ============ NUEVO: Cargar historial de pedidos ============
        if (typeof window.renderOrdersHistory === "function") {
          window.renderOrdersHistory();
        }
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
  // REGISTRO
  // ---------------------------------------------------------------
  document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("registerError");
    errorEl.textContent = "";

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    const whatsapp = document.getElementById("registerWhatsapp")?.value.trim() || "";
    const btn = document.getElementById("registerSubmitBtn");

    if (selectedRole === "vendedor" && !whatsapp) {
      errorEl.textContent = "Como vendedor necesitas ingresar tu número de WhatsApp.";
      return;
    }

    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = "<span>Creando cuenta...</span>";

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: selectedRole,
          whatsapp: whatsapp,
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
      role: selectedRole,
      updated_at: new Date().toISOString(),
    });

    if (selectedRole === "vendedor") {
      const { error: staffError } = await supabaseClient.rpc("registrar_vendedor", {
        user_id: data.user.id,
        nombre: name,
      });
      
      if (staffError) {
        console.error("Error al registrar como vendedor:", staffError);
        errorEl.textContent = "Cuenta creada, pero hubo un problema con el acceso al panel. Contacta al administrador.";
        return;
      }
    }

    currentRole = selectedRole;
    await onAuthSuccess(data.user);
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
    
    // Limpiar favoritos al cerrar sesión
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
  // PERFIL
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
  });

  // ---------------------------------------------------------------
  // RECUPERAR CONTRASEÑA (desde la tienda)
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
  // Tras login/registro exitoso
  // ---------------------------------------------------------------
  async function onAuthSuccess(user) {
    currentUser = user;
    toggleRoleTabs(false);
    await loadProfileIntoForm();
    updateAccountUI();

    if (currentRole === "vendedor") {
      showAccountView("vendor");
      const firstName = user.user_metadata?.full_name?.split(" ")[0] || "vendedor";
      const vendorGreeting = document.getElementById("vendorGreeting");
      if (vendorGreeting) {
        vendorGreeting.textContent = `Hola, ${firstName}`;
      }
      
      setTimeout(() => {
        window.location.href = "admin.html";
      }, 2500);
    } else {
      showAccountView("profile");
      
      // Cargar favoritos del usuario recién logueado
      if (typeof window.loadUserFavorites === "function") {
        await window.loadUserFavorites();
        
        if (typeof window.updateAllFavoriteButtons === "function") {
          window.updateAllFavoriteButtons();
        }
        
        if (typeof window.renderFavoritesSection === "function") {
          window.renderFavoritesSection();
        }
      }
      
      // ============ NUEVO: Cargar historial de pedidos ============
      if (typeof window.renderOrdersHistory === "function") {
        window.renderOrdersHistory();
      }
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

  function updateAccountUI() {
    if (currentUser) {
      const name = currentUser.user_metadata?.full_name || currentUser.email;
      accountLabel.textContent = name.split(" ")[0];
      accountToggle.classList.add("logged-in");
    } else {
      accountLabel.textContent = "Ingresar";
      accountToggle.classList.remove("logged-in");
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
      await loadProfileIntoForm();
      
      // Cargar favoritos al iniciar si hay sesión activa
      if (currentRole !== "vendedor" && typeof window.loadUserFavorites === "function") {
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

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
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
