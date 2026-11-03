import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Prevent external browser extension errors/timeouts from breaking the application or triggering overlays
if (typeof window !== "undefined") {
  window.addEventListener(
    "error",
    (event) => {
      const filename = event.filename || "";
      const message = String(event.message || "");
      if (
        filename.includes("chrome-extension://") ||
        filename.includes("moz-extension://") ||
        filename.includes("safari-extension://") ||
        message.includes("chrome: call method") ||
        message.includes("Extension context invalidated") ||
        message.includes("ResizeObserver loop")
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
    },
    true
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      const reason = event.reason;
      const message = String(reason?.message || reason || "");
      const stack = String(reason?.stack || "");
      if (
        stack.includes("chrome-extension://") ||
        stack.includes("moz-extension://") ||
        stack.includes("safari-extension://") ||
        message.includes("chrome: call method") ||
        message.includes("Extension context invalidated") ||
        message.includes("ResizeObserver loop")
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true
  );
}

createRoot(document.getElementById("root")!).render(<App />);
