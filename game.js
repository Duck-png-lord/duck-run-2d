// ... (previous game.js code)

function gameLoop() {
    if (!gameActive) return;

    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw procedural assets
    drawSpikes();
    drawPlatforms();
    drawBoss();

    // ... (rest of game loop)

    requestAnimationFrame(gameLoop);
}

// Start game (add music)
function initGame() {
    startMusic();
    gameLoop();
}

initGame();
