import { makeWASocket, useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import fs from "fs";
import qrcode from "qrcode";
import axios from "axios";
import TikTokScraper from "tiktok-scraper";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

ffmpeg.setFfmpegPath(ffmpegPath);

// ===== INFO BOT =====
const BOT_NAME = "Pak CRAFT";
const OWNER_NUMBER = "6282258735149"; // Febri

// ===== AUTH =====
const { state, saveCreds } = await useMultiFileAuthState("auth");

const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // QR tidak otomatis muncul
});

sock.ev.on("creds.update", saveCreds);

// ===== QR CODE =====
sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
        await qrcode.toFile("qr.png", qr);
        console.log(`📲 QR Code dibuat: qr.png → scan pakai WhatsApp HP/Web`);
    }

    if (connection === "close") {
        const status = lastDisconnect?.error?.output?.statusCode;
        console.log(`❌ Koneksi terputus: ${status}`);
        if (status !== DisconnectReason.loggedOut) console.log("🔄 Mencoba reconnect...");
    } else if (connection === "open") {
        console.log(`✅ ${BOT_NAME} sudah login!`);
    }
});

// ===== COMMAND HANDLER =====
sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.key.fromMe && msg.message?.conversation) {
        const text = msg.message.conversation;

        // ===== STICKER BIASA =====
        if (text.startsWith("!stiker ")) {
            const url = text.replace("!stiker ", "").trim();
            const filename = "temp.jpg";
            try {
                const resp = await axios({ url, responseType: "arraybuffer" });
                fs.writeFileSync(filename, Buffer.from(resp.data));
                await sock.sendMessage(msg.key.remoteJid, { sticker: fs.readFileSync(filename) });
                fs.unlinkSync(filename);
            } catch {
                await sock.sendMessage(msg.key.remoteJid, { text: "❌ Gagal membuat stiker!" });
            }
        }

        // ===== STICKER BERGERAK =====
        if (text.startsWith("!stikergif ")) {
            const url = text.replace("!stikergif ", "").trim();
            const input = "temp.mp4";
            const output = "temp.webp";

            try {
                const resp = await axios({ url, responseType: "arraybuffer" });
                fs.writeFileSync(input, Buffer.from(resp.data));

                await new Promise((resolve, reject) => {
                    ffmpeg(input)
                        .outputOptions([
                            "-vcodec libwebp",
                            "-filter:v fps=fps=15,scale=512:512:flags=lanczos"
                        ])
                        .save(output)
                        .on("end", resolve)
                        .on("error", reject);
                });

                await sock.sendMessage(msg.key.remoteJid, { sticker: fs.readFileSync(output) });
                fs.unlinkSync(input);
                fs.unlinkSync(output);
            } catch {
                await sock.sendMessage(msg.key.remoteJid, { text: "❌ Gagal membuat stiker bergerak!" });
            }
        }

        // ===== DOWNLOAD TIKTOK =====
        if (text.startsWith("!tiktok ")) {
            const url = text.replace("!tiktok ", "").trim();

            try {
                const videoMeta = await TikTokScraper.getVideoMeta(url, { noWaterMark: true });
                const videoUrl = videoMeta.collector[0].videoUrl;

                const filename = "tiktok.mp4";
                const resp = await axios({ url: videoUrl, responseType: "arraybuffer" });
                fs.writeFileSync(filename, Buffer.from(resp.data));

                await sock.sendMessage(msg.key.remoteJid, { video: fs.readFileSync(filename) });
                fs.unlinkSync(filename);
            } catch {
                await sock.sendMessage(msg.key.remoteJid, { text: "❌ Gagal download video TikTok!" });
            }
        }

        // ===== OWNER COMMAND =====
        if (text.startsWith("!owner") && msg.key.participant?.includes(OWNER_NUMBER)) {
            await sock.sendMessage(msg.key.remoteJid, { text: `Halo Owner Febri! ${BOT_NAME} aktif dan stabil ✅` });
        }
    }
});

console.log(`🌐 ${BOT_NAME} berjalan, menunggu QR scan...`);
