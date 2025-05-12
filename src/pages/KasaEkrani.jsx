import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- Backend URL Ayarları (Ortam Değişkeni ile) ---
// Vercel/Render gibi platformlarda VITE_API_URL ortam değişkenini ayarlayın.
// Yerelde çalıştırırken (eğer VITE_API_URL tanımlı değilse) otomatik olarak localhost'a düşecektir.
// Create React App kullanıyorsanız VITE_ yerine REACT_APP_ ön ekini kullanın.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// API URL'sine göre WebSocket URL'sini dinamik oluştur (HTTPS -> WSS, HTTP -> WS)
let WS_URL;
try {
    const apiUrlObj = new URL(API_BASE_URL);
    const wsProtocol = apiUrlObj.protocol === 'https:' ? 'wss:' : 'ws:';
    // API URL'sinin host'unu (domain + port) kullanarak WS URL'sini oluştur
    WS_URL = `${wsProtocol}//${apiUrlObj.host}/ws/kasa`;
} catch (e) {
    console.error("API URL'sinden WebSocket URL'si oluşturulamadı, varsayılan kullanılıyor.", e);
    // Hata durumunda veya geçersiz API_BASE_URL durumunda varsayılan fallback
    WS_URL = `ws://localhost:8000/ws/kasa`;
}

// Geliştirme sırasında kontrol için konsola yazdırabilirsiniz
// console.log("Kullanılan API URL:", API_BASE_URL);
// console.log("Kullanılan WS URL:", WS_URL);

// --- Stil Tanımlamaları (Tek dosya için gömülü) ---
// Not: Büyük projelerde ayrı CSS/CSS Module/Styled Components kullanmak daha iyidir.
const styles = `
    .kasa-container {
        width: 95%; max-width: 1400px; margin: 20px auto; background-color: #fff;
        box-shadow: 0 0 15px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; /* Daha modern bir font stack */
    }
    .kasa-header {
        background-color: #5D4037; color: #fff; padding: 15px 25px; display: flex;
        justify-content: space-between; align-items: center;
    }
    .kasa-header h1 { margin: 0; font-size: 1.5em; }
    .connection-status { font-size: 0.9em; padding: 5px 10px; border-radius: 4px; transition: background-color 0.5s ease, color 0.5s ease; }
    .connection-status.connected { background-color: #4CAF50; color: white; }
    .connection-status.disconnected { background-color: #f44336; color: white; }
    .connection-status.connecting { background-color: #ff9800; color: white; }

    .kasa-pos-layout { display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; padding: 20px; min-height: 70vh; /* Biraz daha yükseklik */ }
    .kasa-panel { background-color: #f9f9f9; /* Panel arka planını hafif gri yap */ padding: 20px; border-radius: 8px; /* Daha yuvarlak köşeler */ box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow-y: auto; max-height: 75vh; /* Panellerin max yüksekliği */ }
    .kasa-panel h2, .kasa-panel h3 { margin-top: 0; color: #4E342E; /* Biraz daha açık kahve */ border-bottom: 2px solid #D7CCC8; padding-bottom: 10px; font-weight: 600;}
    .kasa-tables-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); /* Butonlar için biraz daha yer */ gap: 15px; margin-top: 15px; }
    .kasa-table-button {
        padding: 15px 10px; border: 1px solid #BDBDBD; /* Daha belirgin border */ border-radius: 6px; /* Biraz daha yuvarlak */ background-color: #ECEFF1; /* Açık mavi-gri */
        color: #37474F; text-align: center; cursor: pointer; transition: all 0.2s ease-in-out; font-weight: 600; /* Kalın font */
        position: relative; min-height: 70px; /* Biraz daha yüksek */ display: flex; flex-direction: column; justify-content: center; align-items: center; line-height: 1.3;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .kasa-table-button:hover:not(.selected) { background-color: #CFD8DC; border-color: #78909C; transform: translateY(-2px); box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .kasa-table-button.aktif { background-color: #FFF9C4; border-color: #FBC02D; color: #795548; } /* Soluk Sarı */
    .kasa-table-button.dolu { background-color: #FFCDD2; border-color: #E57373; color: #C62828; } /* Soluk Kırmızı */
    .kasa-table-button.odeme-bekliyor { background-color: #FFE0B2; border-color: #FFB74D; color: #E65100; } /* Soluk Turuncu */
    .kasa-table-button.selected { border-width: 2px; border-color: #42A5F5; background-color: #BBDEFB; /* Seçili arka plan */ color: #1565C0; box-shadow: 0 0 10px rgba(66, 165, 245, 0.7); transform: scale(1.05); }
    .kasa-table-last-action { font-size: 0.75em; /* Biraz daha büyük */ color: #546E7A; margin-top: 6px; font-weight: normal; width: 100%; padding: 0 5px; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .kasa-table-button.dolu .kasa-table-last-action,
    .kasa-table-button.odeme-bekliyor .kasa-table-last-action { color: inherit; opacity: 0.9; }

    .kasa-order-details ul { list-style: none; padding: 0; margin: 15px 0 0 0; }
    .kasa-order-details li { display: flex; justify-content: space-between; padding: 10px 5px; /* Padding artırıldı */ border-bottom: 1px dashed #CFD8DC; align-items: center; }
    .kasa-order-details li:last-child { border-bottom: none; }
    .kasa-order-details .item-name { font-weight: 500; /* Normalden biraz kalın */ flex-grow: 1; margin-right: 10px; }
    .kasa-order-details .item-qty { margin: 0 10px; color: #37474F; background-color: #ECEFF1; padding: 3px 8px; border-radius: 10px; font-size: 0.9em;}
    .kasa-order-details .item-price { font-weight: 600; min-width: 75px; /* Genişlik artırıldı */ text-align: right; }
    .kasa-order-total { margin-top: 20px; padding-top: 15px; border-top: 2px solid #A1887F; /* Daha açık kahve */ text-align: right; font-size: 1.4em; /* Daha büyük */ font-weight: bold; color: #3E2723; }
    .kasa-order-notes { margin-top: 12px; font-style: italic; color: #4E342E; font-size: 0.95em; background-color: #FFF8E1; padding: 10px; border-radius: 4px; border-left: 4px solid #FFC107;}

    .kasa-payment-section { margin-top: 25px; padding-top: 20px; border-top: 1px solid #BDBDBD; }
    .kasa-payment-total { font-size: 1.5em; /* Daha büyük */ font-weight: bold; color: #D32F2F; text-align: center; margin-bottom: 20px; }
    .kasa-payment-input { margin-bottom: 20px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center;}
    .kasa-payment-input label { font-weight: 600; }
    .kasa-payment-input input[type="number"] { padding: 10px 12px; border: 1px solid #BDBDBD; border-radius: 4px; width: 130px; font-size: 1.05em; text-align: right; box-shadow: inset 0 1px 2px rgba(0,0,0,0.1); }
    .kasa-change-due { font-weight: 600; color: #388E3C; font-size: 1.15em; }
    .kasa-payment-methods { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; justify-content: center; }
    .kasa-payment-methods button { padding: 12px 20px; border: none; border-radius: 5px; cursor: pointer; background-color: #1E88E5; /* Daha canlı mavi */ color: white; font-size: 1em; transition: background-color 0.2s ease, box-shadow 0.2s ease; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.15); }
    .kasa-payment-methods button:hover { background-color: #1572C3; box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
    .kasa-payment-methods button:disabled { background-color: #B0BEC5; cursor: not-allowed; opacity: 0.7; box-shadow: none; }

    .kasa-message { margin-top: 15px; padding: 12px 18px; border-radius: 5px; text-align: center; font-weight: 500; font-size: 0.95em;}
    .kasa-message.success { background-color: #E8F5E9; color: #2E7D32; border: 1px solid #A5D6A7; }
    .kasa-message.error { background-color: #FFEBEE; color: #C62828; border: 1px solid #EF9A9A; }
    .kasa-message.info { background-color: #E3F2FD; color: #1565C0; border: 1px solid #90CAF9; }
    .kasa-hidden { display: none !important; } /* Daha güçlü gizleme */

    .kasa-footer { background-color: #F5F5F5; /* Daha açık footer */ padding: 12px 25px; text-align: center; font-size: 0.85em; color: #757575; border-top: 1px solid #E0E0E0; }
    .kasa-log-area { margin-top: 5px; font-style: italic; color: #9E9E9E; height: 1.3em; /* Biraz daha yer */ overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;


function KasaEkrani() {
    // --- State Yönetimi ---
    const [tables, setTables] = useState({});
    const [selectedTableId, setSelectedTableId] = useState(null);
    const [currentOrder, setCurrentOrder] = useState(null);
    const [isLoadingOrder, setIsLoadingOrder] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [changeDue, setChangeDue] = useState(0);
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const [paymentMessage, setPaymentMessage] = useState({ text: '', type: '' });
    const [lastLog, setLastLog] = useState('Arayüz başlatılıyor...');
    const ws = useRef(null);
    const reconnectAttempt = useRef(0);
    const reconnectTimer = useRef(null);

    // --- Yardımcı Fonksiyonlar ---
    const log = useCallback((message, level = 'info') => {
        console[level](message);
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit'}); // Sadece saat formatı
        setLastLog(`[${now}] ${message}`);
    }, []);

    const getTableStatusClass = useCallback((tableInfo) => {
        if (!tableInfo) return '';
        if (!tableInfo.aktif) {
            // Aktif olmayan masa (boş veya başka bir durum)
            return ''; // Veya 'pasif' gibi özel bir sınıf
        }
        // Aktifse son işleme bak
        if (tableInfo.sonIslem?.toLowerCase().includes('ödeme')) return 'odeme-bekliyor';
        if (tableInfo.sonIslem?.toLowerCase().includes('sipariş')) return 'dolu';
        return 'aktif'; // Diğer aktif durumlar için (örneğin sadece erişim)
    }, []);

    // --- API Çağrıları ---
    const fetchTables = useCallback(async () => {
        log('Aktif masalar çekiliyor...');
        try {
            const response = await fetch(`${API_BASE_URL}/aktif-masalar`);
            if (!response.ok) throw new Error(`HTTP hata: ${response.status} - ${response.statusText}`);
            const data = await response.json();
            const newTablesData = {};
            if (data && Array.isArray(data.tables)) {
                data.tables.forEach(table => {
                    newTablesData[table.masa_id] = {
                        ...table,
                        durumClass: getTableStatusClass(table)
                    };
                });
                setTables(newTablesData);
                log(`${Object.keys(newTablesData).length} masa durumu güncellendi.`);
            } else {
                log('Masalar çekilemedi veya format yanlış.', 'warn');
                setTables({}); // Masaları temizle
            }
        } catch (error) {
            log(`Masaları çekerken hata: ${error.message}`, 'error');
            setConnectionStatus('disconnected');
        }
    }, [getTableStatusClass, log]);

    const fetchOrderDetails = useCallback(async (tableId) => {
        if (!tableId) return;
        log(`Masa ${tableId} için sipariş detayları çekiliyor...`);
        setIsLoadingOrder(true);
        setCurrentOrder(null);
        setPaymentMessage({ text: '', type: '' });
        setPaymentAmount('');
        setChangeDue(0);
        try {
            const response = await fetch(`${API_BASE_URL}/masalar/${tableId}/aktif-siparis`);
            if (response.status === 404) {
                setCurrentOrder({ isEmpty: true });
                log(`Masa ${tableId} için aktif sipariş bulunamadı.`);
            } else if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: `HTTP hata: ${response.status} - ${response.statusText}` }));
                throw new Error(errorData.detail);
            } else {
                const data = await response.json();
                setCurrentOrder(data);
                log(`Masa ${tableId} sipariş (ID: ${data.id || 'Bilinmiyor'}) yüklendi. Tutar: ${data.hesaplanan_tutar != null ? data.hesaplanan_tutar.toFixed(2) : 'N/A'} TL`);
            }
        } catch (error) {
            log(`Sipariş detayları alınırken hata (Masa ${tableId}): ${error.message}`, 'error');
            setCurrentOrder({ isError: true, message: error.message });
        } finally {
            setIsLoadingOrder(false);
        }
    }, [log]);

    const processPayment = useCallback(async (paymentType) => {
        if (!currentOrder || !currentOrder.id || !selectedTableId) {
            setPaymentMessage({ text: 'Ödeme yapmak için geçerli bir sipariş seçilmelidir.', type: 'error' });
            return;
        }

        const receivedAmount = parseFloat(paymentAmount) || 0;
        const totalAmount = currentOrder.hesaplanan_tutar || 0;

        if (paymentType === 'Nakit' && receivedAmount < totalAmount) {
             setPaymentMessage({ text: 'Alınan nakit tutar, sipariş tutarından az olamaz.', type: 'error' });
             return;
        }

        const calculatedChange = paymentType === 'Nakit' ? Math.max(0, receivedAmount - totalAmount) : null;
        const paymentData = {
            siparis_id: currentOrder.id,
            masa_id: selectedTableId,
            odeme_tipi: paymentType,
            alinan_tutar: receivedAmount,
            odenen_tutar: totalAmount,
            para_ustu: calculatedChange,
            odeme_notu: `Kasa Ekranı - ${paymentType}`
        };

        log(`Ödeme işlemi başlatılıyor: Masa ${selectedTableId}, Sipariş ${currentOrder.id}, Tip: ${paymentType}`);
        setPaymentMessage({ text: 'Ödeme işleniyor...', type: 'info' });

        try {
            const response = await fetch(`${API_BASE_URL}/odeme-yap`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(paymentData)
            });

            const responseText = await response.text(); // Hata mesajını almak için önce text oku
            if (!response.ok) {
                let errorDetail = `HTTP hata: ${response.status} - ${response.statusText}`;
                try {
                    const errorData = JSON.parse(responseText);
                    errorDetail = errorData.detail || errorDetail;
                } catch (e) { /* JSON parse hatası olursa varsayılanı kullan */ }
                throw new Error(errorDetail);
            }

            const result = JSON.parse(responseText); // Başarılıysa JSON parse et
            log(`Ödeme başarılı: Masa ${selectedTableId}, Ödeme ID: ${result.odemeId || 'N/A'}`);
            const changeText = calculatedChange !== null ? `Para Üstü: ${calculatedChange.toFixed(2)} TL` : '';
            setPaymentMessage({ text: `Ödeme başarıyla alındı. ${changeText}`, type: 'success' });

            setCurrentOrder(null);
            setSelectedTableId(null);
            setPaymentAmount('');
            setChangeDue(0);
            fetchTables();

        } catch (error) {
             log(`Ödeme sırasında hata: ${error.message}`, 'error');
             setPaymentMessage({ text: `Ödeme başarısız: ${error.message}`, type: 'error' });
        }
    }, [currentOrder, selectedTableId, paymentAmount, log, fetchTables]);


    // --- WebSocket Yönetimi ---
    const connectWebSocket = useCallback(() => {
        if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
            return;
        }
        if (reconnectTimer.current) {
            clearTimeout(reconnectTimer.current);
        }

        log(`WebSocket'e bağlanılıyor: ${WS_URL}`);
        setConnectionStatus('connecting');
        try {
            ws.current = new WebSocket(WS_URL);
        } catch (error) {
             log(`WebSocket oluşturulurken hata: ${error.message}`, 'error');
             setConnectionStatus('disconnected');
             reconnectAttempt.current += 1;
             const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 30000);
             log(`WebSocket oluşturma hatası sonrası ${delay / 1000} sn sonra yeniden denenecek...`, 'warn');
             reconnectTimer.current = setTimeout(connectWebSocket, delay);
             return;
        }

        ws.current.onopen = () => {
            log('WebSocket bağlantısı kuruldu.');
            setConnectionStatus('connected');
            reconnectAttempt.current = 0;
        };

        ws.current.onclose = (event) => {
            log(`WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason || 'Bilinmiyor'}`);
            setConnectionStatus('disconnected');
            if (ws.current) { // Event listener'ları temizlemeden önce kontrol et
                 ws.current.onopen = null;
                 ws.current.onclose = null;
                 ws.current.onerror = null;
                 ws.current.onmessage = null;
            }
            ws.current = null;

            if (event.code !== 1000 && event.code !== 1001) { // Normal kapanma değilse
                reconnectAttempt.current += 1;
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 30000);
                log(`${delay / 1000} saniye sonra yeniden bağlanma denenecek... (${reconnectAttempt.current}. deneme)`, 'warn');
                reconnectTimer.current = setTimeout(connectWebSocket, delay);
            } else {
                 log('WebSocket normal şekilde kapatıldı, yeniden bağlanılmayacak.');
            }
        };

        ws.current.onerror = (error) => {
            log(`WebSocket bağlantı hatası.`, 'error');
            console.error('WebSocket Error Event:', error);
            setConnectionStatus('disconnected');
            // onclose genellikle zaten tetiklenecektir ve yeniden bağlanmayı yönetecektir.
        };

        ws.current.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                // log(`WS mesajı alındı: Tip: ${message.type}`); // Gerekirse açılabilir, çok log üretir

                if (message.type === 'pong') return;

                if (message.type === 'masa_durum') {
                    const { masaId, sonErisim, aktif, sonIslem } = message.data;
                    setTables(prevTables => ({
                        ...prevTables,
                        [masaId]: {
                            ...(prevTables[masaId] || {}), // Masa ilk kez geliyorsa undefined olmasın
                            masaId, sonErisim, aktif, sonIslem,
                            durumClass: getTableStatusClass(message.data)
                        }
                    }));
                } else if (message.type === 'siparis' || message.type === 'durum' || message.type === 'odeme') {
                    const ilgiliMasaId = message.data?.masa || message.data?.masa_id;
                    if (ilgiliMasaId) {
                        log(`Masa ${ilgiliMasaId} için WS güncellemesi: ${message.type}`);
                        setTables(prevTables => {
                             const updatedTableData = {
                                masa_id: ilgiliMasaId,
                                sonIslem: message.type === 'siparis' ? 'Yeni Sipariş' : (message.type === 'odeme' ? 'Ödeme Alındı' : `Durum: ${message.data?.durum}`),
                                sonErisim: new Date().toISOString(),
                                aktif: message.data.aktif !== undefined ? message.data.aktif : !(message.type === 'odeme'),
                             };
                             return {
                                 ...prevTables,
                                 [ilgiliMasaId]: {
                                     ...(prevTables[ilgiliMasaId] || {}), // Mevcut bilgileri koru
                                     ...updatedTableData, // Gelen yeni bilgileri ekle/üzerine yaz
                                     durumClass: getTableStatusClass({...prevTables[ilgiliMasaId], ...updatedTableData})
                                 }
                             };
                         });

                        if (ilgiliMasaId === selectedTableId) {
                            if (message.type !== 'odeme') { // Ödeme mesajı ise detayları zaten processPayment temizledi
                                fetchOrderDetails(selectedTableId);
                            } else {
                                // Başarılı ödeme sonrası seçili masa ve sipariş null yapıldı,
                                // bu yüzden fetchOrderDetails çağırmak 404 verebilir.
                                // Arayüz zaten temizlenmiş olmalı.
                                log(`Masa ${selectedTableId} için ödeme alındı, detaylar temizlendi.`);
                            }
                        }
                    }
                } else {
                    log(`Bilinmeyen WS mesaj tipi: ${message.type}`, 'warn');
                }
            } catch (error) {
                log(`WebSocket mesajı işlenirken hata: ${error.message}`, 'error');
                console.error("Gelen WS verisi:", event.data);
            }
        };
    }, [log, getTableStatusClass, fetchOrderDetails, selectedTableId]); // selectedTableId ws.onmessage içinde kullanılıyor

    // --- Effect Hook'ları ---
    useEffect(() => {
        fetchTables();
        connectWebSocket();
        return () => { // Cleanup fonksiyonu
            if (reconnectTimer.current) {
                clearTimeout(reconnectTimer.current);
            }
            if (ws.current) {
                log('Component kaldırılıyor, WebSocket bağlantısı kapatılıyor.');
                ws.current.onclose = null; // Yeniden bağlanma döngüsünü kırmak için
                ws.current.onerror = null;
                ws.current.onopen = null;
                ws.current.onmessage = null;
                if (ws.current.readyState === WebSocket.OPEN) {
                    ws.current.close(1000, "Component unmounting");
                }
                ws.current = null;
            }
        };
    }, [fetchTables, connectWebSocket]); // Bağımlılıklar doğru

    useEffect(() => {
        const received = parseFloat(paymentAmount) || 0;
        const total = currentOrder?.hesaplanan_tutar || 0;
        const newChange = Math.max(0, received - total);
        setChangeDue(newChange);
    }, [paymentAmount, currentOrder]);

    // --- Olay Yöneticileri ---
    const handleTableClick = (tableId) => {
        if (selectedTableId !== tableId) {
             setSelectedTableId(tableId);
             fetchOrderDetails(tableId);
        }
    };

    const handlePaymentAmountChange = (event) => {
        setPaymentAmount(event.target.value);
    };

    const handlePaymentMethodsClick = useCallback((event) => {
        if (event.target.tagName === 'BUTTON') {
            const paymentType = event.target.getAttribute('data-payment-type');
            if (paymentType) {
                processPayment(paymentType);
            }
        }
    }, [processPayment]);


    // --- Render Fonksiyonu ---
    return (
        <div className="kasa-container">
            <style>{styles}</style>

            <header className="kasa-header">
                <h1>Neso Kasa Ekranı</h1>
                <div className={`connection-status ${connectionStatus}`}>
                    {connectionStatus === 'connected' ? 'Bağlı' :
                     connectionStatus === 'connecting' ? 'Bağlanıyor...' : 'Bağlantı Yok'}
                </div>
            </header>

            <main className="kasa-pos-layout">
                <div className="kasa-panel tables-panel">
                    <h2>Masalar</h2>
                    <div className="kasa-tables-grid">
                        {Object.keys(tables).length === 0 && <p>Masalar yükleniyor veya hiç masa yok...</p>}
                        {Object.values(tables)
                            .sort((a, b) => {
                                const numA = parseInt(a.masa_id.replace(/\D/g,''), 10) || a.masa_id; // Sayısal kısmı al
                                const numB = parseInt(b.masa_id.replace(/\D/g,''), 10) || b.masa_id;
                                const strA = a.masa_id.replace(/\d/g,''); // String kısmı al
                                const strB = b.masa_id.replace(/\d/g,'');

                                if (strA < strB) return -1;
                                if (strA > strB) return 1;
                                if (typeof numA === 'number' && typeof numB === 'number') {
                                    return numA - numB;
                                }
                                return a.masa_id.localeCompare(b.masa_id); // Fallback
                            })
                            .map(table => (
                                <button
                                    key={table.masa_id}
                                    className={`kasa-table-button ${table.durumClass || ''} ${selectedTableId === table.masa_id ? 'selected' : ''}`}
                                    onClick={() => handleTableClick(table.masa_id)}
                                    title={`Masa ${table.masa_id}\nSon İşlem: ${table.sonIslem || 'Yok'}\nSon Erişim: ${table.sonErisim ? new Date(table.sonErisim).toLocaleString() : 'Bilinmiyor'}`}
                                >
                                    {table.masa_id}
                                    {table.sonIslem && (
                                        <span className="kasa-table-last-action">
                                             {table.sonIslem}
                                        </span>
                                    )}
                                </button>
                            ))}
                    </div>
                </div>

                <div className="kasa-panel order-payment-panel">
                    <h2>Seçili Masa: <span>{selectedTableId || 'Yok'}</span></h2>
                    <div className="kasa-order-details">
                        {isLoadingOrder && <p>Sipariş yükleniyor...</p>}
                        {!isLoadingOrder && !selectedTableId && <p>Lütfen soldaki listeden bir masa seçin.</p>}
                        {!isLoadingOrder && currentOrder?.isEmpty && <p>Bu masa için aktif bir sipariş bulunmuyor.</p>}
                        {!isLoadingOrder && currentOrder?.isError && <p className={`kasa-message error`}>Sipariş yüklenirken hata: {currentOrder.message}</p>}

                        {currentOrder && !currentOrder.isEmpty && !currentOrder.isError && (
                            <>
                                <h3>Aktif Sipariş (ID: {currentOrder.id || 'Bilinmiyor'})</h3>
                                <ul>
                                    {currentOrder.sepet && currentOrder.sepet.length > 0 ? (
                                        currentOrder.sepet.map((item, index) => (
                                            <li key={`${currentOrder.id}-${item.urun}-${index}`}> {/* Daha da unique key */}
                                                <span className="item-name">{item.urun}</span>
                                                <span className="item-qty">{item.adet}x</span>
                                                <span className="item-price">{(item.adet * item.fiyat).toFixed(2)} TL</span>
                                            </li>
                                        ))
                                    ) : (
                                        <li>Siparişte ürün bulunmuyor.</li>
                                    )}
                                </ul>
                                <div className="kasa-order-total">
                                    Toplam: {currentOrder.hesaplanan_tutar != null ? currentOrder.hesaplanan_tutar.toFixed(2) : '0.00'} TL
                                </div>
                                {currentOrder.istek && (
                                     <div className="kasa-order-notes">
                                         <strong>Not:</strong> {currentOrder.istek}
                                     </div>
                                 )}
                            </>
                        )}
                    </div>

                    <div className={`kasa-payment-section ${currentOrder && !currentOrder.isEmpty && !currentOrder.isError ? '' : 'kasa-hidden'}`}>
                        <h3>Ödeme</h3>
                        <div className="kasa-payment-total">
                            Ödenecek Tutar: <strong>{currentOrder?.hesaplanan_tutar != null ? currentOrder.hesaplanan_tutar.toFixed(2) : '0.00'} TL</strong>
                        </div>
                        <div className="kasa-payment-input">
                            <label htmlFor="amount-received">Alınan Tutar:</label>
                            <input
                                type="number"
                                id="amount-received"
                                value={paymentAmount}
                                onChange={handlePaymentAmountChange}
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                aria-label="Alınan Tutar"
                            />
                            <span className="kasa-change-due">Para Üstü: {changeDue.toFixed(2)} TL</span>
                        </div>
                        <div className="kasa-payment-methods" onClick={handlePaymentMethodsClick}>
                            <button data-payment-type="Nakit">Nakit Öde</button>
                            <button data-payment-type="Kredi Kartı">Kredi Kartı Öde</button>
                            <button data-payment-type="Yemek Kartı">Yemek Kartı Öde</button>
                        </div>
                         <div className={`kasa-message ${paymentMessage.type || 'kasa-hidden'}`}>
                             {paymentMessage.text}
                         </div>
                    </div>
                </div>
            </main>

            <footer className="kasa-footer">
                <div className="kasa-log-area" title={lastLog}>{lastLog}</div>
            </footer>
        </div>
    );
}

export default KasaEkrani;