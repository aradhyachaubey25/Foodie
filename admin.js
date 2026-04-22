const loginPanel = document.getElementById("admin-login-panel");
const dashboard = document.getElementById("admin-dashboard");
const loginForm = document.getElementById("admin-login-form");
const authMsg = document.getElementById("admin-auth-msg");
const dashboardMsg = document.getElementById("admin-dashboard-msg");

function showMsg(el, msg, ok = false) {
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? "#6ee7a2" : "#ff9a9a";
}

async function adminApi(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  if (!response.ok) throw new Error(body.message || "Admin request failed.");
  return body;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadStats() {
  const statsEl = document.getElementById("admin-stats");
  const result = await adminApi("/api/admin/stats", { method: "GET" });
  const s = result.stats;
  statsEl.innerHTML = `
    <div class="admin-stat"><strong>${s.customers}</strong><span>Customers</span></div>
    <div class="admin-stat"><strong>${s.orders}</strong><span>Orders</span></div>
    <div class="admin-stat"><strong>${s.menu_items}</strong><span>Menu Items</span></div>
    <div class="admin-stat"><strong>₹${s.revenue.toFixed(2)}</strong><span>Revenue</span></div>
  `;
}

async function loadMenu() {
  const container = document.getElementById("admin-menu-list");
  const result = await adminApi("/api/admin/menu", { method: "GET" });
  const rows = Array.isArray(result.menu) ? result.menu : [];
  if (!rows.length) {
    container.innerHTML = `<p class="admin-muted">No menu items found.</p>`;
    return;
  }
  container.innerHTML = rows
    .map(
      (item) => `
      <article class="admin-row">
        <div>
          <h4>${escapeHtml(item.name)} <small>(${escapeHtml(item.id)})</small></h4>
          <p>${escapeHtml(item.description)}</p>
          <p>₹${item.price} • ${escapeHtml(item.type)}</p>
        </div>
        <div class="admin-row-actions">
          <button data-menu-edit="${escapeHtml(item.id)}">Edit</button>
          <button data-menu-del="${escapeHtml(item.id)}">Delete</button>
        </div>
      </article>
    `
    )
    .join("");
}

async function loadCustomers() {
  const container = document.getElementById("admin-customers-list");
  const result = await adminApi("/api/admin/customers", { method: "GET" });
  const rows = Array.isArray(result.customers) ? result.customers : [];
  if (!rows.length) {
    container.innerHTML = `<p class="admin-muted">No customers found.</p>`;
    return;
  }
  container.innerHTML = rows
    .map(
      (c) => `
      <article class="admin-row">
        <div>
          <h4>${escapeHtml(c.name)} <small>(${escapeHtml(c.email)})</small></h4>
          <p>Orders: ${c.orders_count} • Spent: ₹${c.total_spent.toFixed(2)}</p>
        </div>
        <div class="admin-row-actions">
          <button data-customer-edit="${c.id}">Edit</button>
          <button data-customer-del="${c.id}">Delete</button>
        </div>
      </article>
    `
    )
    .join("");
}

async function loadOrders() {
  const container = document.getElementById("admin-orders-list");
  const result = await adminApi("/api/admin/orders", { method: "GET" });
  const rows = Array.isArray(result.orders) ? result.orders : [];
  if (!rows.length) {
    container.innerHTML = `<p class="admin-muted">No orders found.</p>`;
    return;
  }
  container.innerHTML = rows
    .map(
      (o) => `
      <article class="admin-row">
        <div>
          <h4>Order #${o.id} • ${escapeHtml(o.customer_name)}</h4>
          <p>${escapeHtml(o.customer_email)}</p>
          <p>${o.total_items} item(s) • ₹${o.total_amount}</p>
        </div>
        <div class="admin-row-actions">
          <select data-order-status="${o.id}">
            <option value="placed" ${o.status === "placed" ? "selected" : ""}>placed</option>
            <option value="confirmed" ${o.status === "confirmed" ? "selected" : ""}>confirmed</option>
            <option value="preparing" ${o.status === "preparing" ? "selected" : ""}>preparing</option>
            <option value="dispatched" ${o.status === "dispatched" ? "selected" : ""}>dispatched</option>
            <option value="delivered" ${o.status === "delivered" ? "selected" : ""}>delivered</option>
            <option value="cancelled" ${o.status === "cancelled" ? "selected" : ""}>cancelled</option>
          </select>
          <button data-order-save="${o.id}">Save</button>
          <button data-order-del="${o.id}">Delete</button>
        </div>
      </article>
    `
    )
    .join("");
}

async function refreshDashboard() {
  await Promise.all([loadStats(), loadMenu(), loadCustomers(), loadOrders()]);
}

async function checkAdminSession() {
  try {
    await adminApi("/api/admin/me", { method: "GET" });
    loginPanel.hidden = true;
    dashboard.hidden = false;
    await refreshDashboard();
  } catch {
    loginPanel.hidden = false;
    dashboard.hidden = true;
  }
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("admin-email").value.trim().toLowerCase();
    const password = document.getElementById("admin-password").value.trim();
    try {
      await adminApi("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      showMsg(authMsg, "Login successful.", true);
      loginForm.reset();
      await checkAdminSession();
    } catch (error) {
      showMsg(authMsg, error.message);
    }
  });
}

document.getElementById("admin-logout")?.addEventListener("click", async () => {
  try {
    await adminApi("/api/admin/logout", { method: "POST" });
  } finally {
    await checkAdminSession();
  }
});

document.getElementById("admin-refresh")?.addEventListener("click", async () => {
  await refreshDashboard();
});

document.getElementById("admin-menu-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    id: document.getElementById("menu-id").value.trim().toLowerCase(),
    name: document.getElementById("menu-name").value.trim(),
    description: document.getElementById("menu-description").value.trim(),
    price: Number(document.getElementById("menu-price").value),
    type: document.getElementById("menu-type").value,
    image: document.getElementById("menu-image").value.trim() || "image/burger.png",
  };
  const msgEl = document.getElementById("menu-form-msg");
  try {
    await adminApi("/api/admin/menu", { method: "POST", body: JSON.stringify(payload) });
    showMsg(msgEl, "Menu item created.", true);
    event.target.reset();
    await refreshDashboard();
  } catch (error) {
    showMsg(msgEl, error.message);
  }
});

document.getElementById("admin-menu-list")?.addEventListener("click", async (event) => {
  const delId = event.target.closest("[data-menu-del]")?.dataset.menuDel;
  const editId = event.target.closest("[data-menu-edit]")?.dataset.menuEdit;
  if (delId) {
    if (!window.confirm(`Delete menu item ${delId}?`)) return;
    await adminApi(`/api/admin/menu/${encodeURIComponent(delId)}`, { method: "DELETE" });
    showMsg(dashboardMsg, "Menu item deleted.", true);
    await refreshDashboard();
    return;
  }
  if (editId) {
    const name = window.prompt("New item name:");
    const description = window.prompt("New description:");
    const price = window.prompt("New price:");
    const type = window.prompt("Type (veg/non-veg):", "veg");
    const image = window.prompt("Image path:", "image/burger.png");
    if (!name || !description || !price || !type) return;
    await adminApi(`/api/admin/menu/${encodeURIComponent(editId)}`, {
      method: "PUT",
      body: JSON.stringify({ name, description, price: Number(price), type, image }),
    });
    showMsg(dashboardMsg, "Menu item updated.", true);
    await refreshDashboard();
  }
});

document.getElementById("admin-customers-list")?.addEventListener("click", async (event) => {
  const delId = event.target.closest("[data-customer-del]")?.dataset.customerDel;
  const editId = event.target.closest("[data-customer-edit]")?.dataset.customerEdit;
  if (delId) {
    if (!window.confirm("Delete this customer and related data?")) return;
    await adminApi(`/api/admin/customers/${delId}`, { method: "DELETE" });
    showMsg(dashboardMsg, "Customer deleted.", true);
    await refreshDashboard();
    return;
  }
  if (editId) {
    const name = window.prompt("Updated customer name:");
    const email = window.prompt("Updated customer email:");
    if (!name || !email) return;
    await adminApi(`/api/admin/customers/${editId}`, {
      method: "PUT",
      body: JSON.stringify({ name, email }),
    });
    showMsg(dashboardMsg, "Customer updated.", true);
    await refreshDashboard();
  }
});

document.getElementById("admin-orders-list")?.addEventListener("click", async (event) => {
  const deleteId = event.target.closest("[data-order-del]")?.dataset.orderDel;
  const saveId = event.target.closest("[data-order-save]")?.dataset.orderSave;
  if (deleteId) {
    if (!window.confirm(`Delete order #${deleteId}?`)) return;
    await adminApi(`/api/admin/orders/${deleteId}`, { method: "DELETE" });
    showMsg(dashboardMsg, `Order #${deleteId} deleted.`, true);
    await refreshDashboard();
    return;
  }
  if (saveId) {
    const selectEl = document.querySelector(`[data-order-status="${saveId}"]`);
    const status = selectEl?.value;
    if (!status) return;
    await adminApi(`/api/admin/orders/${saveId}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    showMsg(dashboardMsg, `Order #${saveId} updated to ${status}.`, true);
    await refreshDashboard();
  }
});

checkAdminSession();
