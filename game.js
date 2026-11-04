(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const $ = (selector) => document.querySelector(selector);
  const W = canvas.width, H = canvas.height, FLOOR = 444;
  const STORE_KEY = "duck-run-2d-save-v1";
  const NAMES = ["Sunny Sprint", "Berry Blitz", "Neon Nightmare"];
  const SPEEDS = [255, 278, 300];
  const THEMES = [
    { sky: "#70d9ee", far: "#b3edcf", hill: "#63c59c", ground: "#e2af62", edge: "#ffe69a", accent: "#ff639d", name: "Candy Coast" },
    { sky: "#b49cff", far: "#f1c5e9", hill: "#985ab2", ground: "#654695", edge: "#efc5ef", accent: "#ffe46b", name: "Berry Blitz" },
    { sky: "#202c67", far: "#455ca5", hill: "#304780", ground: "#222d57", edge: "#70dcff", accent: "#ff70b5", name: "Neon Night" },
    { sky: "#83e3bc", far: "#d2f0b5", hill: "#55ae87", ground: "#ba855e", edge: "#f1d29a", accent: "#ff6e78", name: "Mint Machine" }
  ];
  const DEATH_QUOTES = ["The spikes say thanks for the visit.", "A bold jump. A short career.", "The duck has filed a complaint about your timing.", "Gravity remains undefeated. For now.", "That landing was more of a suggestion.", "The course saw that coming. Next time, surprise it.", "The duck believes in you. The floor does not.", "The gap won this round. Rematch?", "At least the respawn is quick."];
  const WELL_DONE = ["Well done! The duck is doing a tiny victory dance.", "Clean landing, champion. You earned that quack.", "Course conquered! Your timing was egg-cellent.", "The spikes are jealous. Lovely run!", "Duck approved. You earned that win.", "That finish was worth every retry.", "Victory! Somewhere, a tiny duck is cheering for you."];
  const EMPTY_SAVE = { version: 1, wins: 0, rageQuits: 0, totalDeaths: 0, courses: NAMES.map(() => ({ wins: 0, deaths: 0 })) };

  let save = readSave();
  let state = "menu", practice = false, soundOn = true, audio = null;
  let level = null, course = 0, cameraX = 0, deathsThisRun = 0, checkpointIndex = 0;
  let lastTime = 0, toastTime = 0, particles = [], runCounted = false;
  const held = new Set();
  const duck = { x: 90, y: FLOOR - 36, w: 42, h: 36, vy: 0, grounded: true, coyote: 0, buffer: 0, anim: 0, crouch: false };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function int(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(list) { return list[int(0, list.length - 1)]; }

  function readSave() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!data) return structuredClone(EMPTY_SAVE);
      return { version: 1, wins: Math.max(0, Number(data.wins) || 0), rageQuits: Math.max(0, Number(data.rageQuits) || 0), totalDeaths: Math.max(0, Number(data.totalDeaths) || 0), courses: NAMES.map((_, i) => ({ wins: Math.max(0, Number(data.courses?.[i]?.wins) || 0), deaths: Math.max(0, Number(data.courses?.[i]?.deaths) || 0) })) };
    } catch { return structuredClone(EMPTY_SAVE); }
  }
  function writeSave() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(save)); } catch (_) { showToast("Could not save in this browser. Export a backup."); }
    updateStats();
  }
  function updateStats() {
    $("#statWins").textContent = $("#sideWins").textContent = save.wins;
    $("#statRageQuits").textContent = $("#sideRageQuits").textContent = save.rageQuits;
    $("#statDeaths").textContent = $("#sideDeaths").textContent = save.totalDeaths;
    save.courses.forEach((v, i) => { $("#courseDeaths" + i).textContent = v.deaths; });
    $("#levelDeaths").textContent = deathsThisRun;
  }
  function showToast(message, duration = 1700) {
    const el = $("#toast"); el.textContent = message; el.classList.add("show"); toastTime = duration / 1000;
  }
  function ensureAudio() {
    if (!soundOn) return;
    try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); } catch (_) { audio = null; }
  }
  function beep(freq, duration = .09, type = "triangle", volume = .04, slide = 0) {
    if (!soundOn) return; ensureAudio(); if (!audio) return;
    const now = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, now + duration);
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    osc.connect(gain); gain.connect(audio.destination); osc.start(now); osc.stop(now + duration);
  }

  // Generate only single hazards with generous, explicit clear space. Platforms
  // are optional scenery/routes; the continuous ground route is always available.
  function generateLevel(index) {
    const hazards = [], platforms = [];
    let x = 660;
    const sections = 9 + index * 2;
    for (let i = 0; i < sections; i++) {
      x += int(220, 310);
      const kind = int(0, index === 0 ? 3 : 4);
      if (kind <= 1) {
        const w = int(40, index === 2 ? 68 : 60);
        hazards.push({ type: "spikes", x, w }); x += w;
      } else if (kind === 2) {
        const w = int(44, 68); hazards.push({ type: "gap", x, w }); x += w;
      } else {
        const w = int(48, 65); hazards.push({ type: "vanish", x, w, phase: rand(0, Math.PI * 2) }); x += w;
      }
      if (i % 3 === 1) platforms.push({ x: x - int(100, 160), y: FLOOR - int(95, 140), w: int(90, 150), moving: i % 2 === 1, phase: rand(0, Math.PI * 2) });
    }
    const finishX = x + 420;
    const count = practice ? Math.min(5, Math.max(2, Math.floor(finishX / 1500))) : int(0, 2);
    const choices = [];
    for (let p = 950; p < finishX - 380; p += 700) choices.push(p + int(-120, 120));
    const checkpoints = [];
    while (checkpoints.length < count && choices.length) checkpoints.push(choices.splice(int(0, choices.length - 1), 1)[0]);
    checkpoints.sort((a, b) => a - b);
    return { theme: pick(THEMES), hazards, platforms, checkpoints, finishX, speed: SPEEDS[index] };
  }

  function resetDuck(x) { duck.x = x; duck.y = FLOOR - duck.h; duck.vy = 0; duck.grounded = true; duck.coyote = .12; duck.buffer = 0; duck.crouch = false; }
  function startLevel(index) {
    ensureAudio(); course = index; level = generateLevel(index); deathsThisRun = 0; checkpointIndex = 0; cameraX = 0; runCounted = false; particles = [];
    resetDuck(90); state = "playing"; $("#overlay").classList.add("hidden");
    $("#levelName").textContent = `${NAMES[index]} · ${level.theme.name}`;
    $("#checkpointLabel").textContent = `Checkpoints: ${level.checkpoints.length}`;
    $("#practiceLabel").textContent = `Practice mode: ${practice ? "on" : "off"}`;
    $("#progressBar").style.width = "0%"; updateStats();
  }
  function showOverlay(kind, title, message) {
    $("#overlay").classList.remove("hidden"); $("#overlayTitle").innerHTML = title; $("#overlayMessage").textContent = message;
    const menu = kind === "menu";
    $("#menuStats").classList.toggle("hidden", !menu); $("#levelButtons").classList.toggle("hidden", !menu);
    $("#continueButton").classList.toggle("hidden", menu);
    $("#continueButton").textContent = kind === "paused" ? "Resume run" : "Back to courses";
    updateStats();
  }
  function backToMenu() {
    if (state === "playing" || state === "paused") { save.rageQuits++; writeSave(); }
    state = "menu"; level = null; $("#levelName").textContent = "Ready?"; $("#checkpointLabel").textContent = "Checkpoints: —";
    $("#progressBar").style.width = "0%"; showOverlay("menu", "DUCK RUN <span>2D</span>", "Pick a course, learn its patterns, and keep hopping. Every run gets a fresh layout.");
  }
  function resume() { state = "playing"; $("#overlay").classList.add("hidden"); }
  function pause() {
    if (state === "playing") { state = "paused"; showOverlay("paused", "PAUSED", "Take a breath. Your run is waiting right here."); }
    else if (state === "paused") resume();
  }
  function restart() {
    if (!level || (state !== "playing" && state !== "paused")) return;
    const x = checkpointIndex ? level.checkpoints[checkpointIndex - 1] + 30 : 90;
    resetDuck(x); cameraX = Math.max(0, x - 250); particles = []; state = "playing"; $("#overlay").classList.add("hidden");
  }
  function jump() {
    if (state === "menu") { startLevel(0); return; }
    if (state === "paused") { resume(); return; }
    if (state === "finish") { backToMenu(); return; }
    if (state === "playing") duck.buffer = .14;
  }
  function particlesAt(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) particles.push({ x, y, vx: rand(-150, 150), vy: rand(-250, 20), size: rand(3, 7), life: rand(.35, .75), max: .75, color });
  }
  function die() {
    if (state !== "playing") return;
    beep(170, .15, "sawtooth", .04, 65); deathsThisRun++; save.totalDeaths++; save.courses[course].deaths++; writeSave();
    showToast(`☠ ${pick(DEATH_QUOTES)}`); particlesAt(duck.x + 20, duck.y + 15, "#ff6b91", 14);
    const x = checkpointIndex ? level.checkpoints[checkpointIndex - 1] + 30 : 90; resetDuck(x); cameraX = Math.max(0, x - 250);
  }
  function win() {
    if (state !== "playing" || runCounted) return;
    runCounted = true; state = "finish"; save.wins++; save.courses[course].wins++; writeSave();
    beep(440, .12); setTimeout(() => beep(590, .12), 100); setTimeout(() => beep(740, .2), 210);
    particlesAt(duck.x + 30, FLOOR - 50, "#ffe36c", 36); showOverlay("finish", "COURSE CLEAR!", pick(WELL_DONE));
  }
  function platformY(p, time) { return p.y + (p.moving ? Math.sin(time / 650 + p.phase) * 17 : 0); }

  function update(dt, time) {
    const toast = $("#toast");
    if (toastTime > 0 && (toastTime -= dt) <= 0) toast.classList.remove("show");
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.life -= dt; }
    if (state !== "playing" || !level) return;

    duck.anim += dt * (duck.grounded ? 13 : 5);
    duck.coyote = duck.grounded ? .12 : Math.max(0, duck.coyote - dt);
    duck.buffer = Math.max(0, duck.buffer - dt);
    if (duck.buffer > 0 && duck.coyote > 0) {
      duck.vy = -660; duck.grounded = false; duck.coyote = 0; duck.buffer = 0;
      beep(480, .09, "square", .025, 760); particlesAt(duck.x + 18, duck.y + duck.h, "#fff0a0", 4);
    }

    // The duck auto-runs. A brakes and D accelerates; both are useful for
    // adjusting approach timing without replacing the responsive jump controls.
    const pace = held.has("KeyA") ? .68 : held.has("KeyD") ? 1.28 : 1;
    const previousBottom = duck.y + duck.h;
    duck.x += level.speed * pace * dt;
    duck.vy += 1750 * dt; duck.y += duck.vy * dt; duck.grounded = false;
    const center = duck.x + duck.w / 2;
    const inGap = level.hazards.some(h => h.type === "gap" && center > h.x && center < h.x + h.w);
    if (!inGap && duck.y + duck.h >= FLOOR && duck.vy >= 0) { duck.y = FLOOR - duck.h; duck.vy = 0; duck.grounded = true; }
    for (const p of level.platforms) {
      const py = platformY(p, time), overlap = duck.x + duck.w - 5 > p.x && duck.x + 5 < p.x + p.w;
      if (overlap && previousBottom <= py + 8 && duck.y + duck.h >= py && duck.vy >= 0) { duck.y = py - duck.h; duck.vy = 0; duck.grounded = true; }
    }
    for (const h of level.hazards) {
      const overlap = duck.x + duck.w - 6 > h.x && duck.x + 6 < h.x + h.w;
      if (!overlap) continue;
      if (h.type === "gap" && center > h.x && center < h.x + h.w && duck.y + duck.h > FLOOR + 3) { die(); return; }
      if (h.type === "spikes" && duck.y + duck.h > FLOOR - 27) { die(); return; }
      if (h.type === "vanish" && Math.sin(time / 380 + h.phase) > -.15 && duck.y + duck.h > FLOOR - 8) { die(); return; }
    }
    if (duck.y > H + 80) { die(); return; }
    while (checkpointIndex < level.checkpoints.length && duck.x + duck.w >= level.checkpoints[checkpointIndex]) {
      checkpointIndex++; beep(620, .1, "triangle", .035, 900); particlesAt(duck.x + 18, FLOOR - 48, "#9ff3bb", 14);
      $("#checkpointLabel").textContent = `Checkpoint: ${checkpointIndex}/${level.checkpoints.length}`;
    }
    if (duck.x >= level.finishX) { win(); return; }
    cameraX += (Math.max(0, duck.x - 250) - cameraX) * Math.min(1, dt * 7);
    $("#progressBar").style.width = `${Math.min(100, duck.x / level.finishX * 100)}%`;
    $("#levelDeaths").textContent = deathsThisRun;
  }

  function rr(x, y, w, h, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
  function drawBackground(theme, time) {
    ctx.fillStyle = theme.sky; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = .15; ctx.fillStyle = "#fff"; for (let y = 52; y < 230; y += 42) ctx.fillRect(0, y, W, 2); ctx.globalAlpha = 1;
    for (let i = 0; i < 10; i++) { const x = ((i * 157 - cameraX * .16) % (W + 100) + W + 100) % (W + 100) - 50; const y = 75 + i % 4 * 35 + Math.sin(time / 600 + i) * 3; ctx.fillStyle = i % 2 ? "#fff3aa" : "#fff"; ctx.fillRect(x, y, 5, 5); }
    ctx.fillStyle = theme.far; for (let i = -1; i < 8; i++) { const x = i * 190 - cameraX * .23 % 190; ctx.beginPath(); ctx.ellipse(x + 80, 380, 135, 95, 0, Math.PI, 0); ctx.fill(); }
    ctx.fillStyle = theme.hill; for (let i = -1; i < 9; i++) { const x = i * 150 - cameraX * .45 % 150; ctx.beginPath(); ctx.ellipse(x + 75, 414, 108, 66, 0, Math.PI, 0); ctx.fill(); }
  }
  function drawGround(theme, time) {
    ctx.fillStyle = theme.ground; ctx.fillRect(0, FLOOR, W, H - FLOOR); ctx.fillStyle = theme.edge; ctx.fillRect(0, FLOOR, W, 9);
    const start = Math.floor(cameraX / 80) * 80;
    for (let x = start; x < cameraX + W + 80; x += 80) {
      const sx = x - cameraX, gap = level?.hazards.some(h => h.type === "gap" && x + 40 > h.x && x < h.x + h.w);
      if (!gap) { ctx.fillStyle = theme.edge; ctx.fillRect(sx + 12, FLOOR + 28, 8, 4); ctx.fillRect(sx + 49, FLOOR + 52, 5, 5); }
    }
    if (level) for (const h of level.hazards) {
      const x = h.x - cameraX;
      if (h.type === "gap") { ctx.fillStyle = "#11152f"; ctx.fillRect(x, FLOOR - 1, h.w, H - FLOOR + 1); ctx.fillStyle = theme.accent; ctx.fillRect(x, FLOOR - 4, h.w, 5); }
      if (h.type === "vanish") { ctx.globalAlpha = .25 + (Math.sin(time / 380 + h.phase) + 1) * .28; ctx.fillStyle = "#fff"; ctx.fillRect(x, FLOOR - 5, h.w, 5); ctx.globalAlpha = 1; }
    }
  }
  function drawWorld(theme, time) {
    if (!level) return;
    for (const h of level.hazards) {
      const x = h.x - cameraX; if (x + h.w < -10 || x > W + 10) continue;
      if (h.type === "spikes") {
        const count = Math.max(1, Math.ceil(h.w / 25)), sw = h.w / count;
        for (let i = 0; i < count; i++) { ctx.fillStyle = theme.accent; ctx.beginPath(); ctx.moveTo(x + i * sw, FLOOR); ctx.lineTo(x + (i + .5) * sw, FLOOR - 32); ctx.lineTo(x + (i + 1) * sw, FLOOR); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff4d8"; ctx.fillRect(x + (i + .5) * sw - 2, FLOOR - 12, 4, 3); }
      } else if (h.type === "vanish") {
        const active = Math.sin(time / 380 + h.phase) > -.15; ctx.globalAlpha = active ? .95 : .24; ctx.fillStyle = active ? theme.accent : "#fff";
        for (let k = 0; k < h.w; k += 18) ctx.fillRect(x + k + 2, FLOOR - 5, Math.min(13, h.w - k), 5); ctx.globalAlpha = 1;
      }
    }
    for (const p of level.platforms) { const x = p.x - cameraX; if (x + p.w < 0 || x > W) continue; const y = platformY(p, time); rr(x, y, p.w, 15, 5, "#3b3972"); rr(x, y, p.w, 6, 3, theme.accent); }
    level.checkpoints.forEach((cp, i) => { const x = cp - cameraX; if (x < -40 || x > W + 40) return; ctx.fillStyle = i < checkpointIndex ? "#9ff3bb" : "#fff4d2"; ctx.fillRect(x, FLOOR - 52, 5, 52); ctx.fillStyle = i < checkpointIndex ? "#70e1a1" : "#ff79ad"; ctx.beginPath(); ctx.moveTo(x + 5, FLOOR - 50); ctx.lineTo(x + 33, FLOOR - 42); ctx.lineTo(x + 5, FLOOR - 34); ctx.closePath(); ctx.fill(); });
    const finish = level.finishX - cameraX; if (finish > -60 && finish < W + 60) { ctx.fillStyle = "#fff4d2"; ctx.fillRect(finish, FLOOR - 115, 8, 115); ctx.fillStyle = "#ff70a9"; ctx.fillRect(finish + 8, FLOOR - 112, 48, 30); ctx.fillStyle = "#ffe36c"; ctx.fillRect(finish + 19, FLOOR - 103, 8, 8); }
  }
  function drawDuck() {
    const x = duck.x - cameraX, y = duck.y + (duck.grounded ? Math.sin(duck.anim) * 2 : 0);
    ctx.globalAlpha = duck.grounded ? .2 : .1; ctx.fillStyle = "#10142b"; ctx.beginPath(); ctx.ellipse(x + 20, FLOOR + 3, duck.grounded ? 22 : 14, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    rr(x + 3, y + 10, 29, 23, 10, "#ffda57"); rr(x + 17, y + 1, 21, 21, 9, "#ffe66d");
    ctx.fillStyle = "#ff9b3d"; ctx.beginPath(); ctx.moveTo(x + 35, y + 10); ctx.lineTo(x + 47, y + 14); ctx.lineTo(x + 35, y + 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#262344"; ctx.fillRect(x + 30, y + 7, 3, 4); ctx.fillStyle = "#fff"; ctx.fillRect(x + 31, y + 7, 1, 1); ctx.fillStyle = "#f2bc36"; ctx.fillRect(x + 20, y - 2, 7, 4);
    const kick = duck.grounded ? Math.sin(duck.anim * 1.7) * 3 : 1; ctx.fillStyle = "#ef783d"; ctx.fillRect(x + 10, y + 30, 8, 4 + kick); ctx.fillRect(x + 24, y + 30, 8, 4 - kick);
  }
  function draw(time) {
    const theme = level?.theme || THEMES[0]; drawBackground(theme, time); drawGround(theme, time); drawWorld(theme, time);
    if (level) drawDuck();
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x - cameraX, p.y, p.size, p.size); } ctx.globalAlpha = 1;
  }
  function frame(time) { const dt = Math.min(.033, Math.max(0, (time - lastTime) / 1000)); lastTime = time; update(dt, time); draw(time); requestAnimationFrame(frame); }

  document.addEventListener("keydown", event => {
    if (["Space", "ArrowUp", "ArrowDown"].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    if (["Space", "ArrowUp", "KeyW"].includes(event.code)) jump();
    else if (event.code === "KeyR") restart();
    else if (event.code === "Escape") pause();
    else if (event.code === "Digit1") startLevel(0);
    else if (event.code === "Digit2") startLevel(1);
    else if (event.code === "Digit3") startLevel(2);
  });
  document.addEventListener("keyup", event => held.delete(event.code));
  window.addEventListener("blur", () => { held.clear(); if (state === "playing") pause(); });
  canvas.addEventListener("pointerdown", () => { if (state === "paused") resume(); else jump(); });
  document.querySelectorAll("[data-level]").forEach(button => button.addEventListener("click", () => startLevel(Number(button.dataset.level))));
  $("#menuButton").addEventListener("click", backToMenu);
  $("#continueButton").addEventListener("click", () => state === "paused" ? resume() : backToMenu());
  $("#practiceToggle").addEventListener("change", event => { practice = event.target.checked; $("#practiceLabel").textContent = `Practice mode: ${practice ? "on" : "off"}`; });
  $("#soundButton").addEventListener("click", () => { soundOn = !soundOn; $("#soundButton").textContent = soundOn ? "🔊 Sound on" : "🔇 Sound off"; $("#soundButton").setAttribute("aria-pressed", String(soundOn)); if (soundOn) beep(500, .07); });
  $("#exportButton").addEventListener("click", () => { const blob = new Blob([JSON.stringify({ ...save, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "duck-run-2d-save.json"; a.click(); URL.revokeObjectURL(url); });
  $("#importInput").addEventListener("change", async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { const data = JSON.parse(await file.text()); if (!Array.isArray(data.courses)) throw new Error("That file is not a Duck Run save."); save = { version: 1, wins: Math.max(0, Number(data.wins) || 0), rageQuits: Math.max(0, Number(data.rageQuits) || 0), totalDeaths: Math.max(0, Number(data.totalDeaths) || 0), courses: NAMES.map((_, i) => ({ wins: Math.max(0, Number(data.courses[i]?.wins) || 0), deaths: Math.max(0, Number(data.courses[i]?.deaths) || 0) })) }; writeSave(); showToast("Save imported!"); }
    catch (error) { showToast(error.message || "Could not import that save."); } event.target.value = "";
  });
  $("#resetButton").addEventListener("click", () => { if (!confirm("Reset all saved stats? Export a backup first if you want to keep them.")) return; save = structuredClone(EMPTY_SAVE); writeSave(); showToast("Stats reset."); });

  updateStats(); $("#overlay").classList.remove("hidden"); requestAnimationFrame(frame);
})();
