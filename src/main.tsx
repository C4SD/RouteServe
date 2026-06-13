import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import 'maplibre-gl/dist/maplibre-gl.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix malformed Supabase redirect URLs before React Router mounts.
// Supabase sometimes redirects /auth/callback&token_hash=XXX&type=recovery
// (using & instead of ? as the first query separator), which React Router
// can't match. Normalize it to /auth/callback?token_hash=XXX&type=recovery.
(function normalizeCallbackUrl() {
  const path = window.location.pathname;
  if (path.startsWith('/auth/callback&')) {
    const fixed = '/auth/callback?' + path.slice('/auth/callback&'.length) + window.location.hash;
    window.history.replaceState(null, '', fixed);
  }
})();

function renderCrashFallback(error: unknown) {
  const root = document.getElementById("root");
  if (!root) return;
  const msg = error instanceof Error ? error.message : String(error);
  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;font-family:system-ui,sans-serif;padding:24px">
      <div style="max-width:520px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <div style="background:#fef2f2;border-radius:50%;padding:10px;flex-shrink:0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div>
            <h2 style="margin:0;font-size:18px;font-weight:600;color:#0f172a">Application failed to start</h2>
            <p style="margin:4px 0 0;font-size:14px;color:#64748b">A new version may be available. Try reloading.</p>
          </div>
        </div>
        <div style="background:#fef2f2;border-radius:8px;padding:12px;font-family:monospace;font-size:13px;color:#dc2626;word-break:break-word;margin-bottom:20px">${msg}</div>
        <button onclick="sessionStorage.clear();location.reload()" style="width:100%;padding:10px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:500;cursor:pointer">
          Clear cache &amp; reload
        </button>
      </div>
    </div>`;
}

window.addEventListener('unhandledrejection', (e) => {
  const err = e.reason;
  if (
    err instanceof TypeError &&
    typeof err.message === 'string' &&
    err.message.includes('Failed to fetch dynamically imported module')
  ) {
    const countKey = 'chunk_reload_count';
    const timeKey = 'chunk_reload_time';
    const count = parseInt(sessionStorage.getItem(countKey) ?? '0', 10);
    const last = parseInt(sessionStorage.getItem(timeKey) ?? '0', 10);
    const now = Date.now();
    if (count < 3 && now - last > 10_000) {
      sessionStorage.setItem(countKey, String(count + 1));
      sessionStorage.setItem(timeKey, String(now));
      window.location.reload();
    }
  }
});

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (e) {
  renderCrashFallback(e);
}
