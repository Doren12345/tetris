const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const gameState = {
    gridWidth: 10,
    gridHeight: 20,
    blockSize: 30,
    players: {}
};

function createPiece(playerId) {
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

function createPiece(playerId) {
    const pieces = [
        { shape: [[1, 1, 1, 1]], color: 0x87CEFA }, // I (light blue)
        { shape: [[1, 1], [1, 1]], color: 0xFFFF00 }, // O (yellow)
        { shape: [[1, 1, 1], [0, 1, 0]], color: 0x800080 }, // T (purple)
        { shape: [[1, 1, 1], [1, 0, 0]], color: 0xFFA500 }, // L (orange)
        { shape: [[1, 1, 1], [0, 0, 1]], color: 0x0000FF }, // J (blue)
        { shape: [[1, 1, 0], [0, 1, 1]], color: 0x00FF00 }, // S (green)
        { shape: [[0, 1, 1], [1, 1, 0]], color: 0xFF0000 }  // Z (red)
    ];
    const piece = pieces[Math.floor(Math.random() * pieces.length)];
    const x = Math.floor(gameState.gridWidth / 2) - Math.floor(piece.shape[0].length / 2);
    const y = 0;
    const newPiece = { shape: piece.shape, x, y, color: piece.color };

    return newPiece;
}


io.on('connection', (socket) => {
    console.log('A user connected');

    // Initialize game state for new player
    gameState.players[socket.id] = {
        id: socket.id,
        grid: Array(20).fill().map(() => Array(10).fill(null)),
        currentPiece: createPiece(socket.id),
        score: 0
    };

    socket.on('requestInitialState', () => {
        socket.emit('gameState', gameState.players[socket.id]);
    });

    socket.on('movePiece', (direction) => {
        const playerState = gameState.players[socket.id];
        playerState.currentPiece.x += direction;
        if (checkCollision(playerState.currentPiece, playerState.grid)) {
            playerState.currentPiece.x -= direction;
        }
        socket.emit('gameState', playerState);
    });

    socket.on('updatePiece', ({ currentPiece, savedPiece }) => {
        const playerState = gameState.players[socket.id];
        if (playerState) {
            playerState.currentPiece = currentPiece;
            playerState.savedPiece = savedPiece;
            socket.emit('gameState', playerState);
        }
    });

    socket.on('rotatePiece', () => {
        const playerState = gameState.players[socket.id];
        const rotatedPiece = playerState.currentPiece.shape[0].map((_, i) => playerState.currentPiece.shape.map(row => row[i])).reverse();
        const oldShape = playerState.currentPiece.shape;
        playerState.currentPiece.shape = rotatedPiece;
        if (checkCollision(playerState.currentPiece, playerState.grid)) {
            playerState.currentPiece.shape = oldShape;
        }
        socket.emit('gameState', playerState);
    });

    socket.on('dropPiece', () => {
        dropPiece(socket);
    });

    socket.on('dropToBottom', () => {
        const playerState = gameState.players[socket.id];
        while (!checkCollision(playerState.currentPiece, playerState.grid)) {
            playerState.currentPiece.y++;
        }
        playerState.currentPiece.y--;
        dropPiece(socket);
    });

    socket.on('updateScore', (score) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].score = score;
        }
    });

    socket.on('disconnect', () => {
        delete gameState.players[socket.id];
        console.log('A user disconnected');
    });
});



http.listen(25565, () => {
    console.log('Server is running on port 25565');
});