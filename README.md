CADApp Viewer — reorganized

Overview
- A compact 3D CAD artifact viewer using Three.js. Project converted from a single `index.html` into a small web-app layout.

Quick start
1. Install a simple static server (we use `http-server` via npx):

```powershell
npm install
npm run start
# then open http://localhost:3000 in your browser
```

Files of interest
- `index.html` — minimal shell that loads CSS and JS
- `styles/styles.css` — extracted styles
- `src/js/app.js` — main application logic (Three.js, loaders, UI handlers)

Notes
- Three.js and loaders are loaded from CDN in `index.html` for simplicity.
- If you prefer a build system (Vite/Parcel/webpack), I can scaffold it next.
