import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MasaAsistani from "./MasaAsistani";
import MutfakEkrani from "./MutfakEkrani";
import AdminPaneli from "./pages/AdminMenu";
import MenuGoruntule from "./MenuGoruntule";
import Home from "./Home";
import "./index.css";

function App() {
  return (
    <Router>
      <Routes>
        {/* Ana sayfa: kullanıcıya seçenek sunar */}
        <Route path="/" element={<Home />} />

        {/* Masa ekranı */}
        <Route path="/masa/:masaId" element={<MasaAsistani />} />

        {/* Menü ekranı (görüntüleme) */}
        <Route path="/menu" element={<MenuGoruntule />} />

        {/* Mutfak ekranı */}
        <Route path="/mutfak" element={<MutfakEkrani />} />

        {/* Admin ekranı */}
        <Route path="/admin" element={<AdminMenu />} />

        {/* 404 sayfa bulunamadı */}
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-gradient-to-br from-red-500 via-pink-500 to-yellow-500 flex items-center justify-center px-4">
              <div className="bg-white/20 backdrop-blur-xl border border-white/30 p-10 rounded-2xl text-center text-white shadow-2xl max-w-md">
                <h2 className="text-4xl font-bold animate-bounce mb-4">🚫 404</h2>
                <h3 className="text-xl font-semibold mb-2">Sayfa Bulunamadı</h3>
                <p className="opacity-80">
                  Geçersiz bir bağlantı ya da QR kod kullanılmış olabilir.
                </p>
              </div>
            </div>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
