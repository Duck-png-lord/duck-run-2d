// Obstacles
let obstacles = [];
let bossActive = false;

// Level data
const levels = [
    {
        obstacles: [
            { x: 300, y: canvas.height - 80, width: 50, height: 30, type: "spike" },
            { x: 600, y: canvas.height - 80, width: 50, height: 30, type: "spike" },
            { x: 900, y: canvas.height - 120, width: 50, height: 30, type: "spike" }
        ],
        hasBoss: false
    },
    {
        obstacles: [
            { x: 200, y: canvas.height - 80, width: 50, height: 30, type: "spike" },
            { x: 400, y: canvas.height - 120, width: 50, height: 30, type: "spike" },
            { x: 600, y: canvas.height - 80, width: 50, height: 30, type: "spike" },
            { x: 800, y: canvas.height - 150, width: 50, height: 30, type: "spike" }
        ],
        hasBoss: false
    },
    {
        obstacles: [
            { x: 100, y: canvas.height - 80, width: 50, height: 30, type: "spike" },
            { x: 300, y: canvas.height - 120, width: 50, height: 30, type: "spike" },
            { x: 500, y: canvas.height - 80, width: 50, height: 30, type: "spike" },
            { x: 700, y: canvas.height - 150, width: 50, height: 30, type: "spike" },
            { x: 900, y: canvas.height - 100, width: 50, height: 30, type: "spike" }
        ],
        hasBoss: true
    }
];

// Check collisions
function checkCollisions() {
    obstacles.forEach(obstacle => {
        if (
            duck.x < obstacle.x + obstacle.width &&
            duck.x + duck.width > obstacle.x &&
            duck.y < obstacle.y &&
            duck.y + duck.height > obstacle.y - obstacle.height
        ) {
            gameOver();
        }
    });
}

// Reset obstacles for new level
function resetObstacles() {
    obstacles = [...levels[level - 1].obstacles];
}

// Game over
function gameOver() {
    gameActive = false;
    finalScoreDisplay.textContent = score;
    gameOverScreen.classList.remove("hidden");
}
