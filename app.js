const tg = window.Telegram.WebApp;
tg.expand();

let user = tg.initDataUnsafe.user;
let usdRate = 0;
let selectedNGN = 0;
let paymentMethod = "";
const loader = document.getElementById("loader");
const loaderText = document.getElementById("loaderText");

async function loadRate(){
  try{
    const r = await fetch("https://api.exchangerate-api.com/v4/latest/NGN");
    const d = await r.json();
    usdRate = d.rates.USD;
  }catch(e){usdRate=0.0025;}
}
loadRate();

function showLoader(msg){ loaderText.innerText=msg; loader.style.display="flex"; }
function hideLoader(){ loader.style.display="none"; }

function nextStep(n){ showStep(n); }
function prevStep(n){ showStep(n); }

function showStep(n){
  document.querySelectorAll(".step").forEach(s=>s.classList.remove("active"));
  document.getElementById("step"+n).classList.add("active");
}

function verifyPromo(){
  const pid = promoId.value.trim();
  if(!PROMO_LIST.includes(pid)){
    promoStatus.innerHTML="<span class='error'>Invalid promo ID</span>";
    return;
  }
  promoStatus.innerHTML="<span class='success'>Promo verified</span>";
  setTimeout(()=>nextStep(2),500);
}

function updatePrice(){
  if(plan.value==="7") selectedNGN=3500;
  if(plan.value==="14") selectedNGN=7000;
  if(plan.value==="forever") selectedNGN=20000;
  const usd=(selectedNGN*usdRate).toFixed(2);
  priceInfo.innerHTML=`Price: ₦${selectedNGN} ≈ $${usd}`;
}

function copyText(t){ navigator.clipboard.writeText(t); alert("Copied"); }

function selectMethod(method){
  paymentMethod=method;
  document.getElementById("bankMethod").classList.remove("active");
  document.getElementById("cryptoMethod").classList.remove("active");
  if(method==="bank") document.getElementById("bankMethod").classList.add("active");
  if(method==="crypto") document.getElementById("cryptoMethod").classList.add("active");

  document.getElementById("bankDetails").classList.add("hidden");
  document.getElementById("cryptoDetails").classList.add("hidden");
  if(method==="bank") document.getElementById("bankDetails").classList.remove("hidden");
  if(method==="crypto") document.getElementById("cryptoDetails").classList.remove("hidden");

  setTimeout(()=>nextStep(4),300);
}

async function submitPayment(){
  if(!plan.value || !proof.files[0] || !whatsapp.value || !call.value){
    alert("All fields required");
    return;
  }

  showLoader("Uploading payment proof…");
  const reader = new FileReader();
  reader.onload=async()=>{
    showLoader("Submitting payment…");
    const payload={
      buyer:user,
      promoId:promoId.value,
      plan:plan.value,
      method:paymentMethod,
      proof:reader.result,
      whatsapp:whatsapp.value,
      call:call.value,
      desc:desc.value
    };

    try{
      const res=await fetch("https://repro-hvoc.onrender.com",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      const d=await res.json();
      hideLoader();
      nextStep(6);
      finalStatus.innerHTML=d.ok
        ? "<span class='success'>Payment submitted successfully</span>"
        : "<span class='error'>"+d.error+"</span>";
    }catch(e){
      hideLoader();
      nextStep(6);
      finalStatus.innerHTML="<span class='error'>Network error, try again</span>";
    }
  };
  reader.readAsDataURL(proof.files[0]);
}