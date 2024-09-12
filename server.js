const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const scores = [];

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('updateScore', (score) => {
        const playerScore = { id: socket.id, score: score };
        const index = scores.findIndex(s => s.id === socket.id);
        if (index !== -1) {
            scores[index] = playerScore;
        } else {
            scores.push(playerScore);
        }
        scores.sort((a, b) => b.score - a.score);
        io.emit('leaderboard', scores.slice(0, 10));
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        const index = scores.findIndex(s => s.id === socket.id);
        if (index !== -1) {
            scores.splice(index, 1);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});