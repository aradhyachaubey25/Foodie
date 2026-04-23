# Foodie (Customer + Merchant Panel)

Foodie is a Python + SQLite food-ordering project with:

- Customer website at `/`
- Merchant dashboard at `/admin`
- Signup/login, cart, checkout, and order history
- Dynamic menu from database (admin can add/edit/delete items)

---

## Tech Stack

- Backend: Flask (Python)
- Database: SQLite (`foodie.db`)
- Frontend: HTML + CSS + JavaScript

---

## Important Files

- `app.py` - Flask server + all APIs
- `script.js` - customer-side UI logic
- `admin.html` + `admin.js` - merchant dashboard UI
- `style.css` - styles
- `admin_config.json` - merchant credentials
- `requirements.txt` - dependencies

---

## Setup

From project root:

```bash
python -m pip install -r requirements.txt
```

---

## Best Run Command (Recommended)

Use one port only. Best: `8000`.

```bash
cmd /c "set PORT=8000&& python app.py"
```

Open in browser:

- Customer: [http://localhost:8000/](http://localhost:8000/)
- Merchant: [http://localhost:8000/admin](http://localhost:8000/admin)

Do not run `5000` and `8000` together, otherwise confusion ho sakta hai.

---

## Merchant Login Config

Merchant credentials file:

`admin_config.json`

Example:

```json
{
  "name": "Merchant Admin",
  "email": "merchant@foodie.com",
  "password": "12345678"
}
```

After changing credentials, restart server.

---

## Database

SQLite file:

`foodie.db`

Main tables:

- `users`
- `admins`
- `menu_items`
- `cart_items`
- `orders`
- `order_items`

Menu seeding rule:

- Default menu insert only when `menu_items` table is empty.
- If table already has data, app auto-add does not run.

---

## Stop Server

In terminal: `Ctrl + C`

If process is still running on port 8000:

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen | Select-Object -First 1 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```
