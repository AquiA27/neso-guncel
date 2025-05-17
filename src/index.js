// Düzeltilmiş src/index.js yapısı
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom"; // BrowserRouter'ı import edin
import App from "./App";
import "./index.css";
import { AuthProvider } from "./AuthContext"; // AuthContext'i import edin

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter> {/* BrowserRouter en dışta (veya üste yakın) olmalı */}
      <AuthProvider> {/* AuthProvider, BrowserRouter'ın içinde olmalı */}
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);