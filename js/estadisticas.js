/* ============================================
   MAISON — Estadísticas
============================================ */

let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  
  const btnRefresh = document.getElementById("btnRefresh");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", loadStats);
  }
});

/* ============================================
   VERIFICAR SESIÓN
============================================ */
async function initAuth() {
  const { data } = await supabaseClient.auth.getSession();
  
  if (data.session?.user) {
    currentUser = data.session.user;
    
    // Verificar que sea vendedor/administrador
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role, full_name")
      .eq("id", currentUser.id)
      .maybeSingle();
    
    if (!profile || !["vendedor", "administrador"].includes(profile.role)) {
      showAccessDenied();
      return;
    }
    
    document.getElementById("statsPage").style.display = "flex";
    document.getElementById("pageSubtitle").textContent =
      `Datos de ${profile.full_name || currentUser.email}`;
    loadStats();
    
  } else {
    showAccessDenied();
  }
}

function showAccessDenied() {
  document.getElementById("statsPage").style.display = "none";
  document.getElementById("accessDenied").style.display = "flex";
}

/* ============================================
   CARGAR ESTADÍSTICAS
============================================ */
async function loadStats() {
  document.getElementById("statsLoading").style.display = "block";
  document.getElementById("statsContent").style.display = "none";

  try {
    // Cargar TODOS los pedidos del vendedor
    const { data: pedidos, error } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("seller_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!pedidos || pedidos.length === 0) {
      renderStatsEmpty();
      return;
    }

    calcularYRenderizar(pedidos);

  } catch (err) {
    console.error("Error cargando estadísticas:", err);
    document.getElementById("statsLoading").innerHTML =
      '<p>Error al cargar. Recarga la página.</p>';
  }
}

function calcularYRenderizar(pedidos) {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  const pedidosMes = pedidos.filter(p => new Date(p.created_at) >= inicioMes);

  const ingresosMes = pedidosMes
    .filter(p => p.status !== "cancelado")
    .reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);

  const totalPedidos = pedidos.length;

  const ingresosTotal = pedidos
    .filter(p => p.status !== "cancelado")
    .reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);

  const ticketPromedio = totalPedidos > 0 ? ingresosTotal / totalPedidos : 0;

  // Renderizar métricas
  document.getElementById("statIngresos").textContent = formatPrice(ingresosMes);
  document.getElementById("statIngresosSub").textContent =
    `${formatPrice(ingresosTotal)} en total`;
  document.getElementById("statVentasMes").textContent = pedidosMes.length;
  document.getElementById("statTotalPedidos").textContent = totalPedidos;
  document.getElementById("statTicket").textContent = formatPrice(ticketPromedio);

  // Renderizar gráficos
  renderBarChart(pedidos);
  renderTopProducts(pedidos);
  renderEstadosChart(pedidos);
  renderRecentOrders(pedidos.slice(0, 5));

  // Mostrar contenido
  document.getElementById("statsLoading").style.display = "none";
  document.getElementById("statsContent").style.display = "block";
}

/* ============================================
   GRÁFICO DE BARRAS (últimos 30 días)
============================================ */
function renderBarChart(pedidos) {
  const barChart = document.getElementById("barChart");
  const labelsEl = document.getElementById("barChartLabels");

  const dias = [];
  const ahora = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(ahora);
    d.setDate(d.getDate() - i);
    dias.push({
      fecha: d.toISOString().split("T")[0],
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      count: 0
    });
  }

  pedidos.forEach(pedido => {
    const fechaPedido = new Date(pedido.created_at).toISOString().split("T")[0];
    const dia = dias.find(d => d.fecha === fechaPedido);
    if (dia) dia.count++;
  });

  const maxCount = Math.max(...dias.map(d => d.count), 1);

  barChart.innerHTML = dias.map((dia) => {
    const heightPct = maxCount > 0 ? (dia.count / maxCount) * 100 : 0;
    const tooltip = `${dia.label}: ${dia.count} pedido${dia.count !== 1 ? "s" : ""}`;
    return `
      <div class="bar-item">
        <div class="bar-fill"
             style="height: ${heightPct}%"
             data-value="${tooltip}"
             title="${tooltip}">
        </div>
      </div>
    `;
  }).join("");

  labelsEl.innerHTML = dias.map((dia, index) => {
    const show = (index % 5 === 0) || index === 29;
    return `<span class="bar-label ${show ? "" : "hidden-label"}">${show ? dia.label : ""}</span>`;
  }).join("");
}

/* ============================================
   TOP 5 PRODUCTOS MÁS VENDIDOS
============================================ */
function renderTopProducts(pedidos) {
  const container = document.getElementById("topProductsList");

  const productMap = {};

  pedidos.forEach(pedido => {
    if (pedido.status === "cancelado") return;
    (pedido.items || []).forEach(item => {
      const key = item.product_id || item.name;
      if (!productMap[key]) {
        productMap[key] = {
          nombre: item.name || "Producto",
          total: 0
        };
      }
      productMap[key].total += Number(item.qty) || 1;
    });
  });

  const top5 = Object.values(productMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  if (!top5.length) {
    container.innerHTML = `<div class="empty-state">Sin datos de productos vendidos.</div>`;
    return;
  }

  const maxUnits = top5[0].total;

  container.innerHTML = top5.map((product, index) => {
    const rank = index + 1;
    const pct = maxUnits > 0 ? (product.total / maxUnits) * 100 : 0;
    return `
      <div class="top-product-item">
        <div class="top-rank rank-${rank}">${rank}</div>
        <div class="top-product-info">
          <div class="top-product-name" title="${product.nombre}">
            ${escapeHtml(product.nombre)}
          </div>
          <div class="top-product-bar-wrap">
            <div class="top-product-bar-bg">
              <div class="top-product-bar-fill" style="width: ${pct}%"></div>
            </div>
            <span class="top-product-units">${product.total} uds.</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

/* ============================================
   DISTRIBUCIÓN DE ESTADOS
============================================ */
function renderEstadosChart(pedidos) {
  const container = document.getElementById("estadosChart");
  const total = pedidos.length;

  if (!total) {
    container.innerHTML = `<div class="empty-state">No hay pedidos para mostrar.</div>`;
    return;
  }

  const estadoMap = {
    pendiente: 0,
    confirmado: 0,
    entregado: 0,
    cancelado: 0
  };

  pedidos.forEach(p => {
    const estado = p.status || "pendiente";
    if (estadoMap.hasOwnProperty(estado)) {
      estadoMap[estado]++;
    }
  });

  container.innerHTML = Object.entries(estadoMap).map(([estado, count]) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `
      <div class="estado-item">
        <div class="estado-header-row">
          <span class="estado-name">
            <span class="estado-dot dot-${estado}"></span>
            ${estado}
          </span>
          <div class="estado-stats">
            <span class="estado-count">${count} pedidos</span>
            <span class="estado-pct">${pct}%</span>
          </div>
        </div>
        <div class="estado-bar-bg">
          <div class="estado-bar-fill fill-${estado}" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

/* ============================================
   PEDIDOS RECIENTES
============================================ */
function renderRecentOrders(pedidos) {
  const container = document.getElementById("recentOrders");

  if (!pedidos.length) {
    container.innerHTML = `<div class="empty-state">No hay pedidos recientes.</div>`;
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
            <td><strong>#${p.order_number}</strong></td>
            <td>${escapeHtml(p.customer_name || p.customer_email || "—")}</td>
            <td>${formatDate(p.created_at)}</td>
            <td><strong>${formatPrice(p.total)}</strong></td>
            <td>
              <span class="estado-badge ${p.status || "pendiente"}">
                ${p.status || "pendiente"}
              </span>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

/* ============================================
   ESTADO VACÍO
============================================ */
function renderStatsEmpty() {
  document.getElementById("statsLoading").style.display = "none";
  document.getElementById("statsContent").style.display = "block";

  document.getElementById("statIngresos").textContent = "$0";
  document.getElementById("statIngresosSub").textContent = "";
  document.getElementById("statVentasMes").textContent = "0";
  document.getElementById("statTotalPedidos").textContent = "0";
  document.getElementById("statTicket").textContent = "$0";

  ["barChart", "topProductsList", "estadosChart", "recentOrders"].forEach(id => {
    document.getElementById(id).innerHTML = `<div class="empty-state">Aún no hay datos disponibles. Cuando llegue el primer pedido, verás las estadísticas aquí.</div>`;
  });
}

/* ============================================
   UTILIDADES
============================================ */
function formatPrice(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
