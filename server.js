import express from "express";
import fetch from "node-fetch"; // npm i node-fetch
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // allow large base64 images

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; // your bot token
const ADMIN_ID = process.env.ADMIN_ID;             // your Telegram admin ID

// Helper function to send Telegram messages
async function sendMessage(chatId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...extra })
  });
  return res.json();
}

// Optional: send photo (payment screenshot)
async function sendPhoto(chatId, photoBase64, caption = "") {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`;
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("photo", photoBase64);
  formData.append("caption", caption);

  const res = await fetch(url, {
    method: "POST",
    body: formData
  });
  return res.json();
}

// Main endpoint
app.post("/send", async (req, res) => {
  try {
    const { buyer, promoId, plan, method, proof, whatsapp, call, desc } = req.body;

    if (!buyer || !promoId || !plan || !method || !proof || !whatsapp || !call) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    // Convert NGN → USD (fetch latest rate)
    let usdRate = 0.0025; // fallback
    try {
      const r = await fetch("https://api.exchangerate-api.com/v4/latest/NGN");
      const d = await r.json();
      usdRate = d.rates.USD || usdRate;
    } catch {}

    // Determine plan price and promo earnings
    let planPriceNGN = 0;
    let promoEarnNGN = 0;
    if (plan === "7") { planPriceNGN = 3500; promoEarnNGN = 1000; }
    else if (plan === "14") { planPriceNGN = 7000; promoEarnNGN = 2000; }
    else if (plan === "forever") { planPriceNGN = 20000; promoEarnNGN = 5000; }

    const planPriceUSD = (planPriceNGN * usdRate).toFixed(2);
    const promoEarnUSD = (promoEarnNGN * usdRate).toFixed(2);

    // Messages
    const buyerMsg = `
✅ You selected plan: ${plan} 
Price: ₦${planPriceNGN} ≈ $${planPriceUSD}
Promo ID: ${promoId}
WhatsApp: ${whatsapp}
Contact moderator: https://wa.me/2349114301708
`;

    const adminMsg = `
⚠️ New premium payment alert
Buyer: ${buyer.first_name} ${buyer.last_name || ""}
Plan: ${plan} 
Price: ₦${planPriceNGN} ≈ $${planPriceUSD}
Payment Method: ${method}
Promo ID: ${promoId}
WhatsApp: ${whatsapp}
Call: ${call}
Description: ${desc}
`;

    const promoMsg = `
🎉 ${buyer.first_name} bought premium with your promo ID!
Plan: ${plan}
Price: ₦${planPriceNGN} ≈ $${planPriceUSD}
You will earn: ₦${promoEarnNGN} ≈ $${promoEarnUSD}
`;

    // Send messages
    await sendMessage(buyer.id, buyerMsg);
    await sendMessage(ADMIN_ID, adminMsg);
    await sendMessage(promoId, promoMsg);

    // Optional: send screenshot to admin
    // Telegram expects a Buffer or URL, for base64 we convert to Buffer
    /*
    const base64Data = proof.replace(/^data:image\/\w+;base64,/, "");
    const buf = Buffer.from(base64Data, "base64");
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
      method:"POST",
      body: (() => {
        const fd = new FormData();
        fd.append("chat_id", ADMIN_ID);
        fd.append("photo", buf, { filename: "proof.png" });
        return fd;
      })()
    });
    */

    return res.json({ ok: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));