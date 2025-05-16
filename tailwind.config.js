/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // Önerilen Font (Nunito)
      fontFamily: {
        sans: ['Nunito', 'sans-serif'], // Varsayılan sans-serif fontunu Nunito yap
      },
      // Fıstık Kafe için Örnek Tema Renkleri
      // Bu renkleri kendi kafe konseptinize göre özelleştirebilirsiniz.
      // Kullanım: bg-fistik-yesil, text-kahve-tonu-dark, border-kehribar-vurgu vb.
      colors: {
        'fistik-yesil': {
          light: '#A4D4AE',   // Açık Fıstık Yeşili
          DEFAULT: '#5DB075', // Ana Fıstık Yeşili
          dark: '#3E8E57',    // Koyu Fıstık Yeşili
        },
        'kahve-tonu': {
          light: '#D7CCC8',   // Açık Kahve/Bej
          DEFAULT: '#A1887F', // Ana Kahve Tonu
          dark: '#795548',    // Koyu Kahve Tonu
        },
        'krem-bej': {
          DEFAULT: '#F5F5DC', // Bej
        },
        'kehribar-vurgu': { // Canlı bir vurgu rengi
          light: '#FFCA28',
          DEFAULT: '#FFB300', // Kehribar
          dark: '#FFA000',
        },
        'turuncu-vurgu': { // Alternatif canlı vurgu
          light: '#FFB74D',
          DEFAULT: '#FF9800', // Turuncu
          dark: '#F57C00',
        },
        // MasaAsistani.jsx ve Home.jsx için kullanılan bazı özel renkler (isteğe bağlı)
        'sky': { // Mavi tonları (mikrofon butonu için)
            500: '#0ea5e9', // sky-500
            600: '#0284c7', // sky-600
        },
        'amber': { // Kehribar/Sarı tonları (durum bildirimleri, Home arka planı için)
            50: '#fffbeb',  // amber-50
            100: '#fef3c7', // amber-100
            300: '#fcd34d', // amber-300
            500: '#f59e0b', // amber-500
            600: '#d97706', // amber-600
            700: '#b45309', // amber-700
        },
        'emerald': { // Zümrüt yeşili (butonlar için)
            500: '#10b981', // emerald-500
            600: '#059669', // emerald-600
        },
        'stone': { // Taş rengi (MasaAsistani arka planı için)
            100: '#f5f5f4', // stone-100
        },
        'orange':{ // Turuncu (Home arka planı, buton için)
            400: '#fb923c', // orange-400
            500: '#f97316', // orange-500
            600: '#ea580c', // orange-600
        },
        'red': { // Kırmızı (Home arka planı, iptal butonu için)
            400: '#f87171', // red-400
            500: '#ef4444', // red-500
            600: '#dc2626', // red-600
        },
        'slate':{ // Gri/Arduvaz tonları (MasaAsistani mesajları, input için)
            50: '#f8fafc',   // slate-50
            100: '#f1f5f9',  // slate-100
            200: '#e2e8f0',  // slate-200 (scrollbar track için)
            300: '#cbd5e1',  // slate-300 (input border)
            400: '#94a3b8',  // slate-400 (input placeholder, scrollbar thumb)
            500: '#64748b',  // slate-500
            600: '#475569',  // slate-600 (Neso mesaj balonu)
            700: '#334155',  // slate-700 (input text)
        }
      },
      // İsterseniz animasyonlar için keyframes de ekleyebilirsiniz.
      // Örnek: Home.jsx'teki logo için bounce animasyonu veya MasaAsistani'ndaki "Yazıyor..." efekti
      animation: {
        'bounce-slow': 'bounce 3s infinite', // Home.jsx logosu için
        'pulse-dot': 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite', // "Yazıyor..." için
      },
      keyframes: {
        // bounce animasyonu Tailwind'de zaten var, bu sadece örnek
        // pulse animasyonu da Tailwind'de var, bu da örnek
        pulse: { // "Yazıyor..." için alternatif
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.5' },
        }
      }
    },
  },
  plugins: [
    require('tailwind-scrollbar'), // Scrollbar stilizasyonu için
  ],
};