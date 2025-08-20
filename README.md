# WhatsApp Trading Bot

## Deskripsi

WhatsApp Trading Bot adalah sebuah bot otomatis yang membantu memudahkan proses trading dengan menggunakan WhatsApp sebagai interface utama. Bot ini memungkinkan pengguna untuk menerima sinyal trading, melakukan analisis pasar, dan mengelola portofolio trading mereka melalui platform WhatsApp.

## Fitur-Fitur

- Integrasi dengan WhatsApp Web
- Penerimaan dan pengolahan sinyal trading
- Analisis teknikal otomatis
- Notifikasi real-time untuk pergerakan harga
- Manajemen portofolio trading
- Pelaporan performa trading

## Teknologi

- Node.js
- JavaScript
- Trading API
- WhatsApp Web API

## Instalasi

1. Clone repositori ini

```bash
git clone https://github.com/caksodig/whatsapp-Bot.git
cd whatsapp-trading-bot
```

2. Install dependensi

```bash
npm install
```

3. Salin file konfigurasi

```bash
cp .env.example .env
```

4. Sesuaikan konfigurasi di file `.env`

## Penggunaan

1. Jalankan bot

```bash
npm start
```

2. Scan QR code WhatsApp yang muncul
3. Bot siap digunakan

## Struktur Proyek

```
whatsapp-trading-bot/
├── src/
│   ├── config/         # Konfigurasi aplikasi
│   ├── controllers/    # Controller untuk logika bisnis
│   ├── models/         # Model data
│   ├── services/       # Service layer
│   └── utils/          # Utilitas dan helper
├── tests/             # Unit tests
├── .env.example       # Contoh file konfigurasi
├── package.json       # Dependensi dan skrip
└── tsconfig.json     # Konfigurasi TypeScript
```

## Kontribusi

1. Fork repositori ini
2. Buat branch fitur baru (`git checkout -b fitur-baru`)
3. Commit perubahan (`git commit -am 'Menambahkan fitur baru'`)
4. Push ke branch (`git push origin fitur-baru`)
5. Buat Pull Request

## Lisensi

Proyek ini dilisensikan di bawah MIT License - lihat file [LICENSE](LICENSE) untuk detail.

## Kontak

Untuk pertanyaan dan dukungan, silakan hubungi:

- Email: yodigrochmad@gmail.com
- GitHub: [@caksodig](https://github.com/caksodig)
