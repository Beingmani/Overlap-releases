// Live parts of the Overlap website: the globe, the clock cards and the planner all run on the visitor's real time,
// using the app's rules (day parts by local hour, awake 7am to 11pm) and its palette.
const PART = {
  morning: { color: "#F4B740", soft: "#FCEFD2", deep: "#8A5A00", label: "Morning" },
  afternoon: { color: "#3DB4EE", soft: "#D9F0FC", deep: "#0B6A99", label: "Afternoon" },
  evening: { color: "#F7845A", soft: "#FDE3D8", deep: "#A3401B", label: "Evening" },
  night: { color: "#8088F2", soft: "#E3E5FD", deep: "#3D45B8", label: "Night" },
  asleep: { color: "#9AA1AE", soft: "#E8EAEE", deep: "#4B5260", label: "Asleep" },
};
const FRIENDS = [
  { name: "Sam", city: "San Francisco", zone: "America/Los_Angeles", lat: 37.77, lon: -122.42, av: ["#C7C2F4", "#2C2566"] },
  { name: "Diego", city: "São Paulo", zone: "America/Sao_Paulo", lat: -23.55, lon: -46.63, av: ["#AEE3CC", "#12402D"] },
  { name: "Anna", city: "Berlin", zone: "Europe/Berlin", lat: 52.52, lon: 13.4, av: ["#DEC0EA", "#45204F"] },
  { name: "Amara", city: "Lagos", zone: "Africa/Lagos", lat: 6.52, lon: 3.38, av: ["#C9DDAF", "#2E3C15"] },
  { name: "Priya", city: "Bengaluru", zone: "Asia/Kolkata", lat: 12.97, lon: 77.59, av: ["#F8C6A4", "#5A2B0C"] },
  { name: "Kenji", city: "Tokyo", zone: "Asia/Tokyo", lat: 35.68, lon: 139.69, av: ["#B2D8F3", "#10324C"] },
];
const WAKE = 7 * 60, SLEEP = 23 * 60;
const MY_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function localMinutes(zone, at = new Date()) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  return +p.find((x) => x.type === "hour").value * 60 + +p.find((x) => x.type === "minute").value;
}
function partAt(m) {
  if (m < WAKE || m >= SLEEP) return "asleep";
  const h = m / 60;
  return h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
}
function clockParts(zone, at = new Date()) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).formatToParts(at);
  const get = (t) => (p.find((x) => x.type === t) || {}).value || "";
  return { t: `${get("hour")}:${get("minute")}`, ap: get("dayPeriod") };
}
function chip(part) {
  const p = PART[part];
  return `<span class="pill" style="background:${p.soft};color:${p.deep}"><i style="background:${p.color}"></i>${p.label}</span>`;
}
// The app's day ring: the awake arc in the colour of their part of the day, and a dot for where they are in it.
function ring(f, size, at = new Date()) {
  const m = localMinutes(f.zone, at), part = partAt(m), r = size / 2 - 3, c = 2 * Math.PI * r, h = size / 2;
  const a = (m / 1440) * 2 * Math.PI - Math.PI / 2, x = h + r * Math.cos(a), y = h + r * Math.sin(a);
  return `<span class="ring" style="width:${size}px;height:${size}px" aria-hidden="true"><svg viewBox="0 0 ${size} ${size}">
    <circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="var(--track)" stroke-width="3"/>
    <circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="${PART[part].color}" stroke-width="3" stroke-linecap="round"
      stroke-dasharray="${(c * (SLEEP - WAKE)) / 1440} ${c}" transform="rotate(${(WAKE / 1440) * 360 - 90} ${h} ${h})"/>
    <circle cx="${x}" cy="${y}" r="4.5" fill="${PART[part].color}" stroke="var(--ring-bg, var(--card))" stroke-width="2"/></svg>
    <b style="background:${f.av[0]};color:${f.av[1]};inset:${size * 0.16}px;font-size:${Math.round(size * 0.3)}px">${f.name[0]}</b></span>`;
}

// ---- Hero globe: the sun where it really is, friends pinned with their live time ----
async function startGlobe() {
  const canvas = document.getElementById("globe-canvas");
  if (!canvas || typeof makeGlobe !== "function") return;
  const now = new Date(), utcH = now.getUTCHours() + now.getUTCMinutes() / 60;
  const doy = (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(now.getUTCFullYear(), 0, 0)) / 864e5;
  const sun = { lat: ((23.44 * Math.sin((2 * Math.PI * (doy - 81)) / 365)) * Math.PI) / 180, lon: (-(utcH - 12) * 15 * Math.PI) / 180 };
  const globe = await makeGlobe(canvas, { tilt: 0.38, sun, day: "globe/earth-day.jpg", night: "globe/earth-night.jpg", flat: true });
  const layer = document.getElementById("pins"), space = canvas.closest(".space") || canvas;
  const pins = FRIENDS.map((f) => { const el = document.createElement("div"); el.className = "pin"; layer.appendChild(el); return { f, el }; });
  const paint = () => pins.forEach(({ f, el }) => {
    const { t, ap } = clockParts(f.zone);
    el.innerHTML = `<span class="dot" style="background:${f.av[0]}"></span><span class="pin-card">${ring(f, 30)}<span class="t">${t} ${ap}<small>${f.name} · ${f.city}</small></span>${chip(partAt(localMinutes(f.zone)))}</span>`;
  });
  paint();
  setInterval(paint, 30000);

  const scale = () => canvas.getBoundingClientRect().width / canvas.width;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Start just east of noon so the daylit side faces the visitor, with the evening edge in view.
  let visible = true, last = 0, lon = sun.lon + 0.35;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  const frame = (ts) => {
    if (visible && ts - last > 40) {
      if (last && !still) lon -= ((ts - last) / 1000) * 0.06;
      last = ts;
      globe.draw(lon);
      const k = scale(), sr = canvas.getBoundingClientRect(), fr = space.getBoundingClientRect();
      const box = { left: fr.left - sr.left, right: fr.right - sr.left };  // the card's edges, in stage pixels
      pins.forEach(({ f, el }) => {
        const { x, y, nz } = globe.project(f.lat, f.lon, lon);
        el.style.opacity = Math.max(0, Math.min(1, (nz - 0.3) / 0.15));
        // Put the label on whichever side of the pin has room inside the dark card.
        const card = el.lastElementChild, w = card ? card.offsetWidth + 24 : 0, px = x * k;
        const fitsRight = px + w <= box.right, fitsLeft = px - w >= box.left;
        el.classList.toggle("flip", fitsLeft && (!fitsRight || x > globe.size * 0.6));
        el.style.transform = `translate(${x * k}px, ${y * k}px)`;
      });
    }
    if (!still || !last) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  if (still) addEventListener("resize", () => { last = 0; requestAnimationFrame(frame); });
}

// ---- Clock cards ----
function paintClocks() {
  const row = document.getElementById("clock-cards");
  if (!row) return;
  const now = new Date(), mine = localMinutes(MY_ZONE, now);
  row.innerHTML = FRIENDS.filter((f) => f.name !== "Amara").map((f) => {
    const m = localMinutes(f.zone, now), p = PART[partAt(m)], { t, ap } = clockParts(f.zone, now);
    const off = Math.round(((((m - mine) % 1440) + 2160) % 1440 - 720) / 30) / 2;
    return `<div class="clock" style="background:${p.soft};color:${p.deep}">
      <div class="top">${ring(f, 40, now)}<div><strong>${f.name}</strong><small>${f.city}</small></div></div>
      <div class="time">${t}<sup>${ap}</sup></div>
      <div class="clock-foot"><span>${off === 0 ? "Your time" : `${off > 0 ? "+" : "−"}${Math.abs(off)}h`}</span>${chip(partAt(m))}</div></div>`;
  }).join("");
}

// ---- Planner: today in the visitor's time, everyone's day by part, the best hour picked out ----
function paintPlanner() {
  const grid = document.getElementById("planner");
  if (!grid) return;
  const now = new Date(), start = new Date(now); start.setHours(0, 0, 0, 0);
  const people = [{ name: "You", city: "Your time", zone: MY_ZONE, you: true }, ...FRIENDS.filter((f) => f.name !== "Kenji")];
  const ROW = 58, Q = 96, awake = new Array(Q).fill(0);
  const hr = (h) => (h % 12 === 0 ? (h % 24 === 0 ? "12a" : "12p") : `${h % 12}${h < 12 ? "a" : "p"}`);
  let html = `<div></div><div class="ticks">${[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => `<span class="${h % 6 ? "minor" : ""}">${hr(h)}</span>`).join("")}</div>`;
  let lanes = "";
  people.forEach((f, i) => {
    const avatar = f.you ? `<span class="ring" style="width:40px;height:40px"><b style="inset:4px;background:var(--accent-soft);color:var(--accent);font-size:12px">You</b></span>` : ring(f, 40, now);
    html += `<div class="who" style="grid-column:1;grid-row:${i + 2}">${avatar}<div><strong>${f.name}</strong><small>${f.city}</small></div></div>`;
    const segs = [];
    for (let q = 0; q < Q; q++) {
      const p = partAt(localMinutes(f.zone, new Date(start.getTime() + q * 9e5)));
      if (p !== "asleep") awake[q]++;
      const s = segs[segs.length - 1];
      if (s && s.p === p) s.b = q + 1; else segs.push({ p, a: q, b: q + 1 });
    }
    lanes += `<div class="lane" style="top:${i * ROW}px">${segs.map((s) => `<span class="bar" style="left:calc(${(s.a / Q) * 100}% + 1.5px);width:calc(${((s.b - s.a) / Q) * 100}% - 3px);background:${s.p === "asleep" ? "var(--sleep)" : PART[s.p].color}"></span>`).join("")}</div>`;
  });
  let best = -1, bq = 0;
  for (let q = 0; q <= Q - 4; q++) { const s = awake[q] + awake[q + 1] + awake[q + 2] + awake[q + 3]; if (s > best) { best = s; bq = q; } }
  const at = (q) => new Date(start.getTime() + q * 9e5).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const nowQ = (now - start) / 9e5;
  html += `<div class="lanes" style="grid-column:2;grid-row:2 / span ${people.length};height:${people.length * ROW}px">
    <span class="bestband" style="left:${(bq / Q) * 100}%;width:${(4 / Q) * 100}%"></span>${lanes}
    <span class="nowline" style="left:${(nowQ / Q) * 100}%"><span>Now</span></span></div>`;
  grid.innerHTML = html;
  document.getElementById("best").textContent = `${at(bq)} – ${at(bq + 4)}`;
  document.getElementById("legend").innerHTML = Object.keys(PART).map(chip).join("");
}

// The day parts under the globe, as in the app's legend.
const spaceLegend = document.getElementById("space-legend");
if (spaceLegend) spaceLegend.innerHTML = Object.keys(PART).map(chip).join("");

startGlobe();
paintClocks();
paintPlanner();
setInterval(() => { paintClocks(); paintPlanner(); }, 30000);
