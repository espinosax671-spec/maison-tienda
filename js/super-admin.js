/* ===================================================================
   SUPER ADMIN — MAISON
   Requiere: js/supabase-client.js antes que este archivo.
   Panel global: lista todas las tiendas y activa/desactiva cada una.
=================================================================== */

let tiendas = [];

function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ---------------------------------------------------------------
// Login
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
  btn.textContent = "Ingresar";

  if (error) {
    errorEl.textContent = "Correo o contraseña incorrectos.";
    return;
  }

  await checkAdminAndEnter(data.user);
});

// ---------------------------------------------------------------
// Verificar que sea super admin
// ---------------------------------------------------------------
async function checkAdminAndEnter(user) {
  const { data: esAdmin, error: adminError } = await supabaseClient.rpc('es_admin');

  if (adminError || esAdmin !== true) {
    await denyAccess();
    return;
  }

  document.getElementById("adminUserName").textContent =
    user.user_metadata?.full_name || user.email;

  document.getElementById("gate").style.display = "none";
  document.getElementById("noAccess").style.display = "none";
  document.getElementById("adminApp").style.display = "block";

  await loadTiendas();
}

async function denyAccess() {
  await supabaseClient.auth.signOut();
  document.getElementById("gate").style.display = "none";
  document.getElementById("noAccess").style.display = "flex";
}

document.getElementById("noAccessLogout").addEventListener("click", () => {
  window.location.href = "index.html";
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
});

// ---------------------------------------------------------------
// Cargar tiendas
// ---------------------------------------------------------------
async function loadTiendas() {
  const { data, error } = await supabaseClient.rpc('obtener_tiendas');

  if (error) {
    showToast('Error al cargar: ' + error.message, 'error');
    return;
  }

  tiendas = data || [];
  renderStats();
  renderTable();
}

function renderStats() {
  const activas = tiendas.filter(t => t.active).length;
  document.getElementById("statTotal").textContent = tiendas.length;
  document.getElementById("statActivas").textContent = activas;
  document.getElementById("statDesactivadas").textContent = tiendas.length - activas;
}

function formatDate(fecha) {
  if (!fecha) return "—";
  const d = new Date(fecha);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function renderTable() {
  const container = document.getElementById("storesTable");

  if (tiendas.length === 0) {
    container.innerHTML = `<p class="empty-msg">No hay tiendas registradas.</p>`;
    return;
  }

  container.innerHTML = "";

  tiendas.forEach((t) => {
    const initials = (t.name || "MAISON").trim().charAt(0).toUpperCase();
    const estado = t.active
      ? '<span class="status-pill active">Activa</span>'
      : '<span class="status-pill inactive">Desactivada</span>';

    const acciones = t.active
      ? `<button type="button" class="btn btn-ghost" data-toggle="${t.id}">Desactivar</button>`
      : `<button type="button" class="btn btn-primary" data-toggle="${t.id}">Activar</button>`;

    const row = document.createElement("div");
    row.className = "product-row sa-store-row";
    row.innerHTML = `
      <span class="store-thumb">${escapeHtml(initials)}</span>
      <div class="product-row-info">
        <div class="product-row-name">${escapeHtml(t.name)}</div>
        <div class="product-row-meta">
          <span>/</span><span>${escapeHtml(t.slug)}</span>
          <span>·</span><span>${escapeHtml(t.owner_name)}</span>
          <span>·</span><em>${escapeHtml(t.owner_email)}</em>
          <span>·</span><span>${formatDate(t.created_at)}</span>
        </div>
      </div>
      <div class="status-pill ${t.active ? "active" : "inactive"}">${t.active ? "Activa" : "Desactivada"}</div>
      <div class="product-row-actions">${acciones}</div>
    `;

    const toggleBtn = row.querySelector("[data-toggle]");
    if (toggleBtn) toggleBtn.addEventListener("click", () => cambiarEstado(t.id, !t.active));

    container.appendChild(row);
  });
}

// ---------------------------------------------------------------
// Activar / Desactivar tienda
// ---------------------------------------------------------------
async function cambiarEstado(id, activa) {
  const { error } = await supabaseClient.rpc('cambiar_estado_tienda', {
    p_store_id: id,
    p_active: activa,
  });

  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }

  showToast(activa ? 'Tienda activada' : 'Tienda desactivada');
  loadTiendas();
}

document.getElementById("refreshBtn").addEventListener("click", loadTiendas);

// ---------------------------------------------------------------
// Sesión existente al cargar
// ---------------------------------------------------------------
async function init() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (sessionData.session) {
    await checkAdminAndEnter(sessionData.session.user);
  } else {
    document.getElementById("gate").style.display = "flex";
  }
}

init();
