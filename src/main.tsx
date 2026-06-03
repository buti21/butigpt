import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// --- Cleanup: old PWA service worker had scope "/butigpt/" which is now
// serving stale/broken assets in production. Always unregister any SW and
// clear caches so the app loads fresh, then redirect off the old path.
const cleanup = async () => {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
};

// Fire-and-forget cleanup
cleanup();

// If a user lands on the legacy /butigpt/* path (old SW scope), bounce them
// to the real root so SPA routing works.
if (window.location.pathname.startsWith("/butigpt")) {
  const newPath =
    window.location.pathname.replace(/^\/butigpt\/?/, "/") +
    window.location.search +
    window.location.hash;
  window.history.replaceState(null, "", newPath);
}

createRoot(document.getElementById("root")!).render(<App />);
