// src/App.js
import React from "react";
// BrowserRouter as Router'ı buradan kaldırıyoruz.
import { Routes, Route, Outlet, Link } from "react-router-dom"; // Navigate'i kullanmıyorsanız kaldırabilirsiniz.
// AuthProvider'ı buradan kaldırıyoruz, AuthContext kalabilir çünkü Layout kullanıyor.
import { AuthContext } from "./AuthContext";
import ProtectedRoute from "./components/ProtectedRoute"; // Yolunu bir önceki adıma göre düzeltmiştiniz, doğru olduğunu varsayıyorum.

import MasaAsistani from "./pages/MasaAsistani";
import MutfakEkrani from "./pages/MutfakEkrani";
import AdminPaneli from "./pages/AdminPaneli";
import MenuGoruntule from "./pages/MenuGoruntule";
import Home from "./pages/Home";
import KasaEkrani from "./pages/KasaEkrani";
import Login from "./pages/Login";
import "./index.css";

// Layout componentiniz aynı kalabilir, AuthContext'i index.js'deki AuthProvider'dan alacaktır.
const Layout = () => {
  const { isAuthenticated, logout, currentUser } = React.useContext(AuthContext);

  return (
    <div>
      {isAuthenticated && (
        <header className="bg-slate-800 text-white p-3 flex justify-between items-center">
          <span>Hoş geldiniz, {currentUser?.kullanici_adi || 'Kullanıcı'} ({currentUser?.rol})</span>
          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
          >
            Çıkış Yap
          </button>
        </header>
      )}
      <main>
        <Outlet /> {/* Route'ların render edileceği yer */}
      </main>
    </div>
  );
};

// UnauthorizedPage componentiniz aynı kalabilir
const UnauthorizedPage = () => (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Yetkisiz Erişim</h1>
        <p className="text-slate-700 mb-6">Bu sayfayı görüntülemek için yetkiniz bulunmamaktadır.</p>
        <Link to="/" className="text-sky-600 hover:text-sky-700 font-semibold">Ana Sayfaya Dön</Link>
    </div>
);


function App() {
  return (
    // AuthProvider ve Router sarmalayıcılarını buradan kaldırıyoruz.
    // Doğrudan Routes ile başlıyoruz.
    <Routes>
      <Route element={<Layout />}> {/* Layout tüm sayfalara uygulanabilir */}
        {/* Herkesin erişebileceği yollar */}
        <Route path="/" element={<Home />} />
        <Route path="/masa/:masaId" element={<MasaAsistani />} />
        <Route path="/menu" element={<MenuGoruntule />} />
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Korumalı Yollar */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminPaneli />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mutfak"
          element={
            <ProtectedRoute allowedRoles={['admin', 'mutfak_personeli', 'barista']}>
              <MutfakEkrani />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kasa"
          element={
            <ProtectedRoute allowedRoles={['admin', 'kasiyer']}>
              <KasaEkrani />
            </ProtectedRoute>
          }
        />

        {/* 404 - Sayfa bulunamadı */}
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-gradient-to-br from-red-500 via-pink-500 to-yellow-500 flex items-center justify-center px-4">
              {/* ... 404 içeriği ... */}
              <Link to="/" className="mt-4 inline-block bg-white text-pink-500 px-4 py-2 rounded-lg font-semibold hover:bg-opacity-90 transition">
                Ana Sayfaya Dön
              </Link>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;