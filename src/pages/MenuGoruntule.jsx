import React, { useEffect, useState } from "react";
import axios from "axios";
import { BookOpenText, Loader2, SearchX, ListFilter, FilterX } from "lucide-react"; // EKLENDİ

const API_BASE = process.env.REACT_APP_API_BASE;

function MenuGoruntule() {
  const [menu, setMenu] = useState([]);
  const [aktifKategori, setAktifKategori] = useState(null);
  const [loading, setLoading] = useState(true);
  // Öneri: Kullanıcıya hata göstermek için bir error state eklenebilir.
  // const [error, setError] = useState(null);

  useEffect(() => {
    document.title = "Menü - Neso";
  }, []);

  useEffect(() => {
    axios
      .get(`${API_BASE}/menu`)
      .then((res) => {
        if (Array.isArray(res.data.menu)) {
          const duzMenu = res.data.menu.flatMap((k) =>
            k.urunler.map((u) => ({
              id: `${k.kategori}-${u.ad}-${u.fiyat}`, // Daha güvenilir bir key için ID oluşturma
              urun: u.ad,
              fiyat: u.fiyat,
              kategori: k.kategori,
              // Öneri: Ürün görselleri varsa burada eklenebilir: gorsel: u.gorsel_url
            }))
          );
          setMenu(duzMenu);
        } else {
          console.error("Beklenmeyen menü formatı:", res.data);
          // setError("Menü formatı hatalı."); // Öneri
        }
      })
      .catch((err) => {
        console.error("Menü verisi alınamadı:", err);
        // setError("Menü verileri yüklenirken bir sorun oluştu."); // Öneri
      })
      .finally(() => setLoading(false));
  }, []);

  const kategoriler = [...new Set(menu.map((item) => item.kategori))].sort(); // Kategorileri sırala

  const filtreliMenu = aktifKategori
    ? menu.filter((item) => item.kategori === aktifKategori)
    : menu;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-800 text-white p-4 md:p-8 font-sans">
      <header className="text-center mb-10 md:mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 flex items-center justify-center">
          <BookOpenText className="w-10 h-10 md:w-12 md:h-12 mr-3 text-purple-400" /> Neso Menü
        </h1>
        <p className="text-slate-400 mt-2 text-sm md:text-base">Lezzetlerimizi Keşfedin</p>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-slate-300">
          <Loader2 className="w-16 h-16 animate-spin mb-5 text-purple-400" />
          <p className="text-xl font-medium">Menü Yükleniyor...</p>
          <p className="text-sm text-slate-500">Lütfen bekleyiniz.</p>
        </div>
      ) : (
        <>
          {/* Hata Durumu Önerisi
          {error && !loading && (
            <div className="text-center py-10 px-4 bg-red-900/30 rounded-lg shadow-xl border border-red-700">
              <XCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
              <p className="text-xl text-red-300 font-semibold">Bir Hata Oluştu</p>
              <p className="text-red-400 mt-1">{error}</p>
              <button
                onClick={() => window.location.reload()} // veya fetchMenu() gibi bir fonksiyon
                className="mt-6 bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
              >
                Tekrar Dene
              </button>
            </div>
          )}
          */}

          {/* {!error && ( ... remaining content ... ) } */}
          <div className="sticky top-4 z-10 mb-8 md:mb-10 py-3 bg-slate-900/70 backdrop-blur-md rounded-xl shadow-lg">
            <div className="flex flex-wrap gap-2.5 sm:gap-3 justify-center px-3">
              <button
                onClick={() => setAktifKategori(null)}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ease-in-out flex items-center gap-2 shadow-md hover:shadow-lg
                  ${
                    aktifKategori === null
                      ? "bg-purple-500 text-white ring-2 ring-purple-300"
                      : "bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600"
                  }`}
              >
                {aktifKategori === null ? <FilterX className="w-4 h-4" /> : <ListFilter className="w-4 h-4" />}
                Tümü
              </button>
              {kategoriler.map((kategori) => (
                <button
                  key={kategori}
                  onClick={() => setAktifKategori(kategori)}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ease-in-out shadow-md hover:shadow-lg
                    ${
                      aktifKategori === kategori
                        ? "bg-pink-500 text-white ring-2 ring-pink-300"
                        : "bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600"
                    }`}
                >
                  {kategori}
                </button>
              ))}
            </div>
          </div>

          {filtreliMenu.length === 0 && !loading && ( // !loading kontrolü eklendi
            <div className="text-center py-12 md:py-16 px-4 col-span-full min-h-[30vh] flex flex-col justify-center items-center">
              <SearchX className="w-20 h-20 md:w-28 md:h-28 mx-auto text-slate-600 mb-5" />
              <p className="text-xl md:text-2xl text-slate-400 font-semibold">
                {aktifKategori ? `"${aktifKategori}" kategorisinde ürün bulunamadı.` : "Menüde hiç ürün bulunmuyor."}
              </p>
              <p className="text-slate-500 mt-2 text-sm md:text-base">
                Lütfen başka bir kategoriye göz atın veya daha sonra tekrar kontrol edin.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6">
            {filtreliMenu.map((item) => (
              <div
                key={item.id} // Oluşturulan id'yi kullan
                className="bg-slate-800/70 backdrop-blur-lg p-5 rounded-xl shadow-xl border border-slate-700/80 
                           hover:border-purple-500/70 hover:shadow-purple-500/20 transition-all duration-300 ease-in-out group
                           transform hover:-translate-y-1"
              >
                {/* Öneri: Ürün görseli varsa burada gösterilebilir
                {item.gorsel && (
                  <img src={item.gorsel} alt={item.urun} className="w-full h-40 object-cover rounded-lg mb-4 shadow-md"/>
                )}
                */}
                <h3 className="text-xl lg:text-2xl font-semibold mb-1.5 text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-red-300 group-hover:from-purple-200 group-hover:via-pink-200 group-hover:to-red-200 transition-all">
                  {item.urun}
                </h3>
                <p className="text-xs sm:text-sm text-pink-400/80 mb-3 tracking-wider font-medium">{item.kategori}</p>
                
                <div className="mt-auto pt-3 border-t border-slate-700">
                    <p className="text-xl lg:text-2xl font-bold text-green-400 text-right">
                    {parseFloat(item.fiyat).toFixed(2)} ₺
                    </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default MenuGoruntule;