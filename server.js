const /*pieceManager*/{ createPiece, checkCollision, lockPiece, clearLines, dropPiece } = require("./manager/pieceManager");

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const gameState = require("./model/gameState");


io.on('connection', (socket) => {
    console.log('A user connected');

    // Initialize game state for new player
    gameState.players[socket.id] = {
        id: socket.id,
        grid: Array(20).fill().map(() => Array(10).fill(null)),
        currentPiece: createPiece(),
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