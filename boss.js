let boss = {
    x: canvas.width - 100,
    y: canvas.height - 100,
    width: 60,
    height: 60,
    health: 100,
    speed: 2,
    direction: 1
};

// Draw boss
function drawBoss() {
    ctx.fillStyle = "#FF0000";
    ctx.fillRect(boss.x, boss.y, boss.width, boss.height);
}

// Update boss position
function updateBoss() {
    boss.x += boss.speed * boss.direction;
    if (boss.x <= 0 || boss.x + boss.width >= canvas.width) {
        boss.direction *= -1;
    }
}

// Check boss collision
function checkBossCollision() {
    if (duck.x < boss.x + boss.width &&
        duck.x + duck.width > boss.x &&
        duck.y < boss.y + boss.height &&
        duck.y + duck.height > boss.y) {
        gameOver();
    }
}

// Reset boss
function resetBoss() {
    boss = {
        x: canvas.width - 100,
        y: canvas.height - 100,
        width: 60,
        height: 60,
        health: 100,
        speed: 2,
        direction: 1
    };
}
