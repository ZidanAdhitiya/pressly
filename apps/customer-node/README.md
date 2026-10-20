# Fazima Print Customer Web (Node.js)

This folder is the Node.js migration target for `apps/customer-laravel`. It reuses the customer website's existing static UI and keeps `/api/*` on the same origin. It does not require Laravel or PHP at runtime.

## Run on a Node.js host

- App root: the directory containing `package.json` and `server.js` (upload the *contents* of this folder as the application root).
- Entry file: `server.js`
- Node: 22.13 or newer (choose Node 22 or 24 in hPanel).
- Install command: `npm install`
- Start command: `npm start`
- Build command: `npm run build` (checks the server entry syntax; no compilation is needed).
- Output directory: leave empty; Express serves `public/` directly.
- Database: connect to the existing MySQL database. Do not import a database dump as part of this app.

`server.js` listens on `PORT` (default 3000) and `0.0.0.0`, as required by managed Node hosting. Set the host's environment variables from `.env`; do not put `.env` in a public/static directory.

## Environment

Required for database operations: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD`.

**The Downloads `.env` supplied for this deployment has placeholder values for the database name, user, and password.** `MYSQL_HOST` is set to `localhost` and the port is `3306`, which Hostinger documents for databases used by apps on the same hosting account. Before expecting catalog, orders, or dashboard data to load, replace `MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD` in hPanel's Node environment settings with the values shown under Websites → Dashboard → Databases → Management, then restart the app. The server detects these placeholders and reports `database_configured: false` until they are replaced. [Hostinger MySQL details](https://www.hostinger.com/support/1583552-how-to-find-your-mysql-database-details-in-hostinger)

Optional integrations: `CUSTOMER_ADMIN_API_TOKEN`, `RAJAONGKIR_API_KEY`, `RAJAONGKIR_API_KEY_FALLBACK`, `RAJAONGKIR_ORIGIN_ID`, `SHIPPING_ESTIMATED_WEIGHT_GRAMS`, `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`, `MIDTRANS_FINISH_URL`, `FIREBASE_*`, `GEMINI_API_KEY`, and `CUSTOMER_CONTENT_PATH`.

Prepress runs inside the Node application using Sharp, PDF.js, Canvas, and PDF-Lib. Uploads, previews, output files, and saved dashboard layouts are handled locally by this application; no separate Python worker or prepress URL is required.

The Node `.env` was copied from the Downloads `.env` supplied for this deployment and retains its configured API/admin credentials. It is ignored by Git. `.env.example` lists the variables without credentials. Treat the hosting ZIP as private because it contains those credentials.

## API coverage

The Node server implements every route declared in the Laravel customer `routes/api.php`: catalog and promo reads/writes; product/category administration; hero and category imagery; customer orders and checkout; Midtrans; RajaOngkir; location lookup; chat and chat history; prepress image/PDF layout generation and downloads; dashboard order, notification, and validation workflows; and operator production and material usage. Admin/dashboard/operator routes use the same bearer-token environment variable. Optional services return the same configured/unavailable behavior when their credentials or upstream URLs are empty.

The hosting ZIP contains the contents of this app at its root, including `server.js`, `package.json`, `package-lock.json`, the customer `public/` UI, and the supplied `.env`. It excludes `node_modules` and all database dumps; Hostinger installs dependencies with `npm install` and uses the already existing MySQL database.
