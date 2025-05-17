// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, AuthContext } from "./context/AuthContext"; // AuthProvider import edildi
import ProtectedRoute from "./components/ProtectedRoute"; // ProtectedRoute import edildi

import MasaAsistani from "./pages/MasaAsistani";
import MutfakEkrani from "./pages/MutfakEkrani";
import AdminPaneli from "./pages/AdminPaneli";
import MenuGoruntule from "./pages/MenuGoruntule";
import Home from "./pages/Home";
import KasaEkrani from "./pages/KasaEkrani";
import Login from "./pages/Login"; // Login komponenti import edildi
import "./index.css";

// Basit bir Layout componenti (isteğe bağlı, navigasyon vb. için)
const Layout = () => {
  const { isAuthenticated, logout, currentUser } = React.useContext(AuthContext);

  return (
    <div>
      {/* İsteğe bağlı global navigasyon veya header buraya eklenebilir */}
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

// Yetkisiz erişim için basit bir sayfa
const UnauthorizedPage = () => (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Yetkisiz Erişim</h1>
        <p className="text-slate-700 mb-6">Bu sayfayı görüntülemek için yetkiniz bulunmamaktadır.</p>
        <Link to="/" className="text-sky-600 hover:text-sky-700 font-semibold">Ana Sayfaya Dön</Link>
    </div>
);


function App() {
  return (
    <AuthProvider> {/* AuthProvider ile tüm uygulamayı sarmalıyoruz */}
      <Router>
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
                  <div className="bg-white/20 backdrop-blur-xl border border-white/30 p-10 rounded-2xl text-center text-white shadow-2xl max-w-md">
                    <h2 className="text-4xl font-bold animate-bounce mb-4">🚫 404</h2>
                    <h3 className="text-xl font-semibold mb-2">Sayfa Bulunamadı</h3>
                    <p className="opacity-80">
                      Aradığınız sayfa mevcut değil.
                    </p>
                    <Link to="/" className="mt-4 inline-block bg-white text-pink-500 px-4 py-2 rounded-lg font-semibold hover:bg-opacity-90 transition">
                        Ana Sayfaya Dön
                    </Link>
                  </div>
                </div>
              }
            />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;