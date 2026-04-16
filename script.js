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

// ===== ADD TO CART BADGE =====
let cartCount = 0;
const addButtons = document.querySelectorAll(".add-btn");
const cartIcon = document.querySelector(".cart-icon");

if (cartIcon) {
  const badge = document.createElement("span");
  badge.classList.add("badge");
  badge.textContent = "0";
  cartIcon.appendChild(badge);

  addButtons.forEach((button) => {
    button.addEventListener("click", () => {
      cartCount += 1;
      badge.textContent = cartCount;
    });
  });
}

// ===== SMOOTH SCROLL =====
document.querySelectorAll("a[href^='#']").forEach((link) => {
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
