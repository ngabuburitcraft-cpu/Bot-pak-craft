import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys";
import express from "express";
import pino from "pino";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    auth: state,
    browser: ["Ubuntu", "Chrome", "20.0.04"]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "connecting") {
      console.log("🔄 Connecting to WhatsApp...");
    }

    if (connection === "open") {
      console.log("✅ Bot connected to WhatsApp");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log("❌ Connection closed. Reconnecting:", shouldReconnect);

      if (shouldReconnect) {
        startBot();
      }
    }
  });

  // 🔥 DELAY PAIRING (ANTI PRECONDITION ERROR)
  setTimeout(async () => {
    if (!state.creds.registered) {
      try {
        console.log("📲 Requesting pairing code...");
        const code = await sock.requestPairingCode("62881023660529");
        console.log("🔑 PAIRING CODE:", code);
      } catch (err) {
        console.log("❌ Pairing Error:", err?.message || err);
      }
    }
  }, 7000);
}

startBot();


// ===== WAJIB UNTUK RENDER (JANGAN HAPUS) =====
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is running 🚀");
});

app.listen(PORT, () => {
  console.log("🌐 Web server running on port " + PORT);
});
