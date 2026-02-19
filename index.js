const { 
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const qrcode = require("qrcode-terminal");
const fs = require("fs");

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, qr } = update;

    if (qr) {
      console.log("Scan QR di console Render logs:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("✅ Bot berhasil connect!");
    }

    if (connection === "close") {
      console.log("❌ Koneksi terputus.");
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

    if (text === "menu") {
      await sock.sendMessage(msg.key.remoteJid, { text: "Halo 👋\nmenu\nping\nowner" });
    }

    if (text === "ping") {
      await sock.sendMessage(msg.key.remoteJid, { text: "Pong 🏓 Bot aktif!" });
    }

    if (text === "owner") {
      await sock.sendMessage(msg.key.remoteJid, { text: "Owner: Riko 🔥" });
    }
  });
}

startBot();
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is running 🚀");
});

app.listen(PORT, () => {
  console.log("Web server running on port " + PORT);
});
