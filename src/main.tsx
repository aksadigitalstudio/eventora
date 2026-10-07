import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { CONFIG } from "./config";
import "./styles.css";
document.title = CONFIG.appName + " · Creative moments, connected";
Object.entries(CONFIG.style).forEach(([k, v]) =>
  document.documentElement.style.setProperty("--" + k, v),
);
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="error-page">
        <h1>Something interrupted this page.</h1>
        <p>Your saved records are safe. Reload to continue.</p>
        <button className="button" onClick={() => location.reload()}>
          Reload page
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
