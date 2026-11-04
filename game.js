(() => {
  "use strict";
  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const $ = (s) => document.querySelector(s);
  const W = canvas.width, H = canvas.height, FLOOR = 444;
  const SAVE_KEY = "duck-run-2d-save-v2";
  const DIFFICULTIES = {
    easy: { name: "Easy", speed: 220, hazardRate: .36, width: .72 },
    mid: { name: "Mid", speed: 265, hazardRate: .54, width: 1 },
    hard: { name: "Hard", speed: 310, hazardRate: .72, width: 1.14 },
    rage: { name: "RageQuit", speed: 360, hazardRate: .88, width: 1.28 }
  };
  const LENGTHS = { short: { name: "Short", seconds: 45 }, mid: { name: "Mid", seconds: 90 }, long: { name: "Long", seconds: 150 }, ultra: { name: "Ultra Long", seconds: 300 } };
  const THEMES = [
    { sky: "#70d9ee", far: "#b3edcf", hill: "#63c59c", ground: "#e2af62", edge: "#ffe69a", accent: "#ff639d", name: "Candy Coast" },
    { sky: "#b49cff", far: "#f1c5e9", hill: "#985ab2", ground: "#654695", edge: "#efc5ef", accent: "#ffe46b", name: "Berry Blitz" },
    { sky: "#202c67", far: "#455ca5", hill: "#304780", ground: "#222d57", edge: "#70dcff", accent: "#ff70b5", name: "Neon Night" },
    { sky: "#83e3bc", far: "#d2f0b5", hill: "#55ae87", ground: "#ba855e", edge: "#f1d29a", accent: "#ff6e78", name: "Mint Machine" }
  ];
  const DEATH_QUOTES = ["The spikes say thanks for the visit.", "A bold jump. A short career.", "The duck has filed a complaint about your timing.", "Gravity remains undefeated. For now.", "That landing was more of a suggestion.", "The course saw that coming. Next time, surprise it.", "The duck believes in you. The floor does not.", "The gap won this round. Rematch?", "At least the respawn is quick."];
  const WELL_DONE = ["Well done! The duck is doing a tiny victory dance.", "Clean landing, champion. You earned that quack.", "Course conquered! Your timing was egg-cellent.", "The spikes are jealous. Lovely run!", "Duck approved. You earned that win.", "That finish was worth every retry.", "Victory! Somewhere, a tiny duck is cheering for you."];
  const BADGES = [
    { id: "first-win", name: "First Quack", test: (r) => r.won },
    { id: "flawless", name: "Feather Perfect", test: (r) => r.won && r.deaths === 0 },
    { id: "rage-ultra", name: "RageQuit Marathon", test: (r) => r.won && r.difficulty === "rage" && r.length === "ultra" },
    { id: "ultra", name: "Long Haul", test: (r) => r.won && r.length === "ultra" },
    { id: "survivor", name: "Still Quacking", test: (r) => r.won && r.deaths >= 10 }
  ];
  const EMPTY_SAVE = { version: 2, wins: 0, rageQuits: 0, totalDeaths: 0, badges: [] };
  const clone = (x) => typeof structuredClone === "function" ? structuredClone(x) : JSON.parse(JSON.stringify(x));

  let save = readSave();
  let state = "menu", practice = false, soundOn = true, audio = null;
  let level = null, cameraX = 0, deaths = 0, checkpointIndex = 0, invulnerable = 0;
  let difficultyKey = "mid", lengthKey = "mid", lastTime = 0, musicTimer = null, beat = 0;
  let toastSeconds = 0, particles = [], runCounted = false, runStartedAt = 0;
  const held = new Set();
  const duck = { x: 110, y: FLOOR - 38, w: 42, h: 38, vy: 0, grounded: true, coyote: 0, jumpBuffer: 0, anim: 0, landSquash: 0, angle: 0 };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function int(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(a) { return a[int(0, a.length - 1)]; }
  function readSave() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (!data) return clone(EMPTY_SAVE);
      return { version: 2, wins: Math.max(0, Number(data.wins) || 0), rageQuits: Math.max(0, Number(data.rageQuits) || 0), totalDeaths: Math.max(0, Number(data.totalDeaths) || 0), badges: Array.isArray(data.badges) ? data.badges.filter(id => BADGES.some(b => b.id === id)) : [] };
    } catch { return clone(EMPTY_SAVE); }
  }
  function saveStats() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { toast("Browser storage is unavailable; export your save."); }
    updateStats();
  }
  function updateStats() {
    $("#statWins").textContent = $("#sideWins").textContent = save.wins;
    $("#statRageQuits").textContent = $("#sideRageQuits").textContent = save.rageQuits;
    $("#statDeaths").textContent = $("#sideDeaths").textContent = save.totalDeaths;
    $("#levelDeaths").textContent = deaths;
    $("#badgeList").innerHTML = BADGES.map(b => `<span class="badge ${save.badges.includes(b.id) ? "" : "locked"}" title="${save.badges.includes(b.id) ? "Unlocked" : "Not yet unlocked"}">${save.badges.includes(b.id) ? "🏅 " : "🔒 "}${b.name}</span>`).join("");
  }
  function toast(message, seconds = 1.8) {
    const el = $("#toast"); el.textContent = message; el.classList.add("show"); toastSeconds = seconds;
  }
  function audioOn() {
    if (!soundOn) return;
    try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); } catch { audio = null; }
  }
  function tone(freq, duration = .1, type = "triangle", volume = .035, slide = 0) {
    if (!soundOn) return; audioOn(); if (!audio) return;
    const t = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t); if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + duration);
    gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(.001, t + duration);
    osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + duration);
  }
  function startMusic() {
    stopMusic(); if (!soundOn) return; audioOn(); if (!audio) return;
    beat = 0;
    musicTimer = setInterval(() => {
      if (!soundOn || !audio || state !== "playing") return;
      const n = beat++ % 16;
      if (n % 4 === 0) tone(105, .13, "sine", .055, 48);
      if (n % 4 === 2) tone(720, .045, "square", .015);
      if (n % 2 === 0) tone([440, 554, 659, 554][Math.floor(n / 2) % 4], .1, "triangle", .018);
    }, 250);
  }
  function stopMusic() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; }

  function generateLevel() {
    const difficulty = DIFFICULTIES[difficultyKey], length = LENGTHS[lengthKey];
    const totalDistance = difficulty.speed * length.seconds;
    const hazards = [], platforms = [], checkpoints = [];
    let x = 700, index = 0;
    while (x < totalDistance - 700) {
      const gap = int(300, 455);
      x += gap;
      if (Math.random() < difficulty.hazardRate) {
        const type = pick(["spikes", "gap", "vanish", "block", "double"]);
        if (type === "double") {
          hazards.push({ type: "spikes", x, w: 36 });
          hazards.push({ type: "spikes", x: x + 120, w: 36 });
          x += 165;
        } else {
          const widths = { spikes: int(38, 70), gap: int(45, 70), vanish: int(52, 72), block: int(38, 54) };
          const w = Math.round(widths[type] * difficulty.width);
          hazards.push({ type, x, w, phase: rand(0, Math.PI * 2) }); x += w;
        }
      }
      if (index % 2 === 1 && Math.random() < .72) platforms.push({ x: x - int(100, 170), y: FLOOR - int(90, 150), w: int(90, 160), moving: Math.random() < .35, phase: rand(0, Math.PI * 2) });
      if (practice && index > 0 && index % 8 === 0) checkpoints.push(x - 100);
      index++;
    }
    if (!practice) {
      const maxCheckpoints = Math.min(2, Math.floor(totalDistance / 18000));
      const count = int(0, maxCheckpoints);
      for (let i = 0; i < count; i++) checkpoints.push(totalDistance * (i + 1) / (count + 1) + rand(-700, 700));
    }
    checkpoints.sort((a, b) => a - b);
    return { theme: pick(THEMES), hazards, platforms, checkpoints, finishX: totalDistance, speed: difficulty.speed, length: length.seconds, difficulty: difficultyKey };
  }

  function startLevel() {
    audioOn(); level = generateLevel(); cameraX = 0; deaths = 0; checkpointIndex = 0; invulnerable = 0; runCounted = false; particles = [];
    resetDuck(110); state = "playing"; runStartedAt = performance.now();
    $("#overlay").classList.add("hidden");
    $("#levelName").textContent = `${DIFFICULTIES[difficultyKey].name} · ${LENGTHS[lengthKey].name}`;
    $("#checkpointLabel").textContent = `Checkpoints: ${level.checkpoints.length}`;
    $("#modeLabel").textContent = practice ? "Practice mode" : `${level.theme.name} · ${level.length}s target`;
    $("#progressBar").style.width = "0%"; $("#progressText").textContent = "0%";
    startMusic(); updateStats();
  }
  function resetDuck(x) { duck.x = x; duck.y = FLOOR - duck.h; duck.vy = 0; duck.grounded = true; duck.coyote = .12; duck.jumpBuffer = 0; duck.angle = 0; }
  function showOverlay(kind, title, message) {
    $("#overlay").classList.remove("hidden"); $("#overlayTitle").innerHTML = title; $("#overlayMessage").textContent = message;
    const home = kind === "menu";
    $("#menuStats").classList.toggle("hidden", !home); $("#menuHome").classList.toggle("hidden", !home);
    $("#setupPanel").classList.toggle("hidden", kind !== "setup"); $("#badgeStrip").classList.toggle("hidden", !home);
    $("#continueButton").classList.toggle("hidden", home || kind === "setup");
    $("#continueButton").textContent = kind === "paused" ? "Resume run" : "Back to main menu";
    updateStats();
  }
  function homeMenu() {
    state = "menu"; level = null; stopMusic();
    $("#levelName").textContent = "Ready?"; $("#checkpointLabel").textContent = "Checkpoints: —";
    $("#modeLabel").textContent = "Choose a course"; $("#progressBar").style.width = "0%"; $("#progressText").textContent = "0%";
    showOverlay("menu", "DUCK RUN <span>2D</span>", "Tiny duck. Huge course. How far can you run?");
  }
  function toMenu() {
    if (state === "playing" || state === "paused") { save.rageQuits++; saveStats(); }
    homeMenu();
  }
  function pause() {
    if (state === "playing") { state = "paused"; stopMusic(); showOverlay("paused", "PAUSED", "Take a breath. Your run is waiting right here."); }
    else if (state === "paused") resume();
  }
  function resume() { state = "playing"; $("#overlay").classList.add("hidden"); startMusic(); }
  function restart() {
    if (!level || (state !== "playing" && state !== "paused")) return;
    const x = checkpointIndex ? level.checkpoints[checkpointIndex - 1] + 35 : 110;
    resetDuck(x); invulnerable = .5; cameraX = Math.max(0, x - 250); particles = []; state = "playing"; $("#overlay").classList.add("hidden"); startMusic();
  }
  function jump() {
    if (state === "playing") duck.jumpBuffer = .15;
    else if (state === "paused") resume();
    else if (state === "finish") homeMenu();
  }
  function emit(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) particles.push({ x, y, vx: rand(-160, 160), vy: rand(-250, 20), size: rand(3, 7), life: rand(.3, .7), max: .7, color });
  }
  function die() {
    if (state !== "playing" || invulnerable > 0) return;
    tone(160, .17, "sawtooth", .045, 55); deaths++; save.totalDeaths++; saveStats();
    toast(`☠ ${pick(DEATH_QUOTES)}`, 1.6); emit(duck.x + 20, duck.y + 15, "#ff6b91", 14);
    const x = checkpointIndex ? level.checkpoints[checkpointIndex - 1] + 35 : 110;
    resetDuck(x); invulnerable = .5; cameraX = Math.max(0, x - 250);
  }
  function unlockBadges() {
    const run = { won: true, deaths, difficulty: difficultyKey, length: lengthKey };
    const unlocked = BADGES.filter(b => b.test(run) && !save.badges.includes(b.id));
    unlocked.forEach(b => save.badges.push(b.id));
    return unlocked;
  }
  function finish() {
    if (runCounted || state !== "playing") return;
    runCounted = true; state = "finish"; stopMusic(); save.wins++;
    const unlocked = unlockBadges(); saveStats();
    tone(440, .12); setTimeout(() => tone(590, .12), 100); setTimeout(() => tone(740, .2), 210);
    emit(duck.x + 25, FLOOR - 45, "#ffe36c", 32);
    let message = pick(WELL_DONE);
    if (unlocked.length) message += ` New badge: ${unlocked.map(b => b.name).join(", ")}!`;
    showOverlay("finish", "COURSE CLEAR!", message);
  }
  function platformY(p, time) { return p.y + (p.moving ? Math.sin(time / 650 + p.phase) * 17 : 0); }

  function update(dt, time) {
    if (toastSeconds > 0 && (toastSeconds -= dt) <= 0) $("#toast").classList.remove("show");
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.life -= dt; }
    if (state !== "playing" || !level) return;
    invulnerable = Math.max(0, invulnerable - dt);
    duck.anim += dt * (duck.grounded ? 14 : 6);
    duck.landSquash += (0 - duck.landSquash) * Math.min(1, dt * 12);
    duck.coyote = duck.grounded ? .12 : Math.max(0, duck.coyote - dt);
    duck.jumpBuffer = Math.max(0, duck.jumpBuffer - dt);
    if (duck.jumpBuffer > 0 && duck.coyote > 0) {
      duck.vy = -690; duck.grounded = false; duck.coyote = 0; duck.jumpBuffer = 0;
      tone(500, .085, "square", .024, 800); emit(duck.x + 18, duck.y + duck.h, "#fff0a0", 4);
    }
    const pace = held.has("KeyA") ? .72 : held.has("KeyD") ? 1.2 : 1;
    const oldGrounded = duck.grounded, oldBottom = duck.y + duck.h;
    duck.x += level.speed * pace * dt;
    duck.vy += 1700 * dt; duck.y += duck.vy * dt; duck.grounded = false;
    const center = duck.x + duck.w / 2;
    const overGap = level.hazards.some(h => h.type === "gap" && center > h.x && center < h.x + h.w);
    if (!overGap && duck.y + duck.h >= FLOOR && duck.vy >= 0) {
      duck.y = FLOOR - duck.h; duck.vy = 0; duck.grounded = true;
      if (!oldGrounded) { duck.landSquash = 1; emit(duck.x + 15, FLOOR, "#fff0a0", 5); }
    }
    for (const p of level.platforms) {
      const py = platformY(p, time), overlap = duck.x + duck.w - 5 > p.x && duck.x + 5 < p.x + p.w;
      if (overlap && oldBottom <= py + 8 && duck.y + duck.h >= py && duck.vy >= 0) { duck.y = py - duck.h; duck.vy = 0; duck.grounded = true; }
    }
    for (const h of level.hazards) {
      const overlap = duck.x + duck.w - 6 > h.x && duck.x + 6 < h.x + h.w;
      if (!overlap || invulnerable > 0) continue;
      if (h.type === "gap" && center > h.x && center < h.x + h.w && duck.y + duck.h > FLOOR + 3) { die(); return; }
      if ((h.type === "spikes" || h.type === "block") && duck.y + duck.h > FLOOR - (h.type === "block" ? 39 : 27)) { die(); return; }
      if (h.type === "vanish" && Math.sin(time / 420 + h.phase) > -.15 && duck.y + duck.h > FLOOR - 8) { die(); return; }
    }
    if (duck.y > H + 80) { die(); return; }
    while (checkpointIndex < level.checkpoints.length && duck.x + duck.w >= level.checkpoints[checkpointIndex]) {
      checkpointIndex++; tone(630, .1, "triangle", .035, 930); emit(duck.x + 18, FLOOR - 48, "#9ff3bb", 12);
      invulnerable = Math.max(invulnerable, .5);
      $("#checkpointLabel").textContent = `Checkpoint: ${checkpointIndex}/${level.checkpoints.length}`;
    }
    if (duck.x >= level.finishX) { finish(); return; }
    cameraX += (Math.max(0, duck.x - 250) - cameraX) * Math.min(1, dt * 8);
    const pct = Math.min(100, duck.x / level.finishX * 100);
    $("#progressBar").style.width = `${pct}%`; $("#progressText").textContent = `${Math.floor(pct)}%`; $("#levelDeaths").textContent = deaths;
  }

  function rounded(x, y, w, h, r, color) {
    ctx.fillStyle = color; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else { ctx.rect(x, y, w, h); }
    ctx.fill();
  }
  function background(theme, time) {
    ctx.fillStyle = theme.sky; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = .14; ctx.fillStyle = "#fff"; for (let y = 52; y < 230; y += 42) ctx.fillRect(0, y, W, 2); ctx.globalAlpha = 1;
    for (let i = 0; i < 10; i++) { const x = ((i * 157 - cameraX * .16) % (W + 100) + W + 100) % (W + 100) - 50; const y = 75 + i % 4 * 35 + Math.sin(time / 550 + i) * 3; ctx.fillStyle = i % 2 ? "#fff3aa" : "#fff"; ctx.fillRect(x, y, 5, 5); }
    ctx.fillStyle = theme.far; for (let i = -1; i < 8; i++) { const x = i * 190 - cameraX * .23 % 190; ctx.beginPath(); ctx.ellipse(x + 80, 380, 135, 95, 0, Math.PI, 0); ctx.fill(); }
    ctx.fillStyle = theme.hill; for (let i = -1; i < 9; i++) { const x = i * 150 - cameraX * .45 % 150; ctx.beginPath(); ctx.ellipse(x + 75, 414, 108, 66, 0, Math.PI, 0); ctx.fill(); }
  }
  function ground(theme, time) {
    ctx.fillStyle = theme.ground; ctx.fillRect(0, FLOOR, W, H - FLOOR); ctx.fillStyle = theme.edge; ctx.fillRect(0, FLOOR, W, 9);
    const start = Math.floor(cameraX / 80) * 80;
    for (let x = start; x < cameraX + W + 80; x += 80) {
      const sx = x - cameraX, gap = level?.hazards.some(h => h.type === "gap" && x + 40 > h.x && x < h.x + h.w);
      if (!gap) { ctx.fillStyle = theme.edge; ctx.fillRect(sx + 12, FLOOR + 28, 8, 4); ctx.fillRect(sx + 49, FLOOR + 52, 5, 5); }
    }
    if (level) for (const h of level.hazards) {
      const x = h.x - cameraX;
      if (h.type === "gap") { ctx.fillStyle = "#11152f"; ctx.fillRect(x, FLOOR - 1, h.w, H - FLOOR + 1); ctx.fillStyle = theme.accent; ctx.fillRect(x, FLOOR - 4, h.w, 5); }
      if (h.type === "vanish") { ctx.globalAlpha = .3 + (Math.sin(time / 420 + h.phase) + 1) * .25; ctx.fillStyle = "#fff"; ctx.fillRect(x, FLOOR - 5, h.w, 5); ctx.globalAlpha = 1; }
    }
  }
  function world(theme, time) {
    if (!level) return;
    for (const h of level.hazards) {
      const x = h.x - cameraX; if (x + h.w < -12 || x > W + 12) continue;
      if (h.type === "spikes") {
        const count = Math.max(1, Math.ceil(h.w / 24)), sw = h.w / count;
        for (let i = 0; i < count; i++) { ctx.fillStyle = theme.accent; ctx.beginPath(); ctx.moveTo(x + i * sw, FLOOR); ctx.lineTo(x + (i + .5) * sw, FLOOR - 33); ctx.lineTo(x + (i + 1) * sw, FLOOR); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff4d8"; ctx.fillRect(x + (i + .5) * sw - 2, FLOOR - 12, 4, 3); }
      } else if (h.type === "block") {
        rounded(x, FLOOR - 38, h.w, 38, 5, "#62408f"); ctx.fillStyle = theme.accent; ctx.fillRect(x + 5, FLOOR - 33, h.w - 10, 5);
        ctx.fillStyle = "#ffeaa0"; ctx.fillRect(x + h.w / 2 - 3, FLOOR - 24, 6, 6);
      } else if (h.type === "vanish") {
        const active = Math.sin(time / 420 + h.phase) > -.15; ctx.globalAlpha = active ? .96 : .25; ctx.fillStyle = active ? theme.accent : "#fff";
        for (let k = 0; k < h.w; k += 18) ctx.fillRect(x + k + 2, FLOOR - 5, Math.min(13, h.w - k), 5); ctx.globalAlpha = 1;
      }
    }
    for (const p of level.platforms) { const x = p.x - cameraX; if (x + p.w < 0 || x > W) continue; const y = platformY(p, time); rounded(x, y, p.w, 15, 5, "#3b3972"); rounded(x, y, p.w, 6, 3, theme.accent); }
    level.checkpoints.forEach((cp, i) => { const x = cp - cameraX; if (x < -40 || x > W + 40) return; ctx.fillStyle = i < checkpointIndex ? "#9ff3bb" : "#fff4d2"; ctx.fillRect(x, FLOOR - 52, 5, 52); ctx.fillStyle = i < checkpointIndex ? "#70e1a1" : "#ff79ad"; ctx.beginPath(); ctx.moveTo(x + 5, FLOOR - 50); ctx.lineTo(x + 33, FLOOR - 42); ctx.lineTo(x + 5, FLOOR - 34); ctx.closePath(); ctx.fill(); });
    const finishX = level.finishX - cameraX; if (finishX > -60 && finishX < W + 60) { ctx.fillStyle = "#fff4d2"; ctx.fillRect(finishX, FLOOR - 115, 8, 115); ctx.fillStyle = "#ff70a9"; ctx.fillRect(finishX + 8, FLOOR - 112, 48, 30); ctx.fillStyle = "#ffe36c"; ctx.fillRect(finishX + 19, FLOOR - 103, 8, 8); }
  }
  function drawDuck(time) {
    const x = duck.x - cameraX;
    const run = duck.grounded ? Math.sin(duck.anim) : 0;
    const stretch = duck.grounded ? 1 - duck.landSquash * .12 : 1.06;
    const rise = duck.grounded ? Math.abs(run) * 1.3 : 0;
    const y = duck.y + rise + duck.landSquash * 3;
    const flashing = invulnerable > 0 && Math.floor(time / 65) % 2 === 0;
    if (flashing) ctx.globalAlpha = .28;
    ctx.save(); ctx.translate(x + 21, y + 19); ctx.rotate(duck.grounded ? Math.sin(duck.anim) * .025 : Math.max(-.12, Math.min(.12, duck.vy / 5000))); ctx.scale(1 / stretch, stretch); ctx.translate(-(x + 21), -(y + 19));
    ctx.globalAlpha *= duck.grounded ? .2 : .1; ctx.fillStyle = "#10142b"; ctx.beginPath(); ctx.ellipse(x + 20, FLOOR + 3, duck.grounded ? 22 : 14, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = flashing ? .28 : 1;
    rounded(x + 3, y + 11, 29, 23, 10, "#ffda57"); rounded(x + 17, y + 2, 21, 21, 9, "#ffe66d");
    ctx.fillStyle = "#ff9b3d"; ctx.beginPath(); ctx.moveTo(x + 35, y + 11); ctx.lineTo(x + 47, y + 15); ctx.lineTo(x + 35, y + 19); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#262344"; ctx.fillRect(x + 30, y + 8, 3, 4); ctx.fillStyle = "#fff"; ctx.fillRect(x + 31, y + 8, 1, 1);
    ctx.fillStyle = "#f2bc36"; ctx.fillRect(x + 20, y, 7, 4);
    const kick = duck.grounded ? Math.sin(duck.anim * 1.7) * 3 : 1; ctx.fillStyle = "#ef783d"; ctx.fillRect(x + 10, y + 31, 8, 4 + kick); ctx.fillRect(x + 24, y + 31, 8, 4 - kick);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function draw(time) {
    const theme = level?.theme || THEMES[0]; background(theme, time); ground(theme, time); world(theme, time);
    if (level) drawDuck(time);
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x - cameraX, p.y, p.size, p.size); }
    ctx.globalAlpha = 1;
    if (state === "playing" && invulnerable > 0) { ctx.globalAlpha = .09 + Math.sin(time / 35) * .04; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, 5); ctx.globalAlpha = 1; }
  }
  function frame(time) { const dt = Math.min(.033, Math.max(0, (time - lastTime) / 1000)); lastTime = time; update(dt, time); draw(time); requestAnimationFrame(frame); }

  document.addEventListener("keydown", (event) => {
    if (["Space", "ArrowUp", "ArrowDown"].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    if (["Space", "ArrowUp", "KeyW"].includes(event.code)) {
      if (state === "menu") showOverlay("setup", "BUILD YOUR COURSE", "Choose a challenge and course length.");
      else jump();
    } else if (event.code === "KeyR") restart();
    else if (event.code === "Escape") pause();
  });
  document.addEventListener("keyup", event => held.delete(event.code));
  window.addEventListener("blur", () => { held.clear(); if (state === "playing") pause(); });
  canvas.addEventListener("pointerdown", () => { if (state === "playing") jump(); });
  $("#newGameButton").addEventListener("click", () => showOverlay("setup", "BUILD YOUR COURSE", "Choose a challenge and course length."));
  $("#backButton").addEventListener("click", () => homeMenu());
  $("#createButton").addEventListener("click", () => { difficultyKey = $("#difficultySelect").value; lengthKey = $("#lengthSelect").value; startLevel(); });
  $("#menuButton").addEventListener("click", toMenu);
  $("#continueButton").addEventListener("click", () => state === "paused" ? resume() : homeMenu());
  $("#practiceToggle").addEventListener("change", event => { practice = event.target.checked; $("#modeLabel").textContent = `Practice mode ${practice ? "on" : "off"}`; });
  $("#soundButton").addEventListener("click", () => {
    soundOn = !soundOn; $("#soundButton").textContent = soundOn ? "🔊 Sound on" : "🔇 Sound off";
    $("#soundButton").setAttribute("aria-pressed", String(soundOn));
    if (soundOn) { audioOn(); tone(500, .08); if (state === "playing") startMusic(); } else stopMusic();
  });
  $("#exportButton").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ ...save, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "duck-run-2d-save.json"; a.click(); URL.revokeObjectURL(url);
  });
  $("#importInput").addEventListener("change", async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== "object") throw new Error("That file is not a Duck Run save.");
      save = { version: 2, wins: Math.max(0, Number(data.wins) || 0), rageQuits: Math.max(0, Number(data.rageQuits) || 0), totalDeaths: Math.max(0, Number(data.totalDeaths) || 0), badges: Array.isArray(data.badges) ? data.badges.filter(id => BADGES.some(b => b.id === id)) : [] };
      saveStats(); toast("Save imported!");
    } catch (error) { toast(error.message || "Could not import that save."); }
    event.target.value = "";
  });
  $("#resetButton").addEventListener("click", () => { if (!confirm("Reset all saved stats and badges? Export a backup first if you want to keep them.")) return; save = clone(EMPTY_SAVE); saveStats(); toast("Stats reset."); });
  $("#practiceToggle").checked = false;
  updateStats(); showOverlay("menu", "DUCK RUN <span>2D</span>", "Tiny duck. Huge course. How far can you run?");
  requestAnimationFrame(frame);
})();
