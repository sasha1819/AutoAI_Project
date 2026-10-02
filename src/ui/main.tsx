import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./design-system/tokens/theme.css";
import { App } from "./app/App.tsx";

// The renderer's entry (ADR 0007): the React app that the Electron window loads.
const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
