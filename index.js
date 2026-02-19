import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import express from 'express';
import fs from 'fs-extra';
import axios from 'axios';
import { exec } from 'child_process';
import path from 'path';

// ===== Web server untuk Railway =====
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('Bot WhatsApp Ngabuburit CRAFT Online 🎉');
});

app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// ===== Auth =====
const { state, saveCreds } = await useMultiFileAuthState('auth');

async function startBot() {
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        version,
    });

    sock.ev.on('creds.update', saveCreds);

    // ===== QR Code =====
    sock.ev.on('connection.update', (update) => {
        if (update.qr) {
            console.log('📲 QR Code received, scan this dengan WhatsApp:');
            qrcode.generate(update.qr, { small: true });
        }
        if (update.connection === 'close') {
            console.log('❌ Connection closed. Reconnecting...');
            if (update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                startBot();
            }
        }
        if (update.connection === 'open') {
            console.log('✅ Connected to WhatsApp!');
        }
    });

    // ===== Auto Welcome =====
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && msg.key.remoteJid.endsWith('@g.us') && msg.message?.conversation === 'join') {
            const jid = msg.key.remoteJid;
            const welcomeText = `🎉 SELAMAT DATANG MEMBER BARU! 🎉
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
Owner: Febri`;
            await sock.sendMessage(jid, { text: welcomeText });
        }
    });

    // ===== Commands =====
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe) {
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
            const from = msg.key.remoteJid;
            if (!text) return;

            // ===== Stiker =====
            if (text.startsWith('!sticker')) {
                const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quoted && quoted.imageMessage) {
                    const buffer = await sock.downloadMediaMessage({ message: quoted, type: 'buffer' });
                    const outPath = './sticker.webp';
                    fs.writeFileSync(outPath, buffer);
                    await sock.sendMessage(from, { sticker: fs.readFileSync(outPath) });
                } else {
                    await sock.sendMessage(from, { text: 'Balas gambar dengan !sticker untuk membuat stiker.' });
                }
            }

            // ===== Stiker bergerak =====
            if (text.startsWith('!gifsticker')) {
                const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quoted && quoted.videoMessage) {
                    const buffer = await sock.downloadMediaMessage({ message: quoted, type: 'buffer' });
                    const inPath = './input.mp4';
                    const outPath = './sticker.gif';
                    fs.writeFileSync(inPath, buffer);

                    exec(`ffmpeg -i ${inPath} -vf "scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease" -t 6 ${outPath}`, async (err) => {
                        if (err) return console.error(err);
                        await sock.sendMessage(from, { sticker: fs.readFileSync(outPath) });
                    });
                } else {
                    await sock.sendMessage(from, { text: 'Balas video dengan !gifsticker untuk membuat stiker bergerak.' });
                }
            }

            // ===== Download TikTok =====
            if (text.startsWith('!tiktok ')) {
                const url = text.replace('!tiktok ', '');
                try {
                    const res = await axios.get(`https://api.tiktokv.com/?url=${encodeURIComponent(url)}`, { responseType: 'arraybuffer' });
                    await sock.sendMessage(from, { video: Buffer.from(res.data) });
                } catch (e) {
                    console.error(e);
                    await sock.sendMessage(from, { text: 'Gagal download video TikTok.' });
                }
            }
        }
    });
}

startBot();
