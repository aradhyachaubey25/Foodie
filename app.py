import json
import os
import sqlite3
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "foodie.db"

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
app.config["SECRET_KEY"] = os.environ.get("FOODIE_SECRET_KEY", "foodie-dev-secret-key")

DEFAULT_MENU_ITEMS = [
    ("burger", "Burger", "Cheesy & crispy.", 249, "non-veg", "image/burger.png"),
    ("pizza", "Pizza", "Loaded with toppings.", 349, "veg", "image/pizza.png"),
    ("sandwich", "Sandwich", "Fresh & tasty.", 179, "veg", "image/sandwich.png"),
    ("chicken-roll", "Chicken Roll", "Spicy & yummy.", 199, "non-veg", "image/chicken-roll.png"),
    ("spaghetti", "Spaghetti", "Italian classic.", 279, "veg", "image/spaghetti.png"),
    ("spring-roll", "Spring Roll", "Crispy bite.", 149, "veg", "image/spring-roll.png"),
    ("fried-chicken", "Fried Chicken", "Crispy outside, juicy inside.", 299, "non-veg", "image/fried-chicken.png"),
    ("lasagna", "Lasagna", "Rich layered Italian bake.", 329, "veg", "image/lasagna.png"),
    ("margherita-pizza", "Margherita Pizza", "Classic cheese and basil.", 319, "veg", "image/pizza.png"),
    ("veg-delight-sandwich", "Veg Delight Sandwich", "Loaded with fresh veggies.", 189, "veg", "image/sandwich.png"),
    ("paneer-wrap", "Paneer Wrap", "Smoky paneer with creamy sauce.", 229, "veg", "image/chicken-roll.png"),
    ("chicken-loaded-burger", "Chicken Loaded Burger", "Double patty, extra cheese.", 289, "non-veg", "image/burger.png"),
    ("chicken-spaghetti", "Chicken Spaghetti", "Herbed chicken in red sauce.", 339, "non-veg", "image/spaghetti.png"),
    ("cheese-spring-roll", "Cheese Spring Roll", "Crispy rolls with cheesy filling.", 169, "veg", "image/spring-roll.png"),
    ("tandoori-chicken-roll", "Tandoori Chicken Roll", "Spicy tandoori flavor blast.", 249, "non-veg", "image/chicken-roll.png"),
    ("classic-veggie-pizza", "Classic Veggie Pizza", "Bell peppers, olives and corn.", 329, "veg", "image/pizza.png"),
]


def load_admin_config():
    config_path = BASE_DIR / "admin_config.json"
    default_config = {
        "name": os.environ.get("FOODIE_ADMIN_NAME", "Merchant Admin"),
        "email": os.environ.get("FOODIE_ADMIN_EMAIL", "merchant@foodie.com").strip().lower(),
        "password": os.environ.get("FOODIE_ADMIN_PASSWORD", "admin123"),
    }
    if not config_path.exists():
        return default_config

    try:
        with config_path.open("r", encoding="utf-8") as handle:
            raw = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return default_config

    name = str(raw.get("name", default_config["name"])).strip() or default_config["name"]
    email = str(raw.get("email", default_config["email"])).strip().lower() or default_config["email"]
    password = str(raw.get("password", default_config["password"])).strip() or default_config["password"]
    return {"name": name, "email": email, "password": password}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def rows_to_cart(rows):
    return [
        {"id": row["item_id"], "name": row["item_name"], "price": float(row["item_price"]), "qty": int(row["qty"])}
        for row in rows
    ]


def require_login():
    user_id = session.get("user_id")
    if not user_id:
        return None, (jsonify({"message": "Please login first."}), 401)
    return user_id, None


def require_admin():
    admin_id = session.get("admin_id")
    if not admin_id:
        return None, (jsonify({"message": "Admin login required."}), 401)
    return admin_id, None


def get_user_cart(user_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT item_id, item_name, item_price, qty FROM cart_items WHERE user_id = ? ORDER BY id ASC",
        (user_id,),
    ).fetchall()
    conn.close()
    return rows_to_cart(rows)


def init_db():
    conn = get_db()
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS menu_items (item_id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, price REAL NOT NULL, type TEXT NOT NULL CHECK(type IN ('veg','non-veg')), image TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cart_items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, item_id TEXT NOT NULL, item_name TEXT NOT NULL, item_price REAL NOT NULL, qty INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, item_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, total_amount REAL NOT NULL, total_items INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'placed', created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, item_id TEXT NOT NULL, item_name TEXT NOT NULL, item_price REAL NOT NULL, qty INTEGER NOT NULL, line_total REAL NOT NULL, FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE)"
    )

    menu_count = conn.execute("SELECT COUNT(*) AS c FROM menu_items").fetchone()["c"]
    if menu_count == 0:
        conn.executemany(
            "INSERT INTO menu_items (item_id, name, description, price, type, image) VALUES (?, ?, ?, ?, ?, ?)",
            DEFAULT_MENU_ITEMS,
        )

    admin_config = load_admin_config()
    existing_admin = conn.execute("SELECT id FROM admins WHERE email = ?", (admin_config["email"],)).fetchone()
    if existing_admin:
        conn.execute(
            "UPDATE admins SET name = ?, password_hash = ? WHERE id = ?",
            (admin_config["name"], generate_password_hash(admin_config["password"]), existing_admin["id"]),
        )
    else:
        conn.execute(
            "INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)",
            (admin_config["name"], admin_config["email"], generate_password_hash(admin_config["password"])),
        )

    conn.commit()
    conn.close()


@app.route("/api/signup", methods=["POST"])
def signup():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", "")).strip()

    if not name or not email or not password:
        return jsonify({"message": "All signup fields are required."}), 400
    if len(password) < 6:
        return jsonify({"message": "Password must be at least 6 characters."}), 400

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({"message": "Email already registered. Please login."}), 409

    conn.execute(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
        (name, email, generate_password_hash(password)),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Signup successful."}), 201


@app.route("/api/login", methods=["POST"])
def login():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", "")).strip()

    if not email or not password:
        return jsonify({"message": "Email and password are required."}), 400

    conn = get_db()
    user = conn.execute(
        "SELECT id, name, email, password_hash FROM users WHERE email = ?",
        (email,),
    ).fetchone()
    conn.close()

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"message": "Invalid email or password."}), 401

    session["user_id"] = user["id"]
    return jsonify(
        {
            "message": "Login successful.",
            "user": {"id": user["id"], "name": user["name"], "email": user["email"]},
        }
    )


@app.route("/api/logout", methods=["POST"])
def logout():
    session.pop("user_id", None)
    return jsonify({"message": "Logged out."})


@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", "")).strip()
    if not email or not password:
        return jsonify({"message": "Email and password are required."}), 400
    conn = get_db()
    admin = conn.execute("SELECT id, name, email, password_hash FROM admins WHERE email = ?", (email,)).fetchone()
    conn.close()
    if not admin or not check_password_hash(admin["password_hash"], password):
        return jsonify({"message": "Invalid admin credentials."}), 401
    session["admin_id"] = admin["id"]
    return jsonify({"admin": {"id": admin["id"], "name": admin["name"], "email": admin["email"]}})


@app.route("/api/admin/logout", methods=["POST"])
def admin_logout():
    session.pop("admin_id", None)
    return jsonify({"message": "Admin logged out."})


@app.route("/api/admin/me", methods=["GET"])
def admin_me():
    admin_id, error = require_admin()
    if error:
        return error
    conn = get_db()
    admin = conn.execute("SELECT id, name, email FROM admins WHERE id = ?", (admin_id,)).fetchone()
    conn.close()
    if not admin:
        session.pop("admin_id", None)
        return jsonify({"message": "Session expired."}), 401
    return jsonify({"admin": {"id": admin["id"], "name": admin["name"], "email": admin["email"]}})


@app.route("/api/me", methods=["GET"])
def me():
    user_id, error = require_login()
    if error:
        return error

    conn = get_db()
    user = conn.execute(
        "SELECT id, name, email FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    conn.close()

    if not user:
        session.pop("user_id", None)
        return jsonify({"message": "Session expired."}), 401

    return jsonify({"user": {"id": user["id"], "name": user["name"], "email": user["email"]}})


@app.route("/api/menu", methods=["GET"])
def get_menu():
    conn = get_db()
    rows = conn.execute(
        "SELECT item_id, name, description, price, type, image FROM menu_items ORDER BY name COLLATE NOCASE ASC"
    ).fetchall()
    conn.close()
    return jsonify(
        {
            "menu": [
                {
                    "id": row["item_id"],
                    "name": row["name"],
                    "description": row["description"],
                    "price": float(row["price"]),
                    "type": row["type"],
                    "image": row["image"],
                }
                for row in rows
            ]
        }
    )


@app.route("/api/cart", methods=["GET"])
def get_cart():
    user_id, error = require_login()
    if error:
        return error
    return jsonify({"cart": get_user_cart(user_id)})


@app.route("/api/cart/add", methods=["POST"])
def cart_add():
    user_id, error = require_login()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    item_id = str(payload.get("item_id", "")).strip()
    item_name = str(payload.get("item_name", "")).strip()
    item_price = payload.get("item_price")
    qty = int(payload.get("qty", 1) or 1)

    if not item_id or not item_name or item_price is None:
        return jsonify({"message": "Invalid cart item payload."}), 400

    conn = get_db()
    menu_row = conn.execute("SELECT name, price FROM menu_items WHERE item_id = ?", (item_id,)).fetchone()
    if menu_row:
        item_name = menu_row["name"]
        price_val = float(menu_row["price"])
    else:
        try:
            price_val = float(item_price)
        except (TypeError, ValueError):
            conn.close()
            return jsonify({"message": "Item price must be numeric."}), 400

    qty = max(1, qty)
    row = conn.execute(
        "SELECT qty FROM cart_items WHERE user_id = ? AND item_id = ?",
        (user_id, item_id),
    ).fetchone()
    if row:
        conn.execute(
            "UPDATE cart_items SET qty = qty + ?, item_name = ?, item_price = ? WHERE user_id = ? AND item_id = ?",
            (qty, item_name, price_val, user_id, item_id),
        )
    else:
        conn.execute(
            """
            INSERT INTO cart_items (user_id, item_id, item_name, item_price, qty)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, item_id, item_name, price_val, qty),
        )
    conn.commit()
    conn.close()
    return jsonify({"cart": get_user_cart(user_id)})


@app.route("/api/cart/update", methods=["POST"])
def cart_update():
    user_id, error = require_login()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    item_id = str(payload.get("item_id", "")).strip()
    qty = int(payload.get("qty", 0) or 0)
    if not item_id:
        return jsonify({"message": "item_id is required."}), 400

    conn = get_db()
    if qty <= 0:
        conn.execute("DELETE FROM cart_items WHERE user_id = ? AND item_id = ?", (user_id, item_id))
    else:
        conn.execute(
            "UPDATE cart_items SET qty = ? WHERE user_id = ? AND item_id = ?",
            (qty, user_id, item_id),
        )
    conn.commit()
    conn.close()
    return jsonify({"cart": get_user_cart(user_id)})


@app.route("/api/cart/remove", methods=["POST"])
def cart_remove():
    user_id, error = require_login()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    item_id = str(payload.get("item_id", "")).strip()
    if not item_id:
        return jsonify({"message": "item_id is required."}), 400

    conn = get_db()
    conn.execute("DELETE FROM cart_items WHERE user_id = ? AND item_id = ?", (user_id, item_id))
    conn.commit()
    conn.close()
    return jsonify({"cart": get_user_cart(user_id)})


@app.route("/api/cart/clear", methods=["POST"])
def cart_clear():
    user_id, error = require_login()
    if error:
        return error
    conn = get_db()
    conn.execute("DELETE FROM cart_items WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"cart": []})


@app.route("/api/orders", methods=["GET"])
def orders():
    user_id, error = require_login()
    if error:
        return error

    conn = get_db()
    order_rows = conn.execute(
        """
        SELECT id, total_amount, total_items, status, created_at
        FROM orders
        WHERE user_id = ?
        ORDER BY id DESC
        """,
        (user_id,),
    ).fetchall()

    order_list = []
    for order_row in order_rows:
        item_rows = conn.execute(
            """
            SELECT item_id, item_name, item_price, qty, line_total
            FROM order_items
            WHERE order_id = ?
            ORDER BY id ASC
            """,
            (order_row["id"],),
        ).fetchall()
        order_list.append(
            {
                "id": order_row["id"],
                "total_amount": float(order_row["total_amount"]),
                "total_items": int(order_row["total_items"]),
                "status": order_row["status"],
                "created_at": order_row["created_at"],
                "items": [
                    {
                        "id": item_row["item_id"],
                        "name": item_row["item_name"],
                        "price": float(item_row["item_price"]),
                        "qty": int(item_row["qty"]),
                        "line_total": float(item_row["line_total"]),
                    }
                    for item_row in item_rows
                ],
            }
        )

    conn.close()
    return jsonify({"orders": order_list})


@app.route("/api/admin/stats", methods=["GET"])
def admin_stats():
    _, error = require_admin()
    if error:
        return error
    conn = get_db()
    total_customers = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
    total_orders = conn.execute("SELECT COUNT(*) AS c FROM orders").fetchone()["c"]
    total_menu_items = conn.execute("SELECT COUNT(*) AS c FROM menu_items").fetchone()["c"]
    revenue = conn.execute("SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders").fetchone()["total"]
    conn.close()
    return jsonify(
        {
            "stats": {
                "customers": int(total_customers),
                "orders": int(total_orders),
                "menu_items": int(total_menu_items),
                "revenue": float(revenue or 0),
            }
        }
    )


@app.route("/api/admin/customers", methods=["GET"])
def admin_customers():
    _, error = require_admin()
    if error:
        return error
    conn = get_db()
    rows = conn.execute(
        """
        SELECT u.id, u.name, u.email, u.created_at,
               COUNT(DISTINCT o.id) AS orders_count,
               COALESCE(SUM(o.total_amount), 0) AS total_spent
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id
        GROUP BY u.id
        ORDER BY u.id DESC
        """
    ).fetchall()
    conn.close()
    return jsonify(
        {
            "customers": [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "email": row["email"],
                    "created_at": row["created_at"],
                    "orders_count": int(row["orders_count"]),
                    "total_spent": float(row["total_spent"] or 0),
                }
                for row in rows
            ]
        }
    )


@app.route("/api/admin/customers/<int:user_id>", methods=["PUT"])
def admin_update_customer(user_id):
    _, error = require_admin()
    if error:
        return error
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    email = str(payload.get("email", "")).strip().lower()
    if not name or not email:
        return jsonify({"message": "Name and email are required."}), 400
    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ? AND id != ?", (email, user_id)).fetchone()
    if existing:
        conn.close()
        return jsonify({"message": "Email already used by another customer."}), 409
    updated = conn.execute("UPDATE users SET name = ?, email = ? WHERE id = ?", (name, email, user_id))
    conn.commit()
    conn.close()
    if updated.rowcount == 0:
        return jsonify({"message": "Customer not found."}), 404
    return jsonify({"message": "Customer updated."})


@app.route("/api/admin/customers/<int:user_id>", methods=["DELETE"])
def admin_delete_customer(user_id):
    _, error = require_admin()
    if error:
        return error
    conn = get_db()
    deleted = conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    if deleted.rowcount == 0:
        return jsonify({"message": "Customer not found."}), 404
    return jsonify({"message": "Customer deleted."})


@app.route("/api/admin/menu", methods=["GET"])
def admin_menu_list():
    _, error = require_admin()
    if error:
        return error
    return get_menu()


@app.route("/api/admin/menu", methods=["POST"])
def admin_menu_create():
    _, error = require_admin()
    if error:
        return error
    payload = request.get_json(silent=True) or {}
    item_id = str(payload.get("id", "")).strip().lower()
    name = str(payload.get("name", "")).strip()
    description = str(payload.get("description", "")).strip()
    item_type = str(payload.get("type", "")).strip().lower()
    image = str(payload.get("image", "")).strip() or "image/burger.png"
    try:
        price = float(payload.get("price"))
    except (TypeError, ValueError):
        return jsonify({"message": "Price must be numeric."}), 400
    if not item_id or not name or not description or item_type not in {"veg", "non-veg"}:
        return jsonify({"message": "Invalid menu item fields."}), 400
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO menu_items (item_id, name, description, price, type, image) VALUES (?, ?, ?, ?, ?, ?)",
            (item_id, name, description, price, item_type, image),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"message": "Item id already exists."}), 409
    conn.close()
    return jsonify({"message": "Menu item created."}), 201


@app.route("/api/admin/menu/<string:item_id>", methods=["PUT"])
def admin_menu_update(item_id):
    _, error = require_admin()
    if error:
        return error
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    description = str(payload.get("description", "")).strip()
    item_type = str(payload.get("type", "")).strip().lower()
    image = str(payload.get("image", "")).strip() or "image/burger.png"
    try:
        price = float(payload.get("price"))
    except (TypeError, ValueError):
        return jsonify({"message": "Price must be numeric."}), 400
    if not name or not description or item_type not in {"veg", "non-veg"}:
        return jsonify({"message": "Invalid menu item fields."}), 400
    conn = get_db()
    updated = conn.execute(
        "UPDATE menu_items SET name = ?, description = ?, price = ?, type = ?, image = ?, updated_at = CURRENT_TIMESTAMP WHERE item_id = ?",
        (name, description, price, item_type, image, item_id),
    )
    conn.execute(
        "UPDATE cart_items SET item_name = ?, item_price = ? WHERE item_id = ?",
        (name, price, item_id),
    )
    conn.commit()
    conn.close()
    if updated.rowcount == 0:
        return jsonify({"message": "Menu item not found."}), 404
    return jsonify({"message": "Menu item updated."})


@app.route("/api/admin/menu/<string:item_id>", methods=["DELETE"])
def admin_menu_delete(item_id):
    _, error = require_admin()
    if error:
        return error
    conn = get_db()
    conn.execute("DELETE FROM cart_items WHERE item_id = ?", (item_id,))
    conn.execute("DELETE FROM order_items WHERE item_id = ?", (item_id,))
    deleted = conn.execute("DELETE FROM menu_items WHERE item_id = ?", (item_id,))
    conn.commit()
    conn.close()
    if deleted.rowcount == 0:
        return jsonify({"message": "Menu item not found."}), 404
    return jsonify({"message": "Menu item deleted."})


@app.route("/api/admin/orders", methods=["GET"])
def admin_orders():
    _, error = require_admin()
    if error:
        return error
    conn = get_db()
    rows = conn.execute(
        """
        SELECT o.id, o.total_amount, o.total_items, o.status, o.created_at, u.name AS customer_name, u.email AS customer_email
        FROM orders o
        JOIN users u ON u.id = o.user_id
        ORDER BY o.id DESC
        """
    ).fetchall()
    conn.close()
    return jsonify(
        {
            "orders": [
                {
                    "id": row["id"],
                    "customer_name": row["customer_name"],
                    "customer_email": row["customer_email"],
                    "total_amount": float(row["total_amount"]),
                    "total_items": int(row["total_items"]),
                    "status": row["status"],
                    "created_at": row["created_at"],
                }
                for row in rows
            ]
        }
    )


@app.route("/api/admin/orders/<int:order_id>", methods=["PUT"])
def admin_update_order(order_id):
    _, error = require_admin()
    if error:
        return error
    payload = request.get_json(silent=True) or {}
    status = str(payload.get("status", "")).strip().lower()
    allowed_statuses = {"placed", "confirmed", "preparing", "dispatched", "delivered", "cancelled"}
    if status not in allowed_statuses:
        return jsonify({"message": "Invalid order status."}), 400
    conn = get_db()
    updated = conn.execute("UPDATE orders SET status = ? WHERE id = ?", (status, order_id))
    conn.commit()
    conn.close()
    if updated.rowcount == 0:
        return jsonify({"message": "Order not found."}), 404
    return jsonify({"message": "Order status updated."})


@app.route("/api/admin/orders/<int:order_id>", methods=["DELETE"])
def admin_delete_order(order_id):
    _, error = require_admin()
    if error:
        return error
    conn = get_db()
    conn.execute("DELETE FROM order_items WHERE order_id = ?", (order_id,))
    deleted = conn.execute("DELETE FROM orders WHERE id = ?", (order_id,))
    conn.commit()
    conn.close()
    if deleted.rowcount == 0:
        return jsonify({"message": "Order not found."}), 404
    return jsonify({"message": "Order deleted."})


@app.route("/api/checkout", methods=["POST"])
def checkout():
    user_id, error = require_login()
    if error:
        return error

    conn = get_db()
    cart_rows = conn.execute(
        """
        SELECT item_id, item_name, item_price, qty
        FROM cart_items
        WHERE user_id = ?
        ORDER BY id ASC
        """,
        (user_id,),
    ).fetchall()

    if not cart_rows:
        conn.close()
        return jsonify({"message": "Cart is empty."}), 400

    total_amount = sum(float(row["item_price"]) * int(row["qty"]) for row in cart_rows)
    total_items = sum(int(row["qty"]) for row in cart_rows)

    cursor = conn.execute(
        """
        INSERT INTO orders (user_id, total_amount, total_items, status)
        VALUES (?, ?, ?, 'placed')
        """,
        (user_id, total_amount, total_items),
    )
    order_id = cursor.lastrowid

    for row in cart_rows:
        qty = int(row["qty"])
        price = float(row["item_price"])
        conn.execute(
            """
            INSERT INTO order_items (order_id, item_id, item_name, item_price, qty, line_total)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (order_id, row["item_id"], row["item_name"], price, qty, price * qty),
        )

    conn.execute("DELETE FROM cart_items WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()

    return jsonify(
        {
            "message": "Order placed successfully.",
            "order": {
                "id": order_id,
                "status": "placed",
                "total_amount": round(total_amount, 2),
                "total_items": total_items,
            },
            "cart": [],
        }
    )


@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/admin")
def admin_page():
    return send_from_directory(BASE_DIR, "admin.html")


@app.route("/<path:path>")
def static_files(path):
    file_path = BASE_DIR / path
    if file_path.exists() and file_path.is_file():
        return send_from_directory(BASE_DIR, path)
    return send_from_directory(BASE_DIR, "index.html")


if __name__ == "__main__":
    init_db()
    app_port = int(os.environ.get("PORT", "5000"))
    app.run(host="127.0.0.1", port=app_port, debug=True)
