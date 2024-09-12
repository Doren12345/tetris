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
        this.currentPiece = null;
        this.drawGrid();

        this.score = 0;
        this.scoreText = this.add.text(10, 10, `Score: ${this.score}`, { fontSize: '18px', fill: '#fff' });

        this.savedPiece = null; // Variable to store the saved piece
        this.savedPieceGraphics = this.add.graphics(); // Graphics object to draw the saved piece

        // Draw the saved piece area
        this.savedPieceArea = this.add.graphics();
        this.savedPieceArea.fillStyle(0xCCCCCC, 0.5);
        this.savedPieceArea.fillRect(10, 10, this.blockSize * 4, this.blockSize * 4); // Adjust size as needed
        this.savedPieceArea.strokeRect(10, 10, this.blockSize * 4, this.blockSize * 4); // Outline the area

        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.sKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.cKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C); // Add C key

        this.inputTimer = this.time.addEvent({
            delay: 40, //ms
            callback: this.handleInput,
            callbackScope: this,
            loop: true
        });

        this.dropTimer = this.time.addEvent({
            delay: 1000,
            callback: this.sendDropPiece,
            callbackScope: this,
            loop: true
        });

        // Request initial game state from server
        socket.emit('requestInitialState');
        socket.on('gameState', (playerState) => {
            // Update the current player's game state
            this.grid = playerState.grid;
            this.currentPiece = playerState.currentPiece;
            this.score = playerState.score;

            if (this.scoreText) {
                this.scoreText.setText(`Score: ${this.score}`);
            } else {
                console.error('scoreText is not defined');
            }

            this.drawGrid();
        });
        socket.on('gameOver', (score) => {
            console.log('Game Over received with score:', score);
            this.gameOver();
        });
    }

    update() {
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            socket.emit('dropToBottom');
        }

        // Check if 'S' is pressed to save or swap the piece
        if (Phaser.Input.Keyboard.JustDown(this.sKey)) {
            this.saveOrSwapPiece();
        }

        // Check if 'C' is pressed to save or swap the piece
        if (Phaser.Input.Keyboard.JustDown(this.cKey)) {
            this.saveOrSwapPiece();
        }
    }

    saveOrSwapPiece() {
        // If there is a saved piece, swap it with the current piece
        if (this.savedPiece) {
            const temp = this.currentPiece;
            this.currentPiece = this.savedPiece;
            this.savedPiece = temp;
        } else {
            // Save the current piece and generate a new piece
            this.savedPiece = this.currentPiece;
            this.currentPiece = this.generateNewPiece(); // Ensure this method exists and generates a new piece
        }

        // Emit the updated state to the server
        socket.emit('updatePiece', {
            currentPiece: this.currentPiece,
            savedPiece: this.savedPiece
        });

        // Redraw the grid and saved piece display
        this.drawGrid();
        this.drawSavedPiece();
    }

    generateNewPiece() {
        const pieces = [
            { shape: [[1, 1, 1, 1]], color: 0x87CEFA }, // I
            { shape: [[1, 1], [1, 1]], color: 0xFFFF00 }, // O
            { shape: [[1, 1, 1], [0, 1, 0]], color: 0x800080 }, // T
            { shape: [[1, 1, 1], [1, 0, 0]], color: 0xFFA500 }, // L
            { shape: [[1, 1, 1], [0, 0, 1]], color: 0x0000FF }, // J
            { shape: [[1, 1, 0], [0, 1, 1]], color: 0x00FF00 }, // S
            { shape: [[0, 1, 1], [1, 1, 0]], color: 0xFF0000 }  // Z
        ];
        const piece = pieces[Math.floor(Math.random() * pieces.length)];
        const x = Math.floor(this.gridWidth / 2) - Math.floor(piece.shape[0].length / 2);
        const y = 0;
        return { shape: piece.shape, x, y, color: piece.color };
    }

    drawSavedPiece() {
        this.savedPieceGraphics.clear();

        if (this.savedPiece) {
            this.savedPieceGraphics.fillStyle(this.savedPiece.color); // Use the saved piece color
            this.savedPiece.shape.forEach((row, y) => {
                row.forEach((cell, x) => {
                    if (cell) {
                        this.savedPieceGraphics.fillRect(
                            15 + x * this.blockSize, // Position within the saved piece area
                            15 + y * this.blockSize, // Position within the saved piece area
                            this.blockSize - 1,
                            this.blockSize - 1
                        );
                    }
                });
            });
        }
    }

    handleInput() {
        if (this.cursors.left.isDown) {
            socket.emit('movePiece', -1);
        }
        if (this.cursors.right.isDown) {
            socket.emit('movePiece', 1);
        }
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            socket.emit('rotatePiece');
        }
        if (this.cursors.down.isDown) {
            socket.emit('dropPiece');
        }
    }

    sendDropPiece() {
        socket.emit('dropPiece');
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
                const cell = this.grid[y][x];
                if (cell) {
                    this.gridGraphics.fillStyle(cell.color || 0xFFFFFF); // Use the cell color
                    this.gridGraphics.fillRect(x * this.blockSize, y * this.blockSize, this.blockSize - 1, this.blockSize - 1);
                }
            }
        }

        // Draw the shadow (ghost) piece
        if (this.currentPiece) {
            const shadowPiece = this.calculateShadowPiece();

            this.gridGraphics.fillStyle(0xAAAAAA, 0.5); // Light grey with high transparency
            shadowPiece.shape.forEach((row, y) => {
                row.forEach((cell, x) => {
                    if (cell) {
                        this.gridGraphics.fillRect(
                            (shadowPiece.x + x) * this.blockSize,
                            (shadowPiece.y + y) * this.blockSize,
                            this.blockSize - 1,
                            this.blockSize - 1
                        );
                    }
                });
            });

            // Draw the current piece
            this.gridGraphics.fillStyle(this.currentPiece.color); // Use the color of the current piece
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


    }
    calculateShadowPiece() {
        const shadowPiece = { ...this.currentPiece };

        while (!this.checkCollision(shadowPiece)) {
            shadowPiece.y++;
        }

        shadowPiece.y--; // Move it back up one row

        return shadowPiece;
    }

    checkCollision(piece) {
        return piece.shape.some((row, y) => {
            return row.some((cell, x) => {
                if (cell) {
                    const newX = piece.x + x;
                    const newY = piece.y + y;
                    return (
                        newX < 0 ||
                        newX >= this.gridWidth ||
                        newY >= this.gridHeight ||
                        this.grid[newY] && this.grid[newY][newX]
                    );
                }
                return false;
            });
        });
    }

    gameOver() {
        this.scene.pause();
        this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'Game Over', { fontSize: '32px', fill: '#fff' }).setOrigin(0.5);
        socket.emit('updateScore', this.score);
    }
}

const config = { type: Phaser.AUTO, width: 300, height: 600, scene: TetrisGame };

const game = new Phaser.Game(config);