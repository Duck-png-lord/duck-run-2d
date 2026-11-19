const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreDisplay = document.getElementById("score");
const levelDisplay = document.getElementById("level");
const gameOverScreen = document.getElementById("game-over");
const finalScoreDisplay = document.getElementById("final-score");
const restartBtn = document.getElementById("restart");
const fullscreenBtn = document.getElementById("fullscreen-btn");

// Game settings
const gravity = 0.5;
const jumpForce = -10;
const duckSize = 30;
let gameActive = true;
let score = 0;
let level = 1;
let duck = {
    x: 50,
    y: 100,
    width: duckSize,
    height: duckSize,
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

// Game loop
function gameLoop() {
    if (!gameActive) return;

    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update duck physics
    duck.velY += gravity;
    duck.y += duck.velY;

    // Check ground collision
    if (duck.y + duck.height > canvas.height - 50) {
        duck.y = canvas.height - 50 - duck.height;
        duck.velY = 0;
        duck.isJumping = false;
    }

    // Draw duck
    ctx.fillStyle = duck.color;
    ctx.fillRect(duck.x, duck.y, duck.width, duck.height);

    // Draw ground
    ctx.fillStyle = "#333";
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);

    // Draw obstacles
    drawObstacles();

    // Draw boss if active
    if (levels[level - 1].hasBoss && bossActive) {
        drawBoss();
    }

    // Check collisions
    checkCollisions();

    // Update score
    score++;
    scoreDisplay.textContent = `Score: ${score}`;

    requestAnimationFrame(gameLoop);
}

// Start game
gameLoop();

// Keyboard controls
document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !duck.isJumping) {
        duck.velY = jumpForce;
        duck.isJumping = true;
    }
});

// Restart game
restartBtn.addEventListener("click", () => {
    gameActive = true;
    score = 0;
    level = 1;
    duck = {
        x: 50,
        y: 100,
        width: duckSize,
        height: duckSize,
        velY: 0,
        isJumping: false,
        color: "#FFD700"
    };
    gameOverScreen.classList.add("hidden");
    scoreDisplay.textContent = `Score: ${score}`;
    levelDisplay.textContent = `Level: ${level}`;
    resetObstacles();
    resetBoss();
    gameLoop();
});
