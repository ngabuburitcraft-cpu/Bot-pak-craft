import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, MessageType } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import axios from 'axios';
import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import webp from 'webp-converter';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

webp.grant_permission(); // untuk WebP

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Bot PakCraft aktif ✅');
});

(async () => {
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    logger: pino({ level: 'info' }),
    printQRInTerminal: false,
    auth: state,
    version,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('QR Code received. Scan it with WhatsApp!');
      console.log(qr); // bisa juga dikirim ke website atau generate image
    }

    if (connection === 'close') {
      const reason = lastDisconnect.error?.output?.statusCode;
      console.log(`Koneksi ditutup, reason: ${reason}`);
      if (reason !== DisconnectReason.loggedOut) {
        startSock(); // reconnect
      }
    }

    if (connection === 'open') {
      console.log('Terhubung ke WhatsApp ✅');
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg.message) return;

      const sender = msg.key.remoteJid;
      const isGroup = sender.endsWith('@g.us');
      const fromMe = msg.key.fromMe;

      // AUTO WELCOME
      if (isGroup && msg.message?.extendedTextMessage?.text?.toLowerCase() === '!welcome') {
        const welcomeText = `
🎉 SELAMAT DATANG MEMBER BARU! 🎉
Halo dan selamat bergabung di komunitas kita 👋🔥
Terima kasih sudah join!
Di sini kita bisa:
Ngobrol seru bareng 🎮
Main bareng di server Minecraft ✨
Ikut event dan fitur menarik lainnya 🚀
📌 Info penting:
IP dan Port server ada di deskripsi grup, jadi langsung cek di sana untuk main ya 😉
Jangan lupa juga join Discord komunitas kita supaya tidak ketinggalan info terbaru 🎧
Semoga betah, nyaman, dan bisa seru-seruan bareng di sini 💚
Selamat menikmati keseruan komunitas kita! 🙌
        `;
        await sock.sendMessage(sender, { text: welcomeText });
      }

      // STIKER STATIS
      if (msg.message.imageMessage) {
        const stream = await sock.downloadMediaMessage(msg, 'buffer');
        await sock.sendMessage(sender, { sticker: stream });
      }

      // STIKER BERGERAK (GIF/VIDEO)
      if (msg.message.videoMessage || msg.message.documentMessage?.mimetype.includes('gif')) {
        const buffer = await sock.downloadMediaMessage(msg, 'buffer');
        const tempInput = path.join(__dirname, 'temp_input');
        const tempOutput = path.join(__dirname, 'temp_output.webp');
        fs.writeFileSync(tempInput, buffer);

        await new Promise((resolve, reject) => {
          ffmpeg(tempInput)
            .outputOptions([
              '-vcodec libwebp',
              '-vf scale=512:512:flags=lanczos,fps=15',
              '-loop 0',
              '-preset default',
              '-an',
              '-vsync 0'
            ])
            .toFormat('webp')
            .save(tempOutput)
            .on('end', resolve)
            .on('error', reject);
        });

        const webpSticker = fs.readFileSync(tempOutput);
        await sock.sendMessage(sender, { sticker: webpSticker });
        fs.unlinkSync(tempInput);
        fs.unlinkSync(tempOutput);
      }

      // DOWNLOAD VIDEO TIKTOK
      if (msg.message.extendedTextMessage?.text.startsWith('!tiktok ')) {
        const url = msg.message.extendedTextMessage.text.split(' ')[1];
        await sock.sendMessage(sender, { text: `Sedang mendownload video TikTok...\nURL: ${url}` });

        // bisa pakai API TikTok downloader
        const { data } = await axios.get(`https://api.tikmate.app/api/lookup?url=${url}`);
        const videoUrl = data.video.download; // link video tanpa watermark
        const videoBuffer = (await axios.get(videoUrl, { responseType: 'arraybuffer' })).data;

        await sock.sendMessage(sender, { video: videoBuffer, caption: 'Video TikTok' });
      }

    } catch (err) {
      console.log('Error:', err);
    }
  });

  app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

})();
