(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const $ = (selector) => document.querySelector(selector);
  const W = canvas.width;
  const H = canvas.height;
  const FLOOR = 444;
  const GRAVITY = 1750;
  const JUMP_V = -660;
  const STORE_KEY = "duck-run-2d-save-v1";
  const COURSE_NAMES = ["Sunny Sprint", "Berry Blitz", "Neon Nightmare"];
  const SPEEDS = [255, 278, 300];
  const THEMES = [
    { sky: "#70d9ee", far: "#b3edcf", hill: "#63c59c", ground: "#e2af62", edge: "#ffe69a", accent: "#ff639d", name: "Candy Coast" },
    { sky: "#b49cff", far: "#f1c5e9", hill: "#985ab2", ground: "#654695", edge: "#efc5ef", accent: "#ffe46b", name: "Berry Blitz" },
    { sky: "#202c67", far: "#455ca5", hill: "#304780", ground: "#222d57", edge: "#70dcff", accent: "#ff70b5", name: "Neon Night" },
    { sky: "#83e3bc", far: "#d2f0b5", hill: "#55ae87", ground: "#ba855e", edge: "#f1d29a", accent: "#ff6e78", name: "Mint Machine" }
  ];
  const DEATH_QUOTES = [
    "The spikes say thanks for the visit.", "A bold jump. A short career.", "The duck has filed a complaint about your timing.",
    "You were this close. The spikes were not impressed.", "Gravity remains undefeated. For now.", "That landing was more of a suggestion.",
    "The course saw that coming. Next time, surprise it.", "A very educational faceplant.", "The duck believes in you. The floor does not.",
    "The gap won this round. Rematch?", "That jump had confidence. Not quite enough height.", "At least the respawn is quick."
  ];
  const WELL_DONE = [
    "Well done! The duck is doing a tiny victory dance.", "Clean landing, champion. You earned that quack.", "Course conquered! Your timing was egg-cellent.",
    "That was a lovely run. The spikes are jealous.", "You kept your cool and cleared the course. Nice!", "A proper win. Duck approved.",
    "You made it! The duck's determination is contagious.", "Well played! That finish was worth every retry.", "The course tried its best. So did you—and you won.",
    "Victory! Somewhere, a tiny duck is cheering for you."
  ];

  const EMPTY_SAVE = { version: 1, wins: 0, rageQuits: 0, totalDeaths: 0, courses: COURSE_NAMES.map(() => ({ wins: 0, deaths: 0 })) };
  let save = readSave();
  let state = "menu";
  let practice = false;
  let soundOn = true;
  let audio = null;
  let level = null;
  let course = 0;
  let cameraX = 0;
  let deathsThisRun = 0;
  let checkpointIndex = 0;
  let lastTime = 0;
  let toastTimer = 0;
  let toastText = "";
  let particles = [];
  let quote = "";
  let quoteTime = 0;
  let runCounted = false;

  const duck = { x: 90, y: FLOOR - 36, w: 38, h: 34, vy: 0, grounded: true, coyote: 0, buffer: 0, anim: 0, squash: 0 };

  function rand(min, max) { return min + Math.random() * (max - min); }
  function int(min, max) { return Math.floor(rand(min, max + 1)); }
  function pick(list) { return list[int(0, list.length - 1)]; }

  function readSave() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return structuredClone(EMPTY_SAVE);
      const parsed = JSON.parse(raw);
      const courses = COURSE_NAMES.map((_, i) => ({
        wins: Math.max(0, Number(parsed.courses?.[i]?.wins) || 0),
        deaths: Math.max(0, Number(parsed.courses?.[i]?.deaths) || 0)
      }));
      return {
        version: 1,
        wins: Math.max(0, Number(parsed.wins) || 0),
        rageQuits: Math.max(0, Number(parsed.rageQuits) || 0),
        totalDeaths: Math.max(0, Number(parsed.totalDeaths) || 0),
        courses
      };
    } catch (error) {
      console.warn("Could not read Duck Run save:", error);
      return structuredClone(EMPTY_SAVE);
    }
  }

  function writeSave() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(save)); }
    catch (error) { console.warn("Could not save Duck Run stats:", error); showToast("Browser storage unavailable — export a save backup."); }
    updateStats();
  }

  function updateStats() {
    $("#statWins").textContent = $("#sideWins").textContent = save.wins;
    $("#statRageQuits").textContent = $("#sideRageQuits").textContent = save.rageQuits;
    $("#statDeaths").textContent = $("#sideDeaths").textContent = save.totalDeaths;
    save.courses.forEach((item, i) => { $("#courseDeaths" + i).textContent = item.deaths; });
    $("#levelDeaths").textContent = deathsThisRun;
  }

  function showToast(message, duration = 1800) {
    toastText = message;
    toastTime = duration;
    $("#toast").textContent = message;
    $("#toast").classList.add("show");
  }

  function hideToast() { $("#toast").classList.remove("show"); }

  function ensureAudio() {
    if (!soundOn) return;
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
    } catch (error) { audio = null; }
  }

  function beep(freq, duration = 0.09, type = "triangle", volume = 0.045, slide = null) {
    if (!soundOn) return;
    ensureAudio();
    if (!audio) return;
    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, now);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(slide, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(now); oscillator.stop(now + duration);
  }

  function soundJump() { beep(480, 0.09, "square", 0.025, 760); }
  function soundDeath() { beep(170, 0.15, "sawtooth", 0.04, 65); }
  function soundCheckpoint() { beep(620, 0.1, "triangle", 0.035, 900); }
  function soundWin() {
    beep(440, 0.12, "triangle", 0.045);
    setTimeout(() => beep(590, 0.12, "triangle", 0.045), 100);
    setTimeout(() => beep(740, 0.2, "triangle", 0.05), 210);
  }

  function validateLayout(hazards) {
    const sorted = [...hazards].sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length; i++) {
      const h = sorted[i];
      if (h.type === "gap" && (h.w > 75 || h.w < 40)) return false;
      if (h.type === "spikes" && h.w > 86) return false;
      if (i && h.x - (sorted[i - 1].x + sorted[i - 1].w) < 225) return false;
    }
    return true;
  }

  // Main route stays on solid ground; obstacle widths, visibility, run-ups, and
  // spacing are bounded so each pattern has a generous jump window.
  function generateLevel(levelNumber) {
    const hazards = [];
    const platforms = [];
    let x = 570;
    const sectionCount = 8 + levelNumber * 2;
    for (let i = 0; i < sectionCount; i++) {
      x += int(210, 290);
      const kind = int(0, levelNumber === 0 ? 4 : 5);
      if (kind <= 2) {
        const w = int(38, levelNumber === 2 ? 72 : 62);
        hazards.push({ type: "spikes", x, w });
        x += w;
      } else if (kind === 3) {
        const w = int(46, 70);
        hazards.push({ type: "gap", x, w });
        x += w;
      } else if (kind === 4) {
        const w = int(52, 70);
        hazards.push({ type: "vanish", x, w, phase: rand(0, Math.PI * 2) });
        x += w;
      } else {
        // A visible floor hazard variation: two separated spike clusters.
        hazards.push({ type: "spikes", x, w: 32 });
        hazards.push({ type: "spikes", x: x + 84, w: 32 });
        x += 116;
      }
      if (i % 3 === 1) {
        platforms.push({ x: x - int(70, 130), y: FLOOR - int(100, 145), w: int(90, 150), moving: i % 2 === 1, phase: rand(0, Math.PI * 2) });
      }
    }
    if (!validateLayout(hazards)) return generateLevel(levelNumber);

    const finishX = x + 480;
    const candidateCheckpoints = [];
    for (let cx = 900; cx < finishX - 400; cx += 650) candidateCheckpoints.push(cx + int(-130, 130));
    const wanted = practice ? Math.min(5, Math.max(2, Math.floor(finishX / 1500))) : int(0, 2);
    const checkpoints = [];
    while (checkpoints.length < wanted && candidateCheckpoints.length) {
      const index = int(0, candidateCheckpoints.length - 1);
      checkpoints.push(candidateCheckpoints.splice(index, 1)[0]);
    }
    checkpoints.sort((a, b) => a - b);
    return { theme: pick(THEMES), hazards, platforms, checkpoints, finishX, speed: SPEEDS[levelNumber], length: finishX + 200 };
  }

  function startLevel(index) {
    ensureAudio();
    course = index;
    level = generateLevel(index);
    deathsThisRun = 0;
    checkpointIndex = 0;
    cameraX = 0;
    quote = "";
    quoteTime = 0;
    runCounted = false;
    resetDuck(90);
    state = "playing";
    $("#overlay").classList.add("hidden");
    $("#levelName").textContent = `${COURSE_NAMES[index]} · ${level.theme.name}`;
    $("#checkpointLabel").textContent = `Checkpoints: ${level.checkpoints.length}`;
    $("#practiceLabel").textContent = `Practice mode: ${practice ? "on" : "off"}`;
    $("#progressBar").style.width = "0%";
    updateStats();
  }

  function resetDuck(x) {
    duck.x = x; duck.y = FLOOR - duck.h; duck.vy = 0; duck.grounded = true;
    duck.coyote = 0.12; duck.buffer = 0; duck.squash = 0;
  }

  function showOverlay(kind, title, message) {
    const overlay = $("#overlay");
    overlay.classList.remove("hidden");
    $("#overlayTitle").innerHTML = title;
    $("#overlayMessage").textContent = message;
    const isMenu = kind === "menu";
    $("#menuStats").classList.toggle("hidden", !isMenu);
    $("#levelButtons").classList.toggle("hidden", !isMenu);
    $("#continueButton").classList.toggle("hidden", isMenu);
    $("#continueButton").textContent = kind === "finish" ? "Back to courses" : kind === "paused" ? "Resume run" : "Back to courses";
    updateStats();
  }

  function backToMenu() {
    if (state === "playing" || state === "paused") {
      save.rageQuits++;
      writeSave();
    }
    state = "menu";
    level = null;
    $("#levelName").textContent = "Ready?";
    $("#checkpointLabel").textContent = "Checkpoints: —";
    $("#progressBar").style.width = "0%";
    showOverlay("menu", "DUCK RUN <span>2D</span>", "Pick a course, learn its patterns, and keep hopping. Every run gets a fresh layout.");
  }

  function pause() {
    if (state === "playing") {
      state = "paused";
      showOverlay("paused", "PAUSED", "Take a breath. Your run is waiting right here.");
    } else if (state === "paused") resume();
  }

  function resume() {
    state = "playing";
    $("#overlay").classList.add("hidden");
    ensureAudio();
  }

  function restart() {
    if (!level || (state !== "playing" && state !== "paused")) return;
    const respawn = checkpointIndex ? level.checkpoints[checkpointIndex - 1] + 25 : 90;
    resetDuck(respawn);
    cameraX = Math.max(0, respawn - 250);
    particles = [];
    quote = "";
    state = "playing";
    $("#overlay").classList.add("hidden");
  }

  function spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) particles.push({ x, y, vx: rand(-150, 150), vy: rand(-250, 20), size: rand(3, 7), life: rand(0.35, 0.75), max: 0.75, color });
  }

  function die() {
    if (state !== "playing") return;
    soundDeath();
    deathsThisRun++;
    save.totalDeaths++;
    save.courses[course].deaths++;
    writeSave();
    quote = pick(DEATH_QUOTES);
    quoteTime = 1.7;
    showToast(`☠ ${quote}`, 1700);
    spawnParticles(duck.x + duck.w / 2, duck.y + duck.h / 2, "#ff6b91", 14);
    const respawn = checkpointIndex ? level.checkpoints[checkpointIndex - 1] + 25 : 90;
    resetDuck(respawn);
    cameraX = Math.max(0, respawn - 250);
  }

  function win() {
    if (state !== "playing" || runCounted) return;
    runCounted = true;
    state = "finish";
    save.wins++;
    save.courses[course].wins++;
    writeSave();
    soundWin();
    spawnParticles(duck.x + 30, FLOOR - 55, "#ffe36c", 36);
    showOverlay("finish", "COURSE CLEAR!", pick(WELL_DONE));
  }

  function jump() {
    if (state === "menu") { startLevel(0); return; }
    if (state === "paused") { resume(); return; }
    if (state === "finish") { backToMenu(); return; }
    if (state === "playing") duck.buffer = 0.14;
  }

  function platformY(p, time) { return p.y + (p.moving ? Math.sin(time / 650 + p.phase) * 17 : 0); }

  function update(dt, time) {
    if (toastTime > 0) {
      toastTime -= dt;
      if (toastTime <= 0) hideToast();
    }
    if (quoteTime > 0) quoteTime -= dt;
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.life -= dt; }
    if (state !== "playing" || !level) return;

    duck.anim += dt * (duck.grounded ? 13 : 5);
    duck.buffer = Math.max(0, duck.buffer - dt);
    duck.coyote = duck.grounded ? 0.12 : Math.max(0, duck.coyote - dt);
    if (duck.buffer > 0 && duck.coyote > 0) {
      duck.vy = JUMP_V; duck.grounded = false; duck.coyote = 0; duck.buffer = 0; duck.squash = 1;
      soundJump(); spawnParticles(duck.x + 18, duck.y + duck.h, "#fff0a0", 4);
    }

    const oldBottom = duck.y + duck.h;
    duck.x += level.speed * dt;
    duck.vy += GRAVITY * dt;
    duck.y += duck.vy * dt;
    duck.grounded = false;

    const center = duck.x + duck.w / 2;
    const gap = level.hazards.find(h => h.type === "gap" && center > h.x && center < h.x + h.w);
    if (!gap && duck.y + duck.h >= FLOOR && duck.vy >= 0) {
      duck.y = FLOOR - duck.h; duck.vy = 0; duck.grounded = true;
    }

    for (const p of level.platforms) {
      const py = platformY(p, time);
      const overlapsX = duck.x + duck.w - 5 > p.x && duck.x + 5 < p.x + p.w;
      if (overlapsX && oldBottom <= py + 8 && duck.y + duck.h >= py && duck.vy >= 0) {
        duck.y = py - duck.h; duck.vy = 0; duck.grounded = true;
      }
    }

    for (const h of level.hazards) {
      const overlapsX = duck.x + duck.w - 6 > h.x && duck.x + 6 < h.x + h.w;
      if (!overlapsX) continue;
      if (h.type === "gap") {
        if (center > h.x && center < h.x + h.w && duck.y + duck.h > FLOOR + 3) { die(); return; }
      } else if (h.type === "spikes") {
        if (duck.y + duck.h > FLOOR - 27 && duck.y + duck.h > h.y - 5) { die(); return; }
      } else if (h.type === "vanish") {
        const active = Math.sin(time / 380 + h.phase) > -0.15;
        if (active && duck.y + duck.h > FLOOR - 8) { die(); return; }
      }
    }

    if (duck.y > H + 80) { die(); return; }
    while (checkpointIndex < level.checkpoints.length && duck.x + duck.w >= level.checkpoints[checkpointIndex]) {
      checkpointIndex++;
      soundCheckpoint();
      spawnParticles(duck.x + 18, FLOOR - 48, "#9ff3bb", 14);
      $("#checkpointLabel").textContent = `Checkpoint: ${checkpointIndex}/${level.checkpoints.length}`;
    }
    if (duck.x >= level.finishX) { win(); return; }
    cameraX += (Math.max(0, duck.x - 250) - cameraX) * Math.min(1, dt * 7);
    $("#progressBar").style.width = `${Math.min(100, duck.x / level.finishX * 100)}%`;
    $("#levelDeaths").textContent = deathsThisRun;
  }

  function roundedRect(x, y, w, h, r, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  }

  function drawBackground(theme, time) {
    ctx.fillStyle = theme.sky; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.16; ctx.fillStyle = "#fff";
    for (let y = 52; y < 230; y += 42) ctx.fillRect(0, y, W, 2);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 10; i++) {
      const x = ((i * 157 - cameraX * 0.16) % (W + 100) + W + 100) % (W + 100) - 50;
      const y = 75 + i % 4 * 35 + Math.sin(time / 600 + i) * 3;
      ctx.fillStyle = i % 2 ? "#fff3aa" : "#ffffff"; ctx.fillRect(x, y, 5, 5);
    }
    ctx.fillStyle = theme.far;
    for (let i = -1; i < 8; i++) {
      const x = i * 190 - cameraX * 0.23 % 190;
      ctx.beginPath(); ctx.ellipse(x + 80, 380, 135, 95, 0, Math.PI, 0); ctx.fill();
    }
    ctx.fillStyle = theme.hill;
    for (let i = -1; i < 9; i++) {
      const x = i * 150 - cameraX * 0.45 % 150;
      ctx.beginPath(); ctx.ellipse(x + 75, 414, 108, 66, 0, Math.PI, 0); ctx.fill();
    }
  }

  function drawGround(theme) {
    ctx.fillStyle = theme.ground; ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = theme.edge; ctx.fillRect(0, FLOOR, W, 9);
    const start = Math.floor(cameraX / 80) * 80;
    for (let x = start; x < cameraX + W + 80; x += 80) {
      const sx = x - cameraX;
      const inGap = level?.hazards.some(h => h.type === "gap" && x + 40 > h.x && x < h.x + h.w);
      if (!inGap) {
        ctx.fillStyle = theme.edge; ctx.fillRect(sx + 12, FLOOR + 28, 8, 4); ctx.fillRect(sx + 49, FLOOR + 52, 5, 5);
      }
    }
    if (level) for (const h of level.hazards) {
      const x = h.x - cameraX;
      if (h.type === "gap") {
        ctx.fillStyle = "#11152f"; ctx.fillRect(x, FLOOR - 1, h.w, H - FLOOR + 1);
        ctx.fillStyle = theme.accent; ctx.fillRect(x, FLOOR - 4, h.w, 5);
      } else if (h.type === "vanish") {
        ctx.globalAlpha = 0.34 + (Math.sin(performance.now() / 380 + h.phase) + 1) * 0.22;
        ctx.fillStyle = "#fff"; ctx.fillRect(x, FLOOR - 5, h.w, 5); ctx.globalAlpha = 1;
      }
    }
  }

  function drawWorld(theme, time) {
    if (!level) return;
    for (const h of level.hazards) {
      const x = h.x - cameraX;
      if (x + h.w < -10 || x > W + 10) continue;
      if (h.type === "spikes") {
        const count = Math.max(1, Math.ceil(h.w / 25)); const sw = h.w / count;
        for (let i = 0; i < count; i++) {
          ctx.fillStyle = theme.accent; ctx.beginPath(); ctx.moveTo(x + i * sw, FLOOR); ctx.lineTo(x + (i + .5) * sw, FLOOR - 32); ctx.lineTo(x + (i + 1) * sw, FLOOR); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#fff4d8"; ctx.fillRect(x + (i + .5) * sw - 2, FLOOR - 12, 4, 3);
        }
      } else if (h.type === "vanish") {
        const active = Math.sin(time / 380 + h.phase) > -0.15;
        ctx.globalAlpha = active ? 0.95 : 0.24; ctx.fillStyle = active ? theme.accent : "#fff";
        for (let k = 0; k < h.w; k += 18) ctx.fillRect(x + k + 2, FLOOR - 5, Math.min(13, h.w - k), 5);
        ctx.globalAlpha = 1;
      }
    }
    for (const p of level.platforms) {
      const x = p.x - cameraX; if (x + p.w < 0 || x > W) continue;
      const y = platformY(p, time);
      roundedRect(x, y, p.w, 15, 5, "#3b3972"); roundedRect(x, y, p.w, 6, 3, theme.accent);
    }
    for (let i = 0; i < level.checkpoints.length; i++) {
      const x = level.checkpoints[i] - cameraX; if (x < -40 || x > W + 40) continue;
      ctx.fillStyle = i < checkpointIndex ? "#9ff3bb" : "#fff4d2"; ctx.fillRect(x, FLOOR - 52, 5, 52);
      ctx.fillStyle = i < checkpointIndex ? "#70e1a1" : "#ff79ad";
      ctx.beginPath(); ctx.moveTo(x + 5, FLOOR - 50); ctx.lineTo(x + 33, FLOOR - 42); ctx.lineTo(x + 5, FLOOR - 34); ctx.closePath(); ctx.fill();
    }
    const finish = level.finishX - cameraX;
    if (finish > -60 && finish < W + 60) {
      ctx.fillStyle = "#fff4d2"; ctx.fillRect(finish, FLOOR - 115, 8, 115);
      ctx.fillStyle = "#ff70a9"; ctx.fillRect(finish + 8, FLOOR - 112, 48, 30);
      ctx.fillStyle = "#ffe36c"; ctx.fillRect(finish + 19, FLOOR - 103, 8, 8);
    }
  }

  function drawDuck() {
    const x = duck.x - cameraX;
    const bob = duck.grounded ? Math.sin(duck.anim) * 2 : 0;
    const y = duck.y + bob;
    ctx.globalAlpha = duck.grounded ? 0.2 : 0.1; ctx.fillStyle = "#10142b";
    ctx.beginPath(); ctx.ellipse(x + 19, FLOOR + 3, duck.grounded ? 22 : 14, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    roundedRect(x + 3, y + 10, 29, 23, 10, "#ffda57");
    roundedRect(x + 17, y + 1, 21, 21, 9, "#ffe66d");
    ctx.fillStyle = "#ff9b3d"; ctx.beginPath(); ctx.moveTo(x + 35, y + 10); ctx.lineTo(x + 47, y + 14); ctx.lineTo(x + 35, y + 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#262344"; ctx.fillRect(x + 30, y + 7, 3, 4); ctx.fillStyle = "#fff"; ctx.fillRect(x + 31, y + 7, 1, 1);
    ctx.fillStyle = "#f2bc36"; ctx.fillRect(x + 20, y - 2, 7, 4);
    const kick = duck.grounded ? Math.sin(duck.anim * 1.7) * 3 : 1;
    ctx.fillStyle = "#ef783d"; ctx.fillRect(x + 10, y + 30, 8, 4 + kick); ctx.fillRect(x + 24, y + 30, 8, 4 - kick);
  }

  function drawParticles() {
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x - cameraX, p.y, p.size, p.size); }
    ctx.globalAlpha = 1;
  }

  function draw(time) {
    const theme = level?.theme || THEMES[0];
    drawBackground(theme, time); drawGround(theme); drawWorld(theme, time);
    if (level) drawDuck();
    drawParticles();
    if (state === "playing" && Math.sin(time / 125) > 0.98) { ctx.fillStyle = "#fff"; ctx.globalAlpha = 0.12; ctx.fillRect(0, 0, W, 5); ctx.globalAlpha = 1; }
  }

  function frame(time) {
    const dt = Math.min(0.033, Math.max(0, (time - lastTime) / 1000));
    lastTime = time;
    update(dt, time);
    draw(time);
    requestAnimationFrame(frame);
  }

  document.addEventListener("keydown", (event) => {
    if (["Space", "ArrowUp", "ArrowDown"].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    if (["Space", "ArrowUp", "KeyW"].includes(event.code)) jump();
    else if (event.code === "KeyR") restart();
    else if (event.code === "Escape") pause();
    else if (event.code === "Digit1") startLevel(0);
    else if (event.code === "Digit2") startLevel(1);
    else if (event.code === "Digit3") startLevel(2);
  });
  canvas.addEventListener("pointerdown", () => { if (state === "paused") resume(); else jump(); });
  document.querySelectorAll("[data-level]").forEach(button => button.addEventListener("click", () => startLevel(Number(button.dataset.level))));
  $("#menuButton").addEventListener("click", backToMenu);
  $("#continueButton").addEventListener("click", () => state === "paused" ? resume() : backToMenu());
  $("#practiceToggle").addEventListener("change", event => { practice = event.target.checked; $("#practiceLabel").textContent = `Practice mode: ${practice ? "on" : "off"}`; });
  $("#soundButton").addEventListener("click", () => {
    soundOn = !soundOn;
    $("#soundButton").textContent = soundOn ? "🔊 Sound on" : "🔇 Sound off";
    $("#soundButton").setAttribute("aria-pressed", String(soundOn));
    if (soundOn) { ensureAudio(); beep(500, 0.07, "triangle", 0.03); }
  });
  $("#exportButton").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ ...save, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "duck-run-2d-save.json"; link.click(); URL.revokeObjectURL(url);
  });
  $("#importInput").addEventListener("change", async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.courses)) throw new Error("This file doesn't look like a Duck Run save.");
      save = {
        version: 1,
        wins: Math.max(0, Number(parsed.wins) || 0),
        rageQuits: Math.max(0, Number(parsed.rageQuits) || 0),
        totalDeaths: Math.max(0, Number(parsed.totalDeaths) || 0),
        courses: COURSE_NAMES.map((_, i) => ({ wins: Math.max(0, Number(parsed.courses[i]?.wins) || 0), deaths: Math.max(0, Number(parsed.courses[i]?.deaths) || 0) }))
      };
      writeSave(); showToast("Save imported. Welcome back!");
    } catch (error) { showToast(error.message || "Could not import that save."); }
    event.target.value = "";
  });
  $("#resetButton").addEventListener("click", () => {
    if (!window.confirm("Reset all Duck Run stats in this browser? Export a backup first if you want to keep them.")) return;
    save = structuredClone(EMPTY_SAVE); writeSave(); showToast("Stats reset.");
  });
  window.addEventListener("blur", () => { if (state === "playing") pause(); });

  updateStats();
  $("#overlay").classList.remove("hidden");
  requestAnimationFrame(frame);
})();
