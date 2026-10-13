// Orthographic globe drawn from the app's own day/night textures; shared by the launch videos.
// makeGlobe(canvas, { tilt, sun: { lat, lon }, day, night, flat }) with angles in radians and textures as image URLs.
// flat (the website) drops the edge shading and soft terminator for even light and a crisp day/night line.
// draw(lon0, sunLon) spins the globe to lon0; pass sunLon to move the day/night line.
async function makeGlobe(canvas, { tilt, sun, day, night, flat = false }) {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const loadTex = (src) =>
    new Promise((res) => {
      const i = new Image();
      i.onload = () => {
        const c = document.createElement("canvas");
        c.width = i.width; c.height = i.height;
        const x = c.getContext("2d"); x.drawImage(i, 0, 0);
        res({ d: x.getImageData(0, 0, i.width, i.height).data, w: i.width, h: i.height });
      };
      i.src = src;
    });
  const tex = { day: await loadTex(day), night: await loadTex(night) };
  const G = canvas.width, R = G / 2, ct = Math.cos(tilt), st = Math.sin(tilt);
  const ctx = canvas.getContext("2d"), img = ctx.createImageData(G, G);

  // Per-pixel latitude and longitude offset never change; only the spin (lon0) does.
  const idx = [], sl = [], cl = [], la = [], dl = [], sh = [], al = [];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const nx = (i + 0.5 - R) / R, ny = -(j + 0.5 - R) / R, r = Math.hypot(nx, ny);
    if (r > 1 + 1.5 / R) continue;
    const rr = Math.min(r, 0.99999), nz = Math.sqrt(1 - rr * rr);
    const sx = nx * (rr / (r || 1)), sy = ny * (rr / (r || 1));
    const y2 = sy * ct + nz * st, z2 = -sy * st + nz * ct;
    const lat = Math.asin(clamp(y2, -1, 1));
    idx.push((j * G + i) * 4); la.push(lat); sl.push(Math.sin(lat)); cl.push(Math.cos(lat));
    dl.push(Math.atan2(sx, z2)); sh.push(flat ? 1 : 0.42 + 0.58 * Math.pow(nz, 0.6)); al.push(clamp((1 - r) * R + 0.5));
  }
  const n = idx.length;

  return {
    size: G,
    draw(lon0, sunLon = sun.lon) {
      const o = img.data, D = tex.day.d, N = tex.night.d, TW = tex.day.w, TH = tex.day.h;
      const ss = Math.sin(sun.lat), cs = Math.cos(sun.lat);
      for (let k = 0; k < n; k++) {
        const lon = lon0 + dl[k];
        const u = ((lon / (2 * Math.PI) + 0.5) % 1 + 1) % 1;
        const tx = Math.min(TW - 1, (u * TW) | 0), ty = Math.min(TH - 1, ((0.5 - la[k] / Math.PI) * TH) | 0);
        const ti = (ty * TW + tx) * 4;
        const d = sl[k] * ss + cl[k] * cs * Math.cos(lon - sunLon);
        const m = clamp((d + 0.08) / 0.22), m2 = flat ? (d > 0 ? 1 : 0) : m * m * (3 - 2 * m);
        const dayK = (flat ? 1 : 0.5 + 0.6 * clamp(d * 1.5 + 0.35)) * m2, nightK = 1.25 * (1 - m2), s = sh[k];
        const q = idx[k];
        o[q] = (D[ti] * dayK + N[ti] * nightK) * s;
        o[q + 1] = (D[ti + 1] * dayK + N[ti + 1] * nightK) * s;
        o[q + 2] = (D[ti + 2] * dayK + N[ti + 2] * nightK + 14 * (1 - m2)) * s;
        o[q + 3] = al[k] * 255;
      }
      ctx.putImageData(img, 0, 0);
    },
    // Where a city sits on the canvas, and how much it faces the viewer (nz > 0 is the near side).
    project(latDeg, lonDeg, lon0) {
      const lat = (latDeg * Math.PI) / 180, d = (lonDeg * Math.PI) / 180 - lon0;
      const x = Math.cos(lat) * Math.sin(d), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(d);
      return { x: R + x * R, y: R - (y * ct - z * st) * R, nz: y * st + z * ct };
    },
  };
}
