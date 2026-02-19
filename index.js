import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys";
import express from "express";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection } = update;
    if (connection === "open") {
      console.log("✅ Bot connected to WhatsApp");
    }
  });

  if (!state.creds.registered) {
    const code = await sock.requestPairingCode("62881023660529");
    console.log("PAIRING CODE:", code);
  }
}

startBot();

// ==== EXPRESS SERVER (WAJIB UNTUK RENDER) ====
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is running 🚀");
});

app.listen(PORT, () => {
  console.log("Web server running on port " + PORT);
});
