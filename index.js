import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import fs from 'fs-extra';
import fetch from 'node-fetch';
import TikTokScraper from 'tiktok-scraper';

const ownerNumber = '6282258735149'; // Owner: Febri
const botName = 'Pak Craft';

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false // deprecated, QR akan ditampilkan manual
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // QR akan dicetak di terminal sebagai teks
      console.log('Scan QR ini untuk login:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const status = lastDisconnect?.error?.output?.statusCode;
      console.log('❌ Koneksi terputus, reconnecting...', status);
      if (status !== DisconnectReason.loggedOut) {
        startBot();
      }
    }

    if (connection === 'open') {
      console.log(`✅ ${botName} sudah terhubung!`);
    }
  });

  // Menu sederhana
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

    // Menu utama
    if (text === '!menu') {
      const menu = `
📌 *${botName} - Bot Komunitas Ngabuburit CRAFT*
Owner: Febri
⚡ Fitur tersedia:
1. !tiktok <url> - Download video TikTok
2. !stiker <reply image> - Buat stiker dari gambar
3. !info - Info bot dan komunitas
      `;
      await sock.sendMessage(from, { text: menu });
    }

    // Info bot
    if (text === '!info') {
      const info = `
Bot ini khusus untuk komunitas Ngabuburit CRAFT
Owner: Febri
Nikmati fitur download TikTok & buat stiker!
      `;
      await sock.sendMessage(from, { text: info });
    }

    // Buat stiker dari gambar
    if (text?.startsWith('!stiker')) {
      try {
        if (msg.message.imageMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
          const buffer = msg.message.imageMessage
            ? Buffer.from(msg.message.imageMessage.data)
            : Buffer.from(msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage.data);

          await sock.sendMessage(from, { sticker: buffer });
        } else {
          await sock.sendMessage(from, { text: 'Kirim gambar atau reply gambar dengan !stiker' });
        }
      } catch (e) {
        console.log(e);
      }
    }

    // Download TikTok
    if (text?.startsWith('!tiktok ')) {
      const url = text.split(' ')[1];
      try {
        const videoMeta = await TikTokScraper.getVideoMeta(url, { noWaterMark: true });
        const videoBuffer = await (await fetch(videoMeta.videoUrl)).arrayBuffer();
        await sock.sendMessage(from, { video: Buffer.from(videoBuffer), caption: 'Video TikTok' });
      } catch (e) {
        await sock.sendMessage(from, { text: 'Gagal download video, pastikan link valid.' });
      }
    }
  });
}

startBot().catch(err => console.log(err));
