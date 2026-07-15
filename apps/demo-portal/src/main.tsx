import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TravelPortal } from "./travel-portal.js";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Demo portal root element was not found.");
}

createRoot(root).render(
  <StrictMode>
    <TravelPortal />
  </StrictMode>,
);
