import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

if (!TELEGRAM_TOKEN || !ADMIN_ID) {
  console.error("❌ Missing TELEGRAM_TOKEN or ADMIN_ID");
  process.exit(1);
}

async function sendMessage(chatId, text) {
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: Number(chatId),
        text
      })
    }
  );

  const data = await res.json();
  if (!data.ok) {
    console.error("Telegram error:", data);
    throw new Error("Telegram send failed");
  }
}

app.post("/send", async (req, res) => {
  try {
    console.log("📥 Incoming payment:", req.body);

    const { buyer, promoId, plan, method, proof, whatsapp, call, desc } = req.body;

    if (!buyer || !promoId || !plan || !method || !proof || !whatsapp || !call) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    let usdRate = 0.0025;
    try {
      const r = await fetch("https://api.exchangerate-api.com/v4/latest/NGN");
      const d = await r.json();
      usdRate = d.rates?.USD || usdRate;
    } catch {}

    let priceNGN = 0;
    let earnNGN = 0;

    if (plan === "7") { priceNGN = 3500; earnNGN = 1000; }
    if (plan === "14") { priceNGN = 7000; earnNGN = 2000; }
    if (plan === "forever") { priceNGN = 20000; earnNGN = 5000; }

    const priceUSD = (priceNGN * usdRate).toFixed(2);
    const earnUSD = (earnNGN * usdRate).toFixed(2);

    // BUYER MESSAGE
    await sendMessage(buyer.id, 
`✅ Premium Payment Submitted

Plan: ${plan}
Price: ₦${priceNGN} ≈ $${priceUSD}
Promo ID: ${promoId}
WhatsApp: ${whatsapp}

Contact moderator:
https://wa.me/2349114301708
`);

    // ADMIN MESSAGE
    await sendMessage(ADMIN_ID,
`🚨 NEW PREMIUM PAYMENT

Buyer: ${buyer.first_name} ${buyer.last_name || ""}
Telegram ID: ${buyer.id}

Plan: ${plan}
Price: ₦${priceNGN} ≈ $${priceUSD}
Payment: ${method}

Promo ID: ${promoId}
WhatsApp: ${whatsapp}
Call: ${call}

Description:
${desc || "N/A"}
`);

    // PROMO OWNER MESSAGE
    await sendMessage(Number(promoId),
`🎉 Someone used your promo ID!

Buyer: ${buyer.first_name}
Plan: ${plan}
Price: ₦${priceNGN} ≈ $${priceUSD}

Your earning:
₦${earnNGN} ≈ $${earnUSD}
`);

    res.json({ ok: true });

  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));