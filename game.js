// Game setup
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreDisplay = document.getElementById("score");
const levelDisplay = document.getElementById("level");
const gameOverScreen = document.getElementById("game-over");
const finalScoreDisplay = document.getElementById("final-score");
const restartBtn = document.getElementById("restart");
const fullscreenBtn = document.getElementById("fullscreen-btn");

// Game state
let gameActive = true;
let score = 0;
let level = 1;
let time = 0;
let duck = {
    x: 50,
    y: 100,
    width: 30,
    height: 30,
    velY: 0,
    isJumping: false,
    color: "#FFD700"
};

// Resize canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Fullscreen toggle
fullscreenBtn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
});

// Draw duck
function drawDuck() {
    ctx.fillStyle = duck.color;
    ctx.fillRect(duck.x, duck.y, duck.width, duck.height);
}

// Draw ground
function drawGround() {
    ctx.fillStyle = "#3a5f0b";
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
}

// Game loop
function gameLoop() {
    if (!gameActive) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update time
    time += 0.016; // ~60fps

    // Update duck physics
    duck.velY += 0.5; // gravity
    duck.y += duck.velY;

    // Ground collision
    if (duck.y + duck.height > canvas.height - 50) {
        duck.y = canvas.height - 50 - duck.height;
        duck.velY = 0;
        duck.isJumping = false;
    }

    // Draw everything
    drawGround();
    drawDuck();
    drawSpikes();
    drawPlatforms();

    // Draw boss if active
    if (levels[level - 1].hasBoss && bossActive) {
        drawBoss();
        updateBoss();
    }

    // Check collisions
    checkCollisions();
    checkBossCollision();

    // Update UI
    scoreDisplay.textContent = `Score: ${Math.floor(score)}`;
    levelDisplay.textContent = `Level: ${level}`;

    requestAnimationFrame(gameLoop);
}

// Start game
function initGame() {
    startMusic();
    gameLoop();
}

// Initialize
initGame();

// Keyboard controls
document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !duck.isJumping) {
        duck.velY = -10;
        duck.isJumping = true;
    }
});

// Restart game
restartBtn.addEventListener("click", () => {
    gameActive = true;
    score = 0;
    time = 0;
    level = 1;
    duck = {
        x: 50,
        y: 100,
        width: 30,
        height: 30,
        velY: 0,
        isJumping: false,
        color: "#FFD700"
    };
    gameOverScreen.classList.add("hidden");
    scoreDisplay.textContent = `Score: ${score}`;
    levelDisplay.textContent = `Level: ${level}`;
    resetObstacles();
    resetBoss();
    initGame();
});
