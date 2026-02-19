import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import fs from 'fs';
import fsExtra from 'fs-extra';
import qrcode from 'qrcode';
import axios from 'axios';
import TikTokScraper from 'tiktok-scraper';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegPath);

const ownerNumber = "6282258735149"; // Owner Febri
const botName = "Pak CRAFT";

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');

    const sock = makeWASocket({ auth: state, printQRInTerminal: false });

    sock.ev.on('creds.update', saveCreds);

    // QR handling
    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;
        if (qr) {
            const qrPath = './qr.png';
            await qrcode.toFile(qrPath, qr);
            console.log(`QR code saved to ${qrPath}. Scan with WhatsApp!`);
        }
        if (connection === 'open') console.log(`${botName} connected!`);
        if (connection === 'close') {
            console.log('Connection closed. Reconnecting...');
            startBot();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || '';

        // === Commands ===
        // Menu
        if (text === '!menu') {
            const menuText = `
🌟 *${botName} Menu* 🌟

1️⃣ *!sticker* - Kirim gambar/video untuk dijadikan sticker
2️⃣ *!tiktok <url>* - Download video TikTok tanpa watermark
3️⃣ *!owner* - Info owner bot
4️⃣ *!info* - Info bot & komunitas
5️⃣ *!menu* - Tampilkan menu ini

Owner: Febri
Komunitas: Ngabuburit CRAFT
            `;
            await sock.sendMessage(from, { text: menuText });
        }

        // Sticker
        if (text.startsWith('!sticker')) {
            if (msg.message.imageMessage || msg.message.videoMessage) {
                const stream = await sock.downloadMediaMessage(msg);
                const inputPath = './input';
                fsExtra.ensureDirSync(inputPath);
                const fileName = `${inputPath}/media`;
                fs.writeFileSync(fileName, stream);

                const outputPath = './sticker.webp';
                ffmpeg(fileName)
                    .outputOptions([
                        '-vcodec libwebp',
                        '-vf scale=512:512:force_original_aspect_ratio=decrease,fps=15'
                    ])
                    .save(outputPath)
                    .on('end', async () => {
                        await sock.sendMessage(from, { sticker: fs.readFileSync(outputPath) });
                        console.log('Sticker sent!');
                    });
            } else {
                sock.sendMessage(from, { text: 'Kirim gambar/video dengan caption !sticker' });
            }
        }

        // TikTok
        if (text.startsWith('!tiktok ')) {
            const url = text.split(' ')[1];
            if (!url) return sock.sendMessage(from, { text: 'Masukkan URL TikTok!' });
            try {
                const videoMeta = await TikTokScraper.video(url, { noWaterMark: true });
                const videoBuffer = await axios.get(videoMeta.videoUrl, { responseType: 'arraybuffer' });
                await sock.sendMessage(from, { video: videoBuffer.data });
                console.log('TikTok video sent!');
            } catch (err) {
                sock.sendMessage(from, { text: 'Gagal download TikTok!' });
                console.error(err);
            }
        }

        // Owner
        if (text === '!owner') {
            sock.sendMessage(from, { text: `Owner: Febri\nNomor: ${ownerNumber}` });
        }

        // Info
        if (text === '!info') {
            sock.sendMessage(from, { text: `Bot: ${botName}\nOwner: Febri\nKomunitas: Ngabuburit CRAFT` });
        }
    });
}

startBot().catch(err => console.error(err));
