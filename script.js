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

// ===== CART (localStorage + drawer, frontend only) =====
const FOODIE_CART_KEY = "foodieCart";

function loadCart() {
  try {
    const raw = localStorage.getItem(FOODIE_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem(FOODIE_CART_KEY, JSON.stringify(items));
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

function addLineToCart(id, name, price) {
  const cart = loadCart();
  const existing = cart.find((row) => row.id === id);
  if (existing) {
    existing.qty = (Number(existing.qty) || 0) + 1;
  } else {
    cart.push({ id, name: String(name), price: Number(price), qty: 1 });
  }
  saveCart(cart);
  return cart;
}

function setLineQty(id, qty) {
  let cart = loadCart();
  const row = cart.find((r) => r.id === id);
  if (!row) return cart;
  const n = Math.max(0, Math.floor(Number(qty)));
  if (n === 0) cart = cart.filter((r) => r.id !== id);
  else row.qty = n;
  saveCart(cart);
  return cart;
}

function removeLine(id) {
  const cart = loadCart().filter((r) => r.id !== id);
  saveCart(cart);
  return cart;
}

function clearCartStorage() {
  saveCart([]);
  return [];
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
  const qty = cartTotalQty(loadCart());
  document.querySelectorAll(".cart-icon .badge").forEach((el) => {
    el.textContent = String(qty);
  });
  syncMenuAddToCartCta();
}

function getCartLineQty(id) {
  const line = loadCart().find((row) => row.id === id);
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

  const qty = cartTotalQty(loadCart());
  actionsWrap.hidden = qty <= 0;
  ctaBtn.textContent = `Add to Cart (${qty})`;
}

function initMenuAddToCartCta() {
  const ctaBtn = document.getElementById("menu-add-to-cart-cta");
  if (!ctaBtn) return;
  ctaBtn.addEventListener("click", openCartDrawer);
  syncMenuAddToCartCta();
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

    addBtn.addEventListener("click", () => {
      addLineToCart(id, name, price);
      syncCartBadges();
      renderCartDrawer();
      syncMenuQtyControls();

      addBtn.classList.add("added-pulse");
      setTimeout(() => addBtn.classList.remove("added-pulse"), 220);
    });

    incBtn.addEventListener("click", () => {
      const current = getCartLineQty(id);
      if (current <= 0) addLineToCart(id, name, price);
      else setLineQty(id, current + 1);
      syncCartBadges();
      renderCartDrawer();
      syncMenuQtyControls();
    });

    decBtn.addEventListener("click", () => {
      const current = getCartLineQty(id);
      if (current <= 1) setLineQty(id, 0);
      else setLineQty(id, current - 1);
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

  const cart = loadCart();
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
      <p class="cart-demo-note">Frontend demo — cart is saved in this browser only.</p>
    </div>
  `;

  overlay.appendChild(drawer);
  document.body.appendChild(overlay);

  drawer.addEventListener("click", (e) => e.stopPropagation());

  overlay.addEventListener("click", () => closeCartDrawer());

  document.getElementById("cart-drawer-close").addEventListener("click", () => closeCartDrawer());

  document.getElementById("cart-clear").addEventListener("click", () => {
    clearCartStorage();
    syncCartBadges();
    renderCartDrawer();
    syncMenuQtyControls();
  });

  document.getElementById("cart-checkout").addEventListener("click", () => {
    const cart = loadCart();
    if (cart.length === 0) return;
    alert("Checkout is not wired yet — this is a frontend-only build.");
  });

  const bodyEl = document.getElementById("cart-drawer-body");
  bodyEl.addEventListener("click", (e) => {
    const decId = e.target.closest("[data-cart-dec]")?.dataset.cartDec;
    const incId = e.target.closest("[data-cart-inc]")?.dataset.cartInc;
    const remId = e.target.closest("[data-cart-remove]")?.dataset.cartRemove;
    if (decId) {
      const row = loadCart().find((r) => r.id === decId);
      if (row) setLineQty(decId, (Number(row.qty) || 1) - 1);
      syncCartBadges();
      renderCartDrawer();
      syncMenuQtyControls();
    } else if (incId) {
      const row = loadCart().find((r) => r.id === incId);
      if (row) setLineQty(incId, (Number(row.qty) || 0) + 1);
      syncCartBadges();
      renderCartDrawer();
      syncMenuQtyControls();
    } else if (remId) {
      removeLine(remId);
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
    openCartDrawer();
  });
});

syncCartBadges();
renderCartDrawer();
initMenuQtyControls();
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
  if (type === "dish" || type === "restaurant") {
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
    const isRestaurant = typeSelects[0]?.value === "restaurant";
    const ph = isRestaurant ? "Search restaurants…" : "Search dishes…";
    const label = isRestaurant ? "Search restaurants" : "Search dishes";
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

// ===== MENU DASHBOARD (header search: dishes / restaurants + sort) =====
function initMenuDashboard() {
  const section = document.getElementById("menu");
  if (!section) return;

  const grid = section.querySelector(".menu-grid");
  const sortSelect = document.getElementById("menu-sort");
  const vegFilterSelect = document.getElementById("menu-veg-filter");
  const emptyEl = document.getElementById("menu-empty");
  const restaurantGrid = document.getElementById("restaurant-grid");
  const restaurantEmpty = document.getElementById("restaurant-empty");
  const menuDashboard = section.querySelector(".menu-dashboard");
  if (!grid || !sortSelect) return;

  const searchInputs = document.querySelectorAll('.nav-search-input[name="q"]');
  const typeSelects = document.querySelectorAll('select[name="type"]');

  function getSearchType() {
    return typeSelects[0]?.value === "restaurant" ? "restaurant" : "dish";
  }

  function syncTypeSelects(fromEl) {
    const v = fromEl.value;
    typeSelects.forEach((o) => {
      if (o !== fromEl) o.value = v;
    });
  }

  function updateSearchPlaceholders() {
    const isRestaurant = getSearchType() === "restaurant";
    const ph = isRestaurant ? "Search restaurants…" : "Search dishes…";
    const label = isRestaurant ? "Search restaurants" : "Search dishes";
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

  function restaurantSearchText(card) {
    const name = (card.dataset.restaurantName || "").toLowerCase();
    const tags = (card.dataset.restaurantTags || "").toLowerCase();
    const title = card.querySelector("h3")?.textContent.trim().toLowerCase() || "";
    const lines = [...card.querySelectorAll("p")]
      .map((p) => p.textContent.trim().toLowerCase())
      .join(" ");
    return `${name} ${tags} ${title} ${lines}`;
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
    const type = getSearchType();
    const headingEl = section.querySelector(".section-heading");

    if (type === "restaurant" && restaurantGrid) {
      if (headingEl) headingEl.textContent = "Restaurants";
      if (menuDashboard) menuDashboard.hidden = true;
      grid.hidden = true;
      if (emptyEl) emptyEl.hidden = true;
      restaurantGrid.hidden = false;

      const q = getSearchQuery();
      const allR = [...restaurantGrid.querySelectorAll(".restaurant-card")];
      let filteredR = q
        ? allR.filter((c) => restaurantSearchText(c).includes(q))
        : [...allR];

      filteredR.forEach((c) => {
        c.hidden = false;
        restaurantGrid.appendChild(c);
      });
      allR.forEach((c) => {
        if (!filteredR.includes(c)) {
          c.hidden = true;
          restaurantGrid.appendChild(c);
        }
      });

      if (restaurantEmpty) restaurantEmpty.hidden = filteredR.length > 0;
      return;
    }

    if (headingEl) headingEl.textContent = "Our Menu";
    if (menuDashboard) menuDashboard.hidden = false;
    grid.hidden = false;
    if (restaurantGrid) restaurantGrid.hidden = true;
    if (restaurantEmpty) restaurantEmpty.hidden = true;

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

initMenuDashboard();

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

// ===== AUTH MODAL (FRONTEND DEMO) =====
const openAuthModalBtn = document.getElementById("open-auth-modal");
const authModal = document.getElementById("auth-modal");
const closeAuthModalBtn = document.getElementById("close-auth-modal");
const authTabs = document.querySelectorAll(".auth-tab");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const authMessage = document.getElementById("auth-message");

function showAuthMessage(message, isSuccess) {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.style.color = isSuccess ? "#42d67f" : "#ff7b7b";
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
  openAuthModalBtn.addEventListener("click", () => {
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
  signupForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = document.getElementById("signup-name")?.value.trim();
    const email = document.getElementById("signup-email")?.value.trim().toLowerCase();
    const password = document.getElementById("signup-password")?.value.trim();

    if (!name || !email || !password) {
      showAuthMessage("Please fill all signup fields.", false);
      return;
    }

    localStorage.setItem(
      "foodieUser",
      JSON.stringify({
        name,
        email,
        password,
      })
    );

    showAuthMessage("Account created! Please login now.", true);
    switchAuthTab("login");
    signupForm.reset();
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = document.getElementById("login-email")?.value.trim().toLowerCase();
    const password = document.getElementById("login-password")?.value.trim();
    const savedUser = localStorage.getItem("foodieUser");

    if (!savedUser) {
      showAuthMessage("No account found. Please create one first.", false);
      return;
    }

    const parsedUser = JSON.parse(savedUser);
    if (parsedUser.email === email && parsedUser.password === password) {
      showAuthMessage(`Welcome back, ${parsedUser.name}!`, true);
      loginForm.reset();
      return;
    }

    showAuthMessage("Invalid email or password.", false);
  });
}
