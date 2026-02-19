import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import express from "express";
import pino from "pino";
import QRCode from "qrcode";
import axios from "axios";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: state
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      const qrImage = await QRCode.toDataURL(qr);
      console.log("📱 Scan QR ini di browser:");
      console.log(qrImage);
    }

    if (connection === "connecting") {
      console.log("🔄 Connecting...");
    }

    if (connection === "open") {
      console.log("✅ Bot connected!");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (shouldReconnect) {
        startBot();
      }
    }
  });

  // ===== COMMAND HANDLER =====
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const sender = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text) return;
    if (!text.startsWith("!")) return;

    const command = text.slice(1).toLowerCase();

    // MENU
    if (command === "menu") {
      await sock.sendMessage(sender, {
        text: `🤖 *BOT MENU*

!menu
!ping
!owner
!info
!stiker
!tt link

Ngabuburit Craft 🚀`
      });
    }

    // PING
    if (command === "ping") {
      await sock.sendMessage(sender, {
        text: "🏓 Pong! Bot aktif."
      });
    }

    // OWNER
    if (command === "owner") {
      await sock.sendMessage(sender, {
        text: "👑 Owner: Riko"
      });
    }

    // INFO
    if (command === "info") {
      await sock.sendMessage(sender, {
        text: "📌 Bot WhatsApp Railway Full Version"
      });
    }

    // STIKER
    if (command === "stiker") {
      if (msg.message.imageMessage) {
        const buffer = await sock.downloadMediaMessage(msg);
        await sock.sendMessage(sender, {
          sticker: buffer
        });
      } else {
        await sock.sendMessage(sender, {
          text: "Kirim gambar dengan caption !stiker"
        });
      }
    }

    // TIKTOK DOWNLOAD
    if (command.startsWith("tt ")) {
      const url = text.split(" ")[1];

      if (!url) {
        return sock.sendMessage(sender, {
          text: "Masukkan link TikTok!\nContoh:\n!tt https://vt.tiktok.com/xxxx"
        });
      }

      try {
        const api = await axios.get(
          `https://api.tiklydown.eu.org/api/download?url=${url}`
        );

        const videoUrl = api.data.video.noWatermark;

        await sock.sendMessage(sender, {
          video: { url: videoUrl },
          caption: "🎬 TikTok Downloader\nNo Watermark ✅"
        });
      } catch (err) {
        await sock.sendMessage(sender, {
          text: "Gagal download video."
        });
      }
    }
  });
}

startBot();

// ===== EXPRESS SERVER =====
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is running 🚀");
});

app.listen(PORT, () => {
  console.log("🌐 Server running on port " + PORT);
});
