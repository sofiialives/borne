import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.js";
import { FournisseurAuth } from "./hooks/useAuth.js";
import "./styles/theme.css";

ReactDOM.createRoot(document.getElementById("racine")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <FournisseurAuth>
        <App />
      </FournisseurAuth>
    </BrowserRouter>
  </React.StrictMode>
);
