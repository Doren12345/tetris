const gameState = require("../model/gameState");

function createPiece() {
    const pieces = [
        { shape: [[1, 1, 1, 1]], color: 0x00FFFF }, // I - Light Blue
        { shape: [[1, 1], [1, 1]], color: 0xFFFF00 }, // O - Yellow
        { shape: [[1, 1, 1], [0, 1, 0]], color: 0x800080 }, // T - Purple
        { shape: [[1, 1, 1], [1, 0, 0]], color: 0xFFA500 }, // L - Orange
        { shape: [[1, 1, 1], [0, 0, 1]], color: 0x0000FF }, // J - Blue
        { shape: [[1, 1, 0], [0, 1, 1]], color: 0x00FF00 }, // S - Green
        { shape: [[0, 1, 1], [1, 1, 0]], color: 0xFF0000 }  // Z - Red
    ];
    const piece = pieces[Math.floor(Math.random() * pieces.length)];
    const x = Math.floor(gameState.gridWidth / 2) - Math.floor(piece.shape[0].length / 2);
    const y = 0;
    const newPiece = { shape: piece.shape, x, y, color: piece.color };

    return newPiece;
}



function checkCollision(piece, grid) {
    return piece.shape.some((row, y) =>
        row.some((cell, x) =>
            cell && (
                piece.x + x < 0 ||
                piece.x + x >= gameState.gridWidth ||
                piece.y + y >= gameState.gridHeight ||
                (grid[piece.y + y] && grid[piece.y + y][piece.x + x])
            )
        )
    );
}

function lockPiece(piece, grid) {
    piece.shape.forEach((row, y) => {
        row.forEach((cell, x) => {
            if (cell) {
                const newY = piece.y + y;
                const newX = piece.x + x;

                if (newY >= 0 && newY < gameState.gridHeight && newX >= 0 && newX < gameState.gridWidth) {
                    if (!grid[newY]) {
                        console.error(`Row ${newY} is undefined.`);
                    } else {
                        grid[newY][newX] = { color: piece.color }; // Store the piece color
                    }
                } else {
                    console.error(`Invalid position: (${newX}, ${newY})`);
                }
            }
        });
    });
}



function clearLines(grid) {
    let linesCleared = 0;
    for (let y = gameState.gridHeight - 1; y >= 0; y--) {
        if (grid[y].every(cell => cell)) {
            grid.splice(y, 1);
            grid.unshift(Array(gameState.gridWidth).fill(null));
            linesCleared++;
            y++;
        }
    }
    return linesCleared;
}

function dropPiece(socket) {
    const playerState = gameState.players[socket.id];
    if (!playerState || !playerState.currentPiece) return;

    playerState.currentPiece.y++;

    if (checkCollision(playerState.currentPiece, playerState.grid)) {
        playerState.currentPiece.y--;

        // Lock the current piece in place
        lockPiece(playerState.currentPiece, playerState.grid);

        // Create a new piece
        playerState.currentPiece = createPiece(socket.id);

        // Check if the new piece immediately collides (meaning game over)
        if (checkCollision(playerState.currentPiece, playerState.grid)) {
            socket.emit('gameOver', playerState.score);
            delete gameState.players[socket.id];
            return;
        }

        // Clear filled lines and update score
        const linesCleared = clearLines(playerState.grid);
        if (linesCleared > 0) {
            playerState.score += linesCleared * 100;
            socket.emit('leaderboard', Object.values(gameState.players).sort((a, b) => b.score - a.score).slice(0, 10));
        }
    }

    socket.emit('gameState', playerState);
}


module.exports = {
    createPiece,
    checkCollision,
    lockPiece,
    clearLines,
    dropPiece
}
