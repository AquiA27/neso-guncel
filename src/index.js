import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
// AuthProvider'ı AuthContext.js dosyasından import ediyoruz
// Eğer AuthContext.js doğrudan src klasöründeyse bu yol doğrudur.
import { AuthProvider } from "./AuthContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    {/* Uygulamamızı AuthProvider ile sarıyoruz */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)