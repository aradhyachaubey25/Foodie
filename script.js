// ===== MOBILE MENU TOGGLE =====
const menuToggle = document.getElementById("menu-toggle");
const mobileMenu = document.querySelector(".mobile-menu");

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener("change", () => {
    mobileMenu.style.display = menuToggle.checked ? "block" : "none";
  });

  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menuToggle.checked = false;
      mobileMenu.style.display = "none";
    });
  });
}

// ===== CART (backend + drawer) =====
let foodieSessionUser = null;
let foodieCartCache = [];
let guestCartDraft = [];
let menuDashboardInitialized = false;

function isUserLoggedIn() {
  return Boolean(foodieSessionUser);
}

function promptLoginForCart() {
  if (authModal) authModal.classList.add("show");
  switchAuthTab("login");
  showAuthMessage("Please login first to add food to cart.", false);
}

function handleCartRequestError(error) {
  const message = error?.message || "Cart request failed. Please try again.";
  if (authModal && authModal.classList.contains("show")) {
    showAuthMessage(message, false);
  } else {
    alert(message);
  }
}

function cartTotalQty(items) {
  return items.reduce((sum, row) => sum + (Number(row.qty) || 0), 0);
}

function cartSubtotal(items) {
  return items.reduce(
    (sum, row) => sum + (Number(row.price) || 0) * (Number(row.qty) || 0),
    0
  );
}

function getActiveCartItems() {
  return isUserLoggedIn() ? foodieCartCache : guestCartDraft;
}

function addLineToGuestDraft(id, name, price, qty = 1) {
  const existing = guestCartDraft.find((row) => row.id === id);
  if (existing) {
    existing.qty = (Number(existing.qty) || 0) + qty;
  } else {
    guestCartDraft.push({ id, name: String(name), price: Number(price), qty });
  }
}

function setGuestDraftQty(id, qty) {
  const n = Math.max(0, Math.floor(Number(qty)));
  const row = guestCartDraft.find((r) => r.id === id);
  if (!row) return;
  if (n === 0) {
    guestCartDraft = guestCartDraft.filter((r) => r.id !== id);
  } else {
    row.qty = n;
  }
}

async function mergeGuestDraftIntoServerCart() {
  if (!isUserLoggedIn() || guestCartDraft.length === 0) return;
  for (const row of guestCartDraft) {
    await apiRequest("/api/cart/add", {
      method: "POST",
      body: JSON.stringify({
        item_id: row.id,
        item_name: row.name,
        item_price: Number(row.price),
        qty: Number(row.qty) || 1,
      }),
    });
  }
  guestCartDraft = [];
}

async function refreshCart() {
  if (!isUserLoggedIn()) {
    foodieCartCache = [];
    return foodieCartCache;
  }
  try {
    const result = await apiRequest("/api/cart", { method: "GET" });
    foodieCartCache = Array.isArray(result?.cart) ? result.cart : [];
  } catch {
    foodieCartCache = [];
  }
  return foodieCartCache;
}

async function addLineToCart(id, name, price) {
  const result = await apiRequest("/api/cart/add", {
    method: "POST",
    body: JSON.stringify({
      item_id: id,
      item_name: String(name),
      item_price: Number(price),
      qty: 1,
    }),
  });
  foodieCartCache = Array.isArray(result?.cart) ? result.cart : [];
  return foodieCartCache;
}

async function setLineQty(id, qty) {
  const n = Math.max(0, Math.floor(Number(qty)));
  const result = await apiRequest("/api/cart/update", {
    method: "POST",
    body: JSON.stringify({ item_id: id, qty: n }),
  });
  foodieCartCache = Array.isArray(result?.cart) ? result.cart : [];
  return foodieCartCache;
}

async function removeLine(id) {
  const result = await apiRequest("/api/cart/remove", {
    method: "POST",
    body: JSON.stringify({ item_id: id }),
  });
  foodieCartCache = Array.isArray(result?.cart) ? result.cart : [];
  return foodieCartCache;
}

async function clearCartStorage() {
  if (!isUserLoggedIn()) {
    guestCartDraft = [];
    return guestCartDraft;
  }
  const result = await apiRequest("/api/cart/clear", { method: "POST" });
  foodieCartCache = Array.isArray(result?.cart) ? result.cart : [];
  return foodieCartCache;
}

async function placeOrder() {
  const result = await apiRequest("/api/checkout", { method: "POST" });
  foodieCartCache = Array.isArray(result?.cart) ? result.cart : [];
  return result;
}

function ensureCartBadge(cartIcon) {
  let badge = cartIcon.querySelector(".badge");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "badge";
    cartIcon.appendChild(badge);
  }
  return badge;
}

function syncCartBadges() {
  const qty = cartTotalQty(getActiveCartItems());
  document.querySelectorAll(".cart-icon .badge").forEach((el) => {
    el.textContent = String(qty);
  });
  syncMenuAddToCartCta();
}

function getCartLineQty(id) {
  const line = getActiveCartItems().find((row) => row.id === id);
  return line ? Number(line.qty) || 0 : 0;
}

function syncMenuQtyControls() {
  document.querySelectorAll(".menu-card[data-menu-id]").forEach((card) => {
    const id = card.dataset.menuId;
    if (!id) return;

    const addBtn = card.querySelector(".add-btn");
    const qtyControl = card.querySelector(".menu-qty-control");
    const qtyValue = card.querySelector(".menu-qty-value");
    if (!addBtn || !qtyControl || !qtyValue) return;

    const qty = getCartLineQty(id);
    qtyValue.textContent = String(qty);
    addBtn.style.display = qty > 0 ? "none" : "inline-flex";
    qtyControl.style.display = qty > 0 ? "inline-flex" : "none";
  });
  syncMenuAddToCartCta();
}

function syncMenuAddToCartCta() {
  const ctaBtn = document.getElementById("menu-add-to-cart-cta");
  const actionsWrap = document.getElementById("menu-actions");
  if (!ctaBtn || !actionsWrap) return;

  const qty = cartTotalQty(getActiveCartItems());
  actionsWrap.hidden = qty <= 0;
  ctaBtn.textContent = `Add to Cart (${qty})`;
}

function initMenuAddToCartCta() {
  const ctaBtn = document.getElementById("menu-add-to-cart-cta");
  if (!ctaBtn) return;
  ctaBtn.addEventListener("click", () => {
    if (!isUserLoggedIn()) {
      promptLoginForCart();
      return;
    }
    openCartDrawer();
  });
  syncMenuAddToCartCta();
}

function createMenuCard(item) {
  const card = document.createElement("div");
  card.className = "menu-card";
  card.dataset.menuId = item.id;
  card.dataset.menuName = item.name;
  card.dataset.menuPrice = String(item.price);
  card.dataset.menuType = item.type;
  card.innerHTML = `
    <img src="${item.image}" alt="${item.name}">
    <h3>${item.name}</h3>
    <p>${item.description}</p>
    <p class="menu-price">₹${item.price}</p>
    <button class="add-btn" type="button" aria-label="Add ${item.name} to cart"><i class="fa-solid fa-plus"></i></button>
  `;
  return card;
}

async function loadMenuCardsFromApi() {
  const menuSection = document.getElementById("menu");
  if (!menuSection) return;
  const grid = menuSection.querySelector(".menu-grid");
  if (!grid) return;

  try {
    const result = await apiRequest("/api/menu", { method: "GET" });
    const items = Array.isArray(result?.menu) ? result.menu : [];
    grid.replaceChildren();
    items.forEach((item, index) => {
      const card = createMenuCard(item);
      card.dataset.menuIndex = String(index);
      grid.appendChild(card);
    });
  } catch {
    grid.replaceChildren();
  }
}

function initMenuQtyControls() {
  document.querySelectorAll(".menu-card[data-menu-id]").forEach((card) => {
    if (card.querySelector(".menu-qty-control")) return;

    const addBtn = card.querySelector(".add-btn");
    if (!addBtn) return;

    const id = card.dataset.menuId;
    const name = card.dataset.menuName;
    const price = card.dataset.menuPrice;
    if (!id || !name || price == null || price === "") return;

    const qtyControl = document.createElement("div");
    qtyControl.className = "menu-qty-control";

    const decBtn = document.createElement("button");
    decBtn.type = "button";
    decBtn.className = "menu-qty-btn";
    decBtn.textContent = "−";
    decBtn.setAttribute("aria-label", `Decrease ${name} quantity`);

    const qtyValue = document.createElement("span");
    qtyValue.className = "menu-qty-value";
    qtyValue.textContent = "0";

    const incBtn = document.createElement("button");
    incBtn.type = "button";
    incBtn.className = "menu-qty-btn";
    incBtn.textContent = "+";
    incBtn.setAttribute("aria-label", `Increase ${name} quantity`);

    qtyControl.append(decBtn, qtyValue, incBtn);
    addBtn.insertAdjacentElement("afterend", qtyControl);

    addBtn.addEventListener("click", async () => {
      try {
        if (isUserLoggedIn()) await addLineToCart(id, name, price);
        else addLineToGuestDraft(id, name, price, 1);
      } catch (error) {
        handleCartRequestError(error);
        return;
      }
      syncCartBadges();
      renderCartDrawer();
      syncMenuQtyControls();

      addBtn.classList.add("added-pulse");
      setTimeout(() => addBtn.classList.remove("added-pulse"), 220);
    });

    incBtn.addEventListener("click", async () => {
      const current = getCartLineQty(id);
      try {
        if (isUserLoggedIn()) {
          if (current <= 0) await addLineToCart(id, name, price);
          else await setLineQty(id, current + 1);
        } else {
          if (current <= 0) addLineToGuestDraft(id, name, price, 1);
          else setGuestDraftQty(id, current + 1);
        }
      } catch (error) {
        handleCartRequestError(error);
        return;
      }
      syncCartBadges();
      renderCartDrawer();
      syncMenuQtyControls();
    });

    decBtn.addEventListener("click", async () => {
      const current = getCartLineQty(id);
      try {
        if (isUserLoggedIn()) {
          if (current <= 1) await setLineQty(id, 0);
          else await setLineQty(id, current - 1);
        } else {
          if (current <= 1) setGuestDraftQty(id, 0);
          else setGuestDraftQty(id, current - 1);
        }
      } catch (error) {
        handleCartRequestError(error);
        return;
      }
      syncCartBadges();
      renderCartDrawer();
      syncMenuQtyControls();
    });
  });

  syncMenuQtyControls();
}

function renderCartDrawer() {
  const bodyEl = document.getElementById("cart-drawer-body");
  const subEl = document.getElementById("cart-drawer-subtotal");
  if (!bodyEl || !subEl) return;

  const cart = getActiveCartItems();
  bodyEl.replaceChildren();

  if (cart.length === 0) {
    const empty = document.createElement("p");
    empty.className = "cart-empty";
    empty.textContent = "Your cart is empty. Add items from the Menu.";
    bodyEl.appendChild(empty);
  } else {
    cart.forEach((row) => {
      const line = document.createElement("div");
      line.className = "cart-line";
      line.dataset.cartId = row.id;

      const title = document.createElement("div");
      title.className = "cart-line-name";
      title.textContent = row.name;

      const meta = document.createElement("div");
      meta.className = "cart-line-meta";

      const priceLabel = document.createElement("span");
      priceLabel.className = "cart-line-price";
      priceLabel.textContent = `₹${row.price} × ${row.qty}`;

      const qtyWrap = document.createElement("div");
      qtyWrap.className = "cart-qty";

      const dec = document.createElement("button");
      dec.type = "button";
      dec.setAttribute("aria-label", "Decrease quantity");
      dec.dataset.cartDec = row.id;
      dec.textContent = "−";

      const count = document.createElement("span");
      count.textContent = String(row.qty);

      const inc = document.createElement("button");
      inc.type = "button";
      inc.setAttribute("aria-label", "Increase quantity");
      inc.dataset.cartInc = row.id;
      inc.textContent = "+";

      qtyWrap.append(dec, count, inc);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "cart-remove";
      removeBtn.dataset.cartRemove = row.id;
      removeBtn.textContent = "Remove";

      meta.append(priceLabel, qtyWrap, removeBtn);
      line.append(title, meta);
      bodyEl.appendChild(line);
    });
  }

  subEl.textContent = `₹${cartSubtotal(cart)}`;
}

function openCartDrawer() {
  if (!isUserLoggedIn()) {
    promptLoginForCart();
    return;
  }
  const overlay = document.getElementById("cart-overlay");
  if (!overlay) return;
  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("cart-open");
  renderCartDrawer();
}

function closeCartDrawer() {
  const overlay = document.getElementById("cart-overlay");
  if (!overlay) return;
  overlay.classList.remove("show");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("cart-open");
}

function ensureCartDrawer() {
  if (document.getElementById("cart-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "cart-overlay";
  overlay.className = "cart-overlay";
  overlay.setAttribute("aria-hidden", "true");

  const drawer = document.createElement("aside");
  drawer.className = "cart-drawer";
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-label", "Shopping cart");

  drawer.innerHTML = `
    <div class="cart-drawer-header">
      <h2>Your cart</h2>
      <button type="button" class="cart-drawer-close" id="cart-drawer-close" aria-label="Close cart">&times;</button>
    </div>
    <div class="cart-drawer-body" id="cart-drawer-body"></div>
    <div class="cart-drawer-footer">
      <div class="cart-subtotal">
        <span>Subtotal</span>
        <span id="cart-drawer-subtotal">₹0</span>
      </div>
      <div class="cart-actions">
        <button type="button" class="cart-btn-secondary" id="cart-clear">Clear</button>
        <button type="button" class="cart-btn-primary" id="cart-checkout">Checkout</button>
      </div>
      <p class="cart-demo-note">Cart and checkout are now connected with backend.</p>
    </div>
  `;

  overlay.appendChild(drawer);
  document.body.appendChild(overlay);

  drawer.addEventListener("click", (e) => e.stopPropagation());

  overlay.addEventListener("click", () => closeCartDrawer());

  document.getElementById("cart-drawer-close").addEventListener("click", () => closeCartDrawer());

  document.getElementById("cart-clear").addEventListener("click", async () => {
    try {
      await clearCartStorage();
    } catch (error) {
      handleCartRequestError(error);
      return;
    }
    syncCartBadges();
    renderCartDrawer();
    syncMenuQtyControls();
  });

  document.getElementById("cart-checkout").addEventListener("click", async () => {
    const cart = getActiveCartItems();
    if (cart.length === 0) return;
    try {
      const result = await placeOrder();
      syncCartBadges();
      renderCartDrawer();
      syncMenuQtyControls();
      const order = result?.order;
      if (order?.id) {
        alert(`Order placed! Order #${order.id} | Items: ${order.total_items} | Total: ₹${order.total_amount}`);
      } else {
        alert("Order placed successfully.");
      }
      closeCartDrawer();
    } catch (error) {
      handleCartRequestError(error);
    }
  });

  const bodyEl = document.getElementById("cart-drawer-body");
  bodyEl.addEventListener("click", async (e) => {
    const decId = e.target.closest("[data-cart-dec]")?.dataset.cartDec;
    const incId = e.target.closest("[data-cart-inc]")?.dataset.cartInc;
    const remId = e.target.closest("[data-cart-remove]")?.dataset.cartRemove;
    if (decId) {
      const row = foodieCartCache.find((r) => r.id === decId);
      try {
        if (row) await setLineQty(decId, (Number(row.qty) || 1) - 1);
      } catch (error) {
        handleCartRequestError(error);
        return;
      }
      syncCartBadges();
      renderCartDrawer();
      syncMenuQtyControls();
    } else if (incId) {
      const row = foodieCartCache.find((r) => r.id === incId);
      try {
        if (row) await setLineQty(incId, (Number(row.qty) || 0) + 1);
      } catch (error) {
        handleCartRequestError(error);
        return;
      }
      syncCartBadges();
      renderCartDrawer();
      syncMenuQtyControls();
    } else if (remId) {
      try {
        await removeLine(remId);
      } catch (error) {
        handleCartRequestError(error);
        return;
      }
      syncCartBadges();
      renderCartDrawer();
      syncMenuQtyControls();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("show")) closeCartDrawer();
  });
}

ensureCartDrawer();

document.querySelectorAll(".cart-icon").forEach((cartIcon) => {
  ensureCartBadge(cartIcon);
  cartIcon.addEventListener("click", (e) => {
    e.preventDefault();
    if (!isUserLoggedIn()) {
      promptLoginForCart();
      return;
    }
    openCartDrawer();
  });
});

syncCartBadges();
renderCartDrawer();
initMenuAddToCartCta();

// ===== NAV SEARCH (URL ?q= fills header search on all pages) =====
function initNavSearchFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  if (q !== null) {
    const v = q.trim();
    document.querySelectorAll('.nav-search-input[name="q"]').forEach((el) => {
      el.value = v;
    });
  }
  const type = params.get("type");
  if (type === "dish") {
    document.querySelectorAll('select[name="type"]').forEach((el) => {
      el.value = type;
    });
  }
}

initNavSearchFromQuery();

function initNavSearchTypeOutsideMenu() {
  if (document.getElementById("menu")) return;

  const typeSelects = document.querySelectorAll('select[name="type"]');
  const searchInputs = document.querySelectorAll('.nav-search-input[name="q"]');
  if (!typeSelects.length) return;

  function updatePlaceholders() {
    const ph = "Search dishes…";
    const label = "Search dishes";
    searchInputs.forEach((el) => {
      el.placeholder = ph;
      el.setAttribute("aria-label", label);
    });
  }

  typeSelects.forEach((el) => {
    el.addEventListener("change", () => {
      const v = el.value;
      typeSelects.forEach((o) => {
        if (o !== el) o.value = v;
      });
      updatePlaceholders();
    });
  });
  updatePlaceholders();
}

initNavSearchTypeOutsideMenu();

// ===== MENU DASHBOARD (header search: dishes + sort) =====
function initMenuDashboard() {
  const section = document.getElementById("menu");
  if (!section) return;

  const grid = section.querySelector(".menu-grid");
  const sortSelect = document.getElementById("menu-sort");
  const vegFilterSelect = document.getElementById("menu-veg-filter");
  const emptyEl = document.getElementById("menu-empty");
  if (!grid || !sortSelect) return;

  const searchInputs = document.querySelectorAll('.nav-search-input[name="q"]');
  const typeSelects = document.querySelectorAll('select[name="type"]');

  function syncTypeSelects(fromEl) {
    const v = fromEl.value === "dish" ? "dish" : "dish";
    typeSelects.forEach((o) => {
      o.value = v;
    });
  }

  function updateSearchPlaceholders() {
    const ph = "Search dishes…";
    const label = "Search dishes";
    searchInputs.forEach((el) => {
      el.placeholder = ph;
      el.setAttribute("aria-label", label);
    });
  }

  const getCards = () =>
    [...grid.querySelectorAll(".menu-card[data-menu-id]")];

  getCards().forEach((card, i) => {
    if (card.dataset.menuIndex == null || card.dataset.menuIndex === "") {
      card.dataset.menuIndex = String(i);
    }
  });

  function cardSearchText(card) {
    const name = (card.dataset.menuName || "").toLowerCase();
    const title = card.querySelector("h3")?.textContent.trim().toLowerCase() || "";
    const descEl = card.querySelector("p:not(.menu-price)");
    const desc = descEl?.textContent.trim().toLowerCase() || "";
    return `${name} ${title} ${desc}`;
  }

  function getSearchQuery() {
    return (searchInputs[0]?.value || "").trim().toLowerCase();
  }

  function matchesVegFilter(card) {
    const mode = vegFilterSelect?.value || "all";
    if (mode === "all") return true;
    const itemType = (card.dataset.menuType || "").toLowerCase();
    return itemType === mode;
  }

  function applyMenuFilterSort() {
    const headingEl = section.querySelector(".section-heading");
    if (headingEl) headingEl.textContent = "Our Menu";
    grid.hidden = false;

    const q = getSearchQuery();
    const sortMode = sortSelect.value;
    const all = getCards();

    let filtered = all.filter((c) => {
      const matchSearch = q ? cardSearchText(c).includes(q) : true;
      return matchSearch && matchesVegFilter(c);
    });

    const compare = (a, b) => {
      switch (sortMode) {
        case "name-asc":
          return (a.dataset.menuName || "").localeCompare(b.dataset.menuName || "");
        case "name-desc":
          return (b.dataset.menuName || "").localeCompare(a.dataset.menuName || "");
        case "price-asc":
          return Number(a.dataset.menuPrice) - Number(b.dataset.menuPrice);
        case "price-desc":
          return Number(b.dataset.menuPrice) - Number(a.dataset.menuPrice);
        default:
          return Number(a.dataset.menuIndex) - Number(b.dataset.menuIndex);
      }
    };

    filtered.sort(compare);

    filtered.forEach((c) => {
      c.hidden = false;
      grid.appendChild(c);
    });

    all.forEach((c) => {
      if (!filtered.includes(c)) {
        c.hidden = true;
        grid.appendChild(c);
      }
    });

    if (emptyEl) {
      emptyEl.hidden = filtered.length > 0;
    }
  }

  searchInputs.forEach((el) => {
    el.addEventListener("input", () => {
      const v = el.value;
      searchInputs.forEach((o) => {
        if (o !== el) o.value = v;
      });
      applyMenuFilterSort();
    });
  });

  typeSelects.forEach((el) => {
    el.addEventListener("change", () => {
      syncTypeSelects(el);
      updateSearchPlaceholders();
      applyMenuFilterSort();
    });
  });

  sortSelect.addEventListener("change", applyMenuFilterSort);
  if (vegFilterSelect) vegFilterSelect.addEventListener("change", applyMenuFilterSort);
  updateSearchPlaceholders();
  applyMenuFilterSort();
}

async function initMenuPage() {
  const section = document.getElementById("menu");
  if (!section) return;
  await loadMenuCardsFromApi();
  initMenuQtyControls();
  if (!menuDashboardInitialized) {
    initMenuDashboard();
    menuDashboardInitialized = true;
  }
}

initMenuPage();

// ===== SMOOTH SCROLL =====
document.querySelectorAll("a[href^='#']").forEach((link) => {
  if (link.classList.contains("cart-icon")) return;

  link.addEventListener("click", function (e) {
    const targetID = this.getAttribute("href");

    if (!targetID || targetID === "#") return;

    const target = document.querySelector(targetID);
    if (!target) return;

    e.preventDefault();
    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    if (window.innerWidth <= 768 && menuToggle && mobileMenu) {
      menuToggle.checked = false;
      mobileMenu.style.display = "none";
    }
  });
});

// ===== AUTH MODAL (PYTHON + SQLITE BACKEND) =====
const openAuthModalBtn = document.getElementById("open-auth-modal");
const authModal = document.getElementById("auth-modal");
const closeAuthModalBtn = document.getElementById("close-auth-modal");
const authTabs = document.querySelectorAll(".auth-tab");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const authMessage = document.getElementById("auth-message");
let profileMenuWrap = null;
let profileMenuDropdown = null;

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message = body?.message || "Request failed. Please try again.";
    throw new Error(message);
  }

  return body;
}

function showAuthMessage(message, isSuccess) {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.style.color = isSuccess ? "#42d67f" : "#ff7b7b";
}

function closeProfileMenu() {
  if (!profileMenuDropdown) return;
  profileMenuDropdown.classList.remove("show");
  const toggleBtn = profileMenuWrap?.querySelector("#profile-menu-toggle");
  if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
}

function ensureProfileMenu() {
  if (!openAuthModalBtn || profileMenuWrap) return;
  profileMenuWrap = document.createElement("div");
  profileMenuWrap.className = "profile-menu";
  profileMenuWrap.hidden = true;
  profileMenuWrap.innerHTML = `
    <button type="button" class="profile-menu-toggle" id="profile-menu-toggle" aria-label="Open profile menu">
      <i class="fa-regular fa-user"></i>
    </button>
    <div class="profile-menu-dropdown" id="profile-menu-dropdown">
      <button type="button" id="profile-menu-profile">Profile</button>
      <button type="button" id="profile-menu-orders">My Orders</button>
      <button type="button" id="profile-menu-logout">Logout</button>
    </div>
  `;
  openAuthModalBtn.insertAdjacentElement("afterend", profileMenuWrap);
  profileMenuDropdown = profileMenuWrap.querySelector("#profile-menu-dropdown");
  const toggleBtn = profileMenuWrap.querySelector("#profile-menu-toggle");
  const profileBtn = profileMenuWrap.querySelector("#profile-menu-profile");
  const ordersBtn = profileMenuWrap.querySelector("#profile-menu-orders");
  const logoutBtn = profileMenuWrap.querySelector("#profile-menu-logout");
  profileMenuWrap.addEventListener("click", (event) => event.stopPropagation());

  toggleBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!profileMenuDropdown) return;
    const willOpen = !profileMenuDropdown.classList.contains("show");
    profileMenuDropdown.classList.toggle("show", willOpen);
    toggleBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });

  profileBtn?.addEventListener("click", () => {
    const name = foodieSessionUser?.name || "User";
    const email = foodieSessionUser?.email || "N/A";
    alert(`Name: ${name}\nEmail: ${email}`);
    closeProfileMenu();
  });

  ordersBtn?.addEventListener("click", () => {
    closeProfileMenu();
    window.location.href = "my-orders.html";
  });

  logoutBtn?.addEventListener("click", async () => {
    await performUserLogout();
    closeProfileMenu();
  });

  document.addEventListener("click", () => {
    if (!profileMenuWrap || !profileMenuDropdown) return;
    closeProfileMenu();
  });
}

async function performUserLogout() {
  try {
    await apiRequest("/api/logout", { method: "POST" });
  } catch {
    // ignore logout error and clear local view anyway
  }
  foodieSessionUser = null;
  foodieCartCache = [];
  guestCartDraft = [];
  updateAuthButton();
  closeCartDrawer();
  showAuthMessage("", true);
  syncCartBadges();
  renderCartDrawer();
  syncMenuQtyControls();
  initOrdersPage();
}

function updateAuthButton() {
  if (!openAuthModalBtn) return;
  ensureProfileMenu();
  if (foodieSessionUser?.name) {
    openAuthModalBtn.hidden = true;
    if (profileMenuWrap) {
      profileMenuWrap.hidden = false;
      const toggleBtn = profileMenuWrap.querySelector("#profile-menu-toggle");
      if (toggleBtn) toggleBtn.title = foodieSessionUser.name;
    }
  } else {
    openAuthModalBtn.hidden = false;
    openAuthModalBtn.textContent = "Login / Sign Up";
    if (profileMenuWrap) {
      profileMenuWrap.hidden = true;
      closeProfileMenu();
    }
  }
}

function switchAuthTab(tabName) {
  authTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.authTab === tabName);
  });

  if (loginForm && signupForm) {
    loginForm.classList.toggle("active", tabName === "login");
    signupForm.classList.toggle("active", tabName === "signup");
  }

  showAuthMessage("", true);
}

if (openAuthModalBtn && authModal && closeAuthModalBtn) {
  openAuthModalBtn.addEventListener("click", async () => {
    if (isUserLoggedIn()) return;
    authModal.classList.add("show");
  });

  closeAuthModalBtn.addEventListener("click", () => {
    authModal.classList.remove("show");
    showAuthMessage("", true);
  });

  authModal.addEventListener("click", (event) => {
    if (event.target === authModal) {
      authModal.classList.remove("show");
      showAuthMessage("", true);
    }
  });
}

authTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const targetTab = tab.dataset.authTab || "login";
    switchAuthTab(targetTab);
  });
});

if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("signup-name")?.value.trim();
    const email = document.getElementById("signup-email")?.value.trim().toLowerCase();
    const password = document.getElementById("signup-password")?.value.trim();

    if (!name || !email || !password) {
      showAuthMessage("Please fill all signup fields.", false);
      return;
    }

    try {
      await apiRequest("/api/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      showAuthMessage("Account created! Please login now.", true);
      switchAuthTab("login");
      signupForm.reset();
    } catch (error) {
      showAuthMessage(error.message, false);
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("login-email")?.value.trim().toLowerCase();
    const password = document.getElementById("login-password")?.value.trim();
    try {
      const result = await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      foodieSessionUser = result.user || null;
      await mergeGuestDraftIntoServerCart();
      await refreshCart();
      updateAuthButton();
      showAuthMessage(`Welcome back, ${foodieSessionUser?.name || "User"}!`, true);
      loginForm.reset();
      authModal.classList.remove("show");
      syncCartBadges();
      renderCartDrawer();
      syncMenuQtyControls();
      initOrdersPage();
      return;
    } catch (error) {
      showAuthMessage(error.message, false);
    }
  });
}

async function syncAuthSession() {
  try {
    const result = await apiRequest("/api/me", { method: "GET" });
    foodieSessionUser = result.user || null;
  } catch {
    foodieSessionUser = null;
  }
  await refreshCart();
  updateAuthButton();
  syncCartBadges();
  renderCartDrawer();
  syncMenuQtyControls();
  initOrdersPage();
}

async function initOrdersPage() {
  const ordersListEl = document.getElementById("orders-list");
  const ordersNoteEl = document.getElementById("orders-note");
  if (!ordersListEl || !ordersNoteEl) return;

  if (!isUserLoggedIn()) {
    ordersNoteEl.textContent = "Please login to view your order history.";
    ordersListEl.replaceChildren();
    return;
  }

  try {
    const result = await apiRequest("/api/orders", { method: "GET" });
    const orders = Array.isArray(result?.orders) ? result.orders : [];
    ordersListEl.replaceChildren();

    if (orders.length === 0) {
      ordersNoteEl.textContent = "No orders yet. Place your first order from the menu.";
      return;
    }

    ordersNoteEl.textContent = `Showing ${orders.length} order(s).`;

    orders.forEach((order) => {
      const card = document.createElement("article");
      card.className = "orders-card";

      const createdAt = order.created_at
        ? new Date(order.created_at.replace(" ", "T")).toLocaleString()
        : "N/A";

      const itemsHtml = (order.items || [])
        .map(
          (item) => `
            <li>
              <span>${item.name} × ${item.qty}</span>
              <span>₹${item.line_total}</span>
            </li>
          `
        )
        .join("");

      card.innerHTML = `
        <div class="orders-card-head">
          <h3>Order #${order.id}</h3>
          <span class="orders-status">${order.status}</span>
        </div>
        <p class="orders-meta">Placed: ${createdAt}</p>
        <ul class="orders-items">${itemsHtml}</ul>
        <div class="orders-total">
          <strong>${order.total_items} item(s)</strong>
          <strong>₹${order.total_amount}</strong>
        </div>
      `;
      ordersListEl.appendChild(card);
    });
  } catch (error) {
    ordersNoteEl.textContent = error?.message || "Unable to load orders right now.";
    ordersListEl.replaceChildren();
  }
}

syncAuthSession();
