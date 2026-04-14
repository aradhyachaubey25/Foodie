// ===== MOBILE MENU TOGGLE =====
const menuToggle = document.getElementById("menu-toggle");
const mobileMenu = document.querySelector(".mobile-menu");

menuToggle.addEventListener("change", () => {
  mobileMenu.style.display = menuToggle.checked ? "block" : "none";
});

// ===== ADD TO CART BADGE =====
let cartCount = 0;
const addButtons = document.querySelectorAll(".add-btn");
const cartIcon = document.querySelector(".cart-icon");

const badge = document.createElement("span");
badge.classList.add("badge");
badge.textContent = "0";
cartIcon.appendChild(badge);

addButtons.forEach((button) => {
  button.addEventListener("click", () => {
    cartCount++;
    badge.textContent = cartCount;
  });
});

// ===== SMOOTH SCROLL =====
document.querySelectorAll("a[href^='#']").forEach((link) => {
  link.addEventListener("click", function (e) {
    const targetID = this.getAttribute("href");

    if (targetID === "#" || targetID === "") return;

    e.preventDefault();

    const target = document.querySelector(targetID);

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    if (window.innerWidth <= 768) {
      menuToggle.checked = false;
      mobileMenu.style.display = "none";
    }
  });
});     