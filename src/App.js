import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import MasaAsistani from "./MasaAsistani";
import MutfakEkrani from "./MutfakEkrani";
import AdminPaneli from "./AdminPaneli";
import "./index.css";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 text-gray-800 font-sans">
        <header className="text-center py-6 bg-white shadow-md mb-6">
          <h1 className="text-4xl font-bold text-blue-600">🍽️ Neso Asistan</h1>
          <p className="text-sm text-gray-500">Tailwind entegresi tamamlandı</p>
        </header>

        <Routes>
          <Route path="/" element={<Navigate to="/masa/1" replace />} />
          <Route path="/masa/:masaId" element={<MasaAsistani />} />
          <Route path="/mutfak" element={<MutfakEkrani />} />
          <Route path="/admin" element={<AdminPaneli />} />
          <Route
            path="*"
            element={
              <div className="text-center p-10">
                <h2 className="text-2xl text-red-500 font-semibold">
                  Sayfa Bulunamadı
                </h2>
                <p className="text-gray-500 mt-2">
                  Lütfen geçerli bir bağlantı veya QR kod kullanın.
                </p>
              </div>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
