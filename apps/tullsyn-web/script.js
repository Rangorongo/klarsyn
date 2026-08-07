// Tullsyn — mörka sidans animationer
// Fyra delar: scroll-intoning, uppräknande siffror, hero-demon och
// nätverksvisualiseringen (canvas). Inga bibliotek — bara webbläsaren.

const reduceradRorelse = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// --- 1. Scroll-intoning ---
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

// --- 2. Uppräknande siffror ---
function raknaUpp(el) {
  const mal = parseInt(el.dataset.count, 10);
  const suffix = el.dataset.suffix || "";
  if (reduceradRorelse) { el.textContent = mal + suffix; return; }
  const start = performance.now();
  const tid = 1400;

  function steg(nu) {
    const p = Math.min((nu - start) / tid, 1);
    const easing = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(mal * easing) + suffix;
    if (p < 1) requestAnimationFrame(steg);
  }
  requestAnimationFrame(steg);
}

const statObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        raknaUpp(entry.target);
        statObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.5 }
);
document.querySelectorAll(".stat-value[data-count]").forEach((el) => statObserver.observe(el));

// --- 3. Hero-demon: rader granskas, domar landar, summan räknas upp ---
const demoRader = [
  { namn: "Elektronikkort, PCB", farg: "var(--gron)", dom: "godkänd" },
  { namn: "Polypropylengranulat", farg: "var(--gron)", dom: "godkänd" },
  { namn: "Strömförsörjning 24V", farg: "var(--rod)", dom: "felklassificerad" },
  { namn: "Mikroprocessor ARM", farg: "var(--gul)", dom: "bör granskas" },
  { namn: "Kablar, koppar", farg: "var(--gron)", dom: "godkänd" },
];

const demoHost = document.getElementById("demo-rows");
const demoStatus = document.getElementById("demo-status");
const demoSum = document.getElementById("demo-sum");

function korDemo() {
  if (!demoHost) return;
  demoHost.innerHTML = "";

  const divs = demoRader.map((rad) => {
    const div = document.createElement("div");
    div.className = "demo-row";
    div.innerHTML =
      '<span class="demo-dot"></span>' +
      '<span class="demo-name">' + rad.namn + "</span>" +
      '<span class="demo-verdict"></span>';
    demoHost.appendChild(div);
    return div;
  });

  let i = 0;
  // 6 240 kr — realistisk möjlig återbetalning för en faktura där en av
  // fem varurader visar sig felklassificerad. Räknas i ören mot decimalfel.
  const malBelopp = 624000;
  const kronFormat = new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function nastaRad() {
    if (i < divs.length) {
      const div = divs[i];
      const rad = demoRader[i];
      div.classList.add("visible");
      setTimeout(() => {
        const dot = div.querySelector(".demo-dot");
        dot.style.background = rad.farg;
        dot.style.boxShadow = "0 0 10px " + rad.farg;
        div.querySelector(".demo-verdict").textContent = rad.dom;
      }, 380);
      i++;
      demoStatus.textContent = "rad " + i + " av " + divs.length;
      setTimeout(nastaRad, 620);
    } else {
      requestAnimationFrame(raknaSumma);
    }
  }

  let sumStart = null;
  function raknaSumma(nu) {
    if (!sumStart) sumStart = nu;
    const p = Math.min((nu - sumStart) / 1500, 1);
    const easing = 1 - Math.pow(1 - p, 3);
    const oren = Math.round(malBelopp * easing);
    demoSum.textContent = kronFormat.format(oren / 100) + " kr";
    if (p < 1) {
      requestAnimationFrame(raknaSumma);
    } else {
      setTimeout(() => {
        sumStart = null;
        demoSum.textContent = "0,00 kr";
        demoStatus.textContent = "rad 0 av 5";
        korDemo();
      }, 4500);
    }
  }

  setTimeout(nastaRad, 600);
}

if (reduceradRorelse && demoHost) {
  // Utan rörelse: visa slutläget direkt
  demoRader.forEach((rad) => {
    const div = document.createElement("div");
    div.className = "demo-row visible";
    div.innerHTML =
      '<span class="demo-dot" style="background:' + rad.farg + '"></span>' +
      '<span class="demo-name">' + rad.namn + "</span>" +
      '<span class="demo-verdict">' + rad.dom + "</span>";
    demoHost.appendChild(div);
  });
  demoSum.textContent = "6 240,00 kr";
  demoStatus.textContent = "5 av 5 granskade";
} else {
  korDemo();
}

// --- 4. Nätverksvisualisering i heron (à la inspirationen) ---
// Noder som driver långsamt och binds ihop med linjer när de är nära —
// en visuell metafor för fakturarader som kopplas mot tulltaxan.
const canvas = document.getElementById("natverk");
if (canvas && !reduceradRorelse) {
  const ctx = canvas.getContext("2d");
  let noder = [];
  let bredd, hojd;

  function storlek() {
    const rect = canvas.parentElement.getBoundingClientRect();
    bredd = canvas.width = rect.width;
    hojd = canvas.height = rect.height;
  }

  function skapaNoder() {
    const antal = Math.min(55, Math.floor(bredd / 26));
    noder = Array.from({ length: antal }, () => ({
      x: Math.random() * bredd,
      y: Math.random() * hojd,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: 1 + Math.random() * 1.8,
    }));
  }

  function rita() {
    ctx.clearRect(0, 0, bredd, hojd);

    for (const n of noder) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > bredd) n.vx *= -1;
      if (n.y < 0 || n.y > hojd) n.vy *= -1;
    }

    for (let a = 0; a < noder.length; a++) {
      for (let b = a + 1; b < noder.length; b++) {
        const dx = noder[a].x - noder[b].x;
        const dy = noder[a].y - noder[b].y;
        const avstand = Math.hypot(dx, dy);
        if (avstand < 130) {
          ctx.strokeStyle = "rgba(47, 208, 140, " + (0.14 * (1 - avstand / 130)) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(noder[a].x, noder[a].y);
          ctx.lineTo(noder[b].x, noder[b].y);
          ctx.stroke();
        }
      }
    }

    for (const n of noder) {
      ctx.fillStyle = "rgba(147, 166, 187, 0.5)";
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(rita);
  }

  storlek();
  skapaNoder();
  rita();
  window.addEventListener("resize", () => { storlek(); skapaNoder(); });
}
