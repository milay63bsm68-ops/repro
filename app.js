const tg = window.Telegram.WebApp;
tg.expand();

let user = tg.initDataUnsafe.user;
let usdRate = 0;
let selectedNGN = 0;
let paymentMethod = "";

const loader = document.getElementById("loader");
const loaderText = document.getElementById("loaderText");

async function loadRate() {
  try {
    const r = await fetch("https://api.exchangerate-api.com/v4/latest/NGN");
    const d = await r.json();
    usdRate = d.rates.USD;
  } catch {
    usdRate = 0.0025;
  }
}
loadRate();

function showLoader(msg) {
  loaderText.innerText = msg;
  loader.style.display = "flex";
}
function hideLoader() {
  loader.style.display = "none";
}

function nextStep(n) { showStep(n); }
function prevStep(n) { showStep(n); }

function showStep(n) {
  document.querySelectorAll(".step").forEach(s => s.classList.remove("active"));
  document.getElementById("step" + n).classList.add("active");
}

function verifyPromo() {
  const pid = promoId.value.trim();
  if (!pid || !PROMO_LIST.includes(pid)) {
    promoStatus.innerHTML = "<span class='error'>Invalid promo ID</span>";
    return;
  }
  promoStatus.innerHTML = "<span class='success'>Promo verified</span>";
  setTimeout(() => nextStep(2), 500);
}

function updatePrice() {
  if (plan.value === "7") selectedNGN = 3500;
  if (plan.value === "14") selectedNGN = 7000;
  if (plan.value === "forever") selectedNGN = 20000;

  const usd = (selectedNGN * usdRate).toFixed(2);
  priceInfo.innerHTML = `Price: ₦${selectedNGN} ≈ $${usd}`;
}

function copyText(t) {
  navigator.clipboard.writeText(t);
  alert("Copied");
}

function selectMethod(method) {
  paymentMethod = method;

  bankMethod.classList.remove("active");
  cryptoMethod.classList.remove("active");

  if (method === "bank") bankMethod.classList.add("active");
  if (method === "crypto") cryptoMethod.classList.add("active");

  bankDetails.classList.add("hidden");
  cryptoDetails.classList.add("hidden");

  if (method === "bank") bankDetails.classList.remove("hidden");
  if (method === "crypto") cryptoDetails.classList.remove("hidden");

  setTimeout(() => nextStep(4), 300);
}

async function submitPayment() {
  if (!user || !user.id) {
    alert("Please open this page inside Telegram");
    return;
  }

  if (!paymentMethod) {
    alert("Please select a payment method");
    return;
  }

  if (!plan.value || !proof.files[0] || !whatsapp.value || !call.value) {
    alert("All fields required");
    return;
  }

  const file = proof.files[0];
  if (file.size > 5 * 1024 * 1024) {
    alert("Image must be under 5MB");
    return;
  }

  const promo = promoId.value.trim();
  if (!promo || isNaN(promo)) {
    alert("Invalid Promo ID");
    return;
  }

  showLoader("Uploading payment proof…");

  const reader = new FileReader();
  reader.onload = async () => {
    showLoader("Submitting payment…");

    const payload = {
      buyer: user,
      promoId: promo,
      plan: plan.value,
      method: paymentMethod,
      proof: reader.result,
      whatsapp: whatsapp.value,
      call: call.value,
      desc: desc.value
    };

    try {
      const res = await fetch("https://repro-1-rxqj.onrender.com/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const d = await res.json();
      hideLoader();
      nextStep(6);

      if (d.ok) {
        finalStatus.innerHTML = "<span class='success'>Payment submitted successfully ✅</span>";
      } else {
        finalStatus.innerHTML = `<span class='error'>Failed to submit payment: ${d.error || "Unknown error"}</span>`;
      }

    } catch (e) {
      hideLoader();
      nextStep(6);
      finalStatus.innerHTML = "<span class='error'>Network error, please try again 🌐</span>";
    }
  };

  reader.readAsDataURL(file);
}