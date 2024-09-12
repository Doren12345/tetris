const socket = io();

class TetrisGame extends Phaser.Scene {
    constructor() {
        super('TetrisGame');
    }

    preload() {
        this.load.image('block', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/games/blockade/block.png');
    }

    create() {
        this.gridWidth = 10;
        this.gridHeight = 20;
        this.blockSize = 30;

        this.grid = Array(this.gridHeight).fill().map(() => Array(this.gridWidth).fill(null));

        this.currentPiece = this.createPiece();
        this.drawGrid();

        this.score = 0;
        this.scoreText = this.add.text(10, 10, `Score: ${this.score}`, { fontSize: '18px', fill: '#fff' });

        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.inputTimer = this.time.addEvent({
            delay: 20, //ms
            callback: this.handleInput,
            callbackScope: this,
            loop: true
        });

        this.dropTimer = this.time.addEvent({
            delay: 1000,
            callback: this.dropPiece,
            callbackScope: this,
            loop: true
        });
    }

    update() {
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.dropToBottom();
        }
    }

    handleInput() {
        if (this.cursors.left.isDown) {
            this.movePiece(-1);
        }
        if (this.cursors.right.isDown) {
            this.movePiece(1);
        }
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            this.rotatePiece();
        }
        if (this.cursors.down.isDown) {
            this.dropPiece();
        }
    }

    createPiece() {
        const pieces = [
            [[1,1,1,1]],
            [[1,1],[1,1]],
            [[1,1,1],[0,1,0]],
            [[1,1,1],[1,0,0]],
            [[1,1,1],[0,0,1]],
            [[1,1,0],[0,1,1]],
            [[0,1,1],[1,1,0]]
        ];
        const piece = Phaser.Utils.Array.GetRandom(pieces);
        const x = Math.floor(this.gridWidth / 2) - Math.floor(piece[0].length / 2);
        const y = 0;
        return { shape: piece, x, y };
    }

    drawGrid() {
        if (this.gridGraphics) {
            this.gridGraphics.clear();
        } else {
            this.gridGraphics = this.add.graphics();
        }

        // Draw the grid
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.grid[y][x]) {
                    this.gridGraphics.fillStyle(0xFFFFFF);
                    this.gridGraphics.fillRect(x * this.blockSize, y * this.blockSize, this.blockSize - 1, this.blockSize - 1);
                }
            }
        }

        // Draw the current piece
        this.gridGraphics.fillStyle(0xFFFF00);
        this.currentPiece.shape.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell) {
                    this.gridGraphics.fillRect(
                        (this.currentPiece.x + x) * this.blockSize,
                        (this.currentPiece.y + y) * this.blockSize,
                        this.blockSize - 1,
                        this.blockSize - 1
                    );
                }
            });
        });
    }

    movePiece(direction) {
        this.currentPiece.x += direction;
        if (this.checkCollision()) {
            this.currentPiece.x -= direction;
        } else {
            this.drawGrid();
        }
    }

    rotatePiece() {
        const rotated = this.currentPiece.shape[0].map((_, index) =>
            this.currentPiece.shape.map(row => row[index]).reverse()
        );
        const previousShape = this.currentPiece.shape;
        this.currentPiece.shape = rotated;
        if (this.checkCollision()) {
            this.currentPiece.shape = previousShape;
        } else {
            this.drawGrid();
        }
    }

    dropPiece() {
        this.currentPiece.y++;
        if (this.checkCollision()) {
            this.currentPiece.y--;
            this.lockPiece();
            this.clearLines();
            this.currentPiece = this.createPiece();
            if (this.checkCollision()) {
                this.gameOver();
            }
        }
        this.drawGrid();
    }

    dropToBottom() {
        while (!this.checkCollision()) {
            this.currentPiece.y++;
        }
        this.currentPiece.y--;
        this.lockPiece();
        this.clearLines();
        this.currentPiece = this.createPiece();
        if (this.checkCollision()) {
            this.gameOver();
        }
        this.drawGrid();
    }

    checkCollision() {
        return this.currentPiece.shape.some((row, y) =>
            row.some((cell, x) =>
                cell && (
                    this.currentPiece.x + x < 0 ||
                    this.currentPiece.x + x >= this.gridWidth ||
                    this.currentPiece.y + y >= this.gridHeight ||
                    (this.grid[this.currentPiece.y + y] && this.grid[this.currentPiece.y + y][this.currentPiece.x + x])
                )
            )
        );
    }

    lockPiece() {
        this.currentPiece.shape.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell) {
                    this.grid[this.currentPiece.y + y][this.currentPiece.x + x] = 1;
                }
            });
        });
    }

    clearLines() {
        let linesCleared = 0;
        for (let y = this.gridHeight - 1; y >= 0; y--) {
            if (this.grid[y].every(cell => cell)) {
                this.grid.splice(y, 1);
                this.grid.unshift(Array(this.gridWidth).fill(null));
                linesCleared++;
                y++;
            }
        }
        if (linesCleared > 0) {
            this.score += linesCleared * 100;
            this.scoreText.setText(`Score: ${this.score}`);
            socket.emit('updateScore', this.score);
        }
    }

    gameOver() {
        this.scene.pause();
        this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'Game Over', { fontSize: '32px', fill: '#fff' }).setOrigin(0.5);
        socket.emit('updateScore', this.score);
    }
}

const config = {
    type: Phaser.AUTO,
    width: 300,
    height: 600,
    parent: 'game-container',
    scene: TetrisGame
};

const game = new Phaser.Game(config);

socket.on('leaderboard', (scores) => {
    console.log('Leaderboard:', scores);
});