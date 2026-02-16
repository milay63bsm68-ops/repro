import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors({
  origin: "*",
  methods: ["POST", "GET"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "20mb" })); // Increased limit for large images

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

if (!TELEGRAM_TOKEN || !ADMIN_ID) {
  console.error("❌ Missing TELEGRAM_TOKEN or ADMIN_ID");
  process.exit(1);
}

// Send text message
async function sendMessage(chatId, text) {
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: Number(chatId), text })
    }
  );

  const data = await res.json();
  if (!data.ok) {
    console.error("Telegram send failed:", data);
    return false;
  }
  return true;
}

// Send photo
async function sendPhoto(chatId, base64) {
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: Number(chatId), photo: base64 })
    }
  );

  const data = await res.json();
  if (!data.ok) {
    console.error("Telegram sendPhoto failed:", data);
    return false;
  }
  return true;
}

app.post("/send", async (req, res) => {
  try {
    console.log("📥 Incoming payment:", req.body);

    const { buyer, promoId, plan, method, proof, whatsapp, call, desc } = req.body;

    if (!buyer || !promoId || !plan || !method || !proof || !whatsapp || !call) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    // Exchange rate
    let usdRate = 0.0025;
    try {
      const r = await fetch("https://api.exchangerate-api.com/v4/latest/NGN");
      const d = await r.json();
      usdRate = d.rates?.USD || usdRate;
    } catch {}

    // Pricing and earning
    let priceNGN = 0;
    let earnNGN = 0;

    if (plan === "7") { priceNGN = 3500; earnNGN = 1000; }
    if (plan === "14") { priceNGN = 7000; earnNGN = 2000; }
    if (plan === "forever") { priceNGN = 20000; earnNGN = 5000; }

    const priceUSD = (priceNGN * usdRate).toFixed(2);
    const earnUSD = (earnNGN * usdRate).toFixed(2);

    // Plan label
    let planLabel = "";
    if (plan === "7") planLabel = "7 days plan";
    else if (plan === "14") planLabel = "14 days plan";
    else if (plan === "forever") planLabel = "Forever plan";

    /* ------------------ ADMIN MESSAGE ------------------ */
    try {
      // Send screenshot first
      await sendPhoto(ADMIN_ID, proof);

      // Then send details and description
      await sendMessage(ADMIN_ID,
`🚨 NEW PREMIUM PAYMENT

Buyer: ${buyer.first_name} ${buyer.last_name || ""}
Telegram ID: ${buyer.id}

Plan: ${planLabel}
Price: ₦${priceNGN} ≈ $${priceUSD}
Payment Method: ${method}

Promo ID: ${promoId}
WhatsApp: ${whatsapp}
Call: ${call}

Description:
${desc || "N/A"}

Please review the payment and confirm.
`);
    } catch {}

    /* ------------------ BUYER MESSAGE ------------------ */
    try {
      await sendMessage(buyer.id,
`✅ Premium Payment Submitted

Plan: ${planLabel}
Price: ₦${priceNGN} ≈ $${priceUSD}
Promo ID: ${promoId}
WhatsApp: ${whatsapp}

Admin will review your payment and it might take up to 24 hours.

Contact moderator:
https://wa.me/2349114301708
`);
    } catch {}

    /* ------------------ PROMO OWNER MESSAGE ------------------ */
    try {
      await sendMessage(Number(promoId),
`🎉 Someone used your promo ID!

Buyer: ${buyer.first_name}
Plan: ${planLabel}
Price: ₦${priceNGN} ≈ $${priceUSD}

You will earn: ₦${earnNGN} ≈ $${earnUSD} when admin confirms the payment.
`);
    } catch {}

    res.json({ ok: true });

  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));