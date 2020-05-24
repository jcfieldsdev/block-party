/******************************************************************************
 * Block Party                                                                *
 *                                                                            *
 * Copyright (C) 2020 J.C. Fields (jcfields@jcfields.dev).                    *
 *                                                                            *
 * Permission is hereby granted, free of charge, to any person obtaining a    *
 * copy of this software and associated documentation files (the "Software"), *
 * to deal in the Software without restriction, including without limitation  *
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,   *
 * and/or sell copies of the Software, and to permit persons to whom the      *
 * Software is furnished to do so, subject to the following conditions:       *
 *                                                                            *
 * The above copyright notice and this permission notice shall be included in *
 * all copies or substantial portions of the Software.                        *
 *                                                                            *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,   *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL    *
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING    *
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER        *
 * DEALINGS IN THE SOFTWARE.                                                  *
 ******************************************************************************/

"use strict";

/*
 * constants
 */

// gameplay
const ROWS = 12;
const COLS = 6;
const BLOCK_SIZE = 128;   // size of block in pixels
const MATCH_SIZE = 3;     // number of blocks required for match
const LEVELS = 10;
const TIER = 50;          // number of jewels per level
const TIER_INCREASE = 10; // increase per level (in standard mode)
const START_COLOR = 1;

// default options
const DEFAULT_START_LEVEL = 1;
const DEFAULT_DIFFICULTY = 6;
const DEFAULT_HEIGHT = 6;
const TIME_ATTACK_LENGTH = 300;
const TIME_ATTACK_FLASH = 60;

// display
const BLOCK_STROKE_WIDTH = 4;
const CURSOR_CELLS = 2;
const CURSOR_INSET = 6;
const CURSOR_SIZE = 32;
const CURSOR_COLOR = "#fff";
const CURSOR_WIDTH = 8;

// timing (in ms)
const DROP_DELAY = 1;
const FLASH_DELAY = 10;
const CLEAR_DELAY = 50;

// time in seconds for stack to rise from bottom to top of well,
// determines tick length
const SPEED = 200;
// number of ticks per block, higher is smoother
// should be divisor of block size for nice integer pixel values
const STEP = 64;

// speed of block swap animation, lower is prettier, higher is more responsive
const SWAP_STEP = 4;

// storage
const STORAGE_NAME = "puzzle";
const TABLE_SIZE = 5;
const STARTING_DIFFICULTY = 4, DIFFICULTY_LEVELS = 4, GAME_MODES = 2;
const STANDARD = 0, TIME_ATTACK = 1; // game modes

// block colors
const COLORS = [
	["#000",    "#404040"], // black
	["#0ff",    "#008080"], // cyan
	["#f00",    "#800000"], // red
	["#00f",    "#000080"], // blue
	["#ff0",    "#a0a000"], // yellow
	["#0f0",    "#008000"], // green
	["#f0f",    "#800080"], // fuschia
	["#ffa000", "#a04000"]  // orange
];

// background images
const IMAGES = [
	"grey", "cyan", "orange", "green", "blue",
	"yellow", "violet", "teal", "red", "white"
];

/*
 * initialization
 */

window.addEventListener("load", function() {
	const store = new Storage(STORAGE_NAME);
	const options = new Options();
	const scores = new Scores();

	const mem = store.load() || {};
	options.load(mem.options);
	scores.load(mem.scores);

	const game = new Game(options, scores);
	game.init();

	if (mem.game != undefined) {
		game.resume(mem.game);
	}

	window.addEventListener("blur", function() {
		game.pause(true);
	});
	window.addEventListener("beforeunload", function() {
		store.save({
			game:    game.save(),
			options: options.save(),
			scores:  scores.save()
		});
	});
	window.addEventListener("keydown", function(event) {
		const keyCode = event.keyCode;

		if (keyCode == 13 && !game.stopped) { // enter
			event.preventDefault();
			game.pause();
		}

		if (keyCode == 27 && !game.locked && game.stopped) {  // esc
			event.preventDefault();
			game.display.closeAllOverlays();
		}

		if (!game.paused && !game.locked && !game.stopped) {
			if (keyCode == 8) { // backspace
				event.preventDefault();
				resetGame();
			}

			if (keyCode == 16) { // shift
				game.push();
			}

			if (keyCode == 32 || keyCode == 35) { // space bar or end
				event.preventDefault();
				game.swap();
			}

			if (keyCode == 37 || keyCode == 65) { // left or A
				event.preventDefault();
				game.cursor.moveLeft();
			}

			if (keyCode == 38 || keyCode == 87) { // up or W
				event.preventDefault();
				game.cursor.moveUp();
			}

			if (keyCode == 39 || keyCode == 68) { // right or D
				event.preventDefault();
				game.cursor.moveRight();
			}

			if (keyCode == 40 || keyCode == 83) { // down or S
				event.preventDefault();
				game.cursor.moveDown();
			}
		}
	});

	document.addEventListener("click", function(event) {
		const element = event.target;

		if (element.matches("button")) {
			element.blur();
		}

		if (element.matches("#play")) {
			if (game.stopped) {
				game.play();
			} else {
				game.pause();
			}
		}

		if (element.matches("#scores")) {
			const mode = options.read("mode");
			const difficulty = options.read("difficulty");
			game.display.showScores(game.scores, mode, difficulty, false);

			setSelect("mode", mode);
			setSelect("colors", difficulty);
		}

		if (element.matches("#options")) {
			setSliders();
		}

		if (element.matches("#reset")) {
			resetGame();
		}

		if (element.matches("#swap")) {
			if (!game.paused && !game.locked && !game.stopped) {
				game.swap();
			}
		}

		if (element.matches("#left")) {
			if (!game.paused && !game.locked && !game.stopped) {
				game.cursor.moveLeft();
			}
		}

		if (element.matches("#up")) {
			if (!game.paused && !game.locked && !game.stopped) {
				game.cursor.moveUp();
			}
		}

		if (element.matches("#down")) {
			if (!game.paused && !game.locked && !game.stopped) {
				game.cursor.moveDown();
			}
		}

		if (element.matches("#right")) {
			if (!game.paused && !game.locked && !game.stopped) {
				game.cursor.moveRight();
			}
		}

		if (element.matches("#prompt button")) {
			submitScore();
		}

		if (element.matches(".toggle")) {
			$("#overlay_" + element.value).classList.toggle("open");

			for (const overlay of $$(".overlay")) { // hides other open overlays
				if (!overlay.id.endsWith(element.value)) {
					overlay.classList.remove("open");
				}
			}
		}

		if (element.matches(".close")) {
			$("#overlay_" + element.value).classList.remove("open");
		}
	});
	document.addEventListener("input", function(event) {
		const element = event.target;

		if (element.matches('input[type="range"]')) {
			setSliders();
		}

		if (element.matches("#overlay_scores select")) {
			const mode = $("#mode").value;
			const difficulty = $("#colors").value;
			game.display.showScores(game.scores, mode, difficulty, false);
		}
	});
	document.addEventListener("keydown", function(event) {
		const element = event.target;

		if (element.matches("#prompt input")) {
			if (event.keyCode == 13) { // enter
				submitScore();
			}
		}
	});

	function resetGame() {
		game.reset();
		game.init();
	}

	function setSelect(id, value) {
		const select = $("#" + id);
		const options = Array.from(select.options);

		select.selectedIndex = options.findIndex(function(option) {
			return option.value == value;
		});
	}

	function setSliders() {
		$("#showDifficulty").textContent = $("#difficulty").value;
		$("#showStart").textContent = $("#start").value;
		$("#showHeight").textContent = $("#height").value;
	}

	function submitScore() {
		const input = $("#prompt input");

		if (input.value == "") {
			return;
		}

		game.scores.add(
			input.value, game.mode, game.difficulty,
			game.time, game.level, game.score, game.jewels
		);
		game.display.showScores(game.scores, game.mode, game.difficulty, true);
		game.display.togglePrompt(false);
	}
});

function $(selector) {
	return document.querySelector(selector);
}

function $$(selector) {
	return Array.from(document.querySelectorAll(selector));
}

/*
 * Game prototype
 */

function Game(options, scores) {
	this.well = Array(ROWS + 1).fill().map(function() {
		return Array(COLS).fill(0);
	});

	this.mode = STANDARD;
	this.difficulty = DEFAULT_DIFFICULTY;

	this.time = 1;
	this.score = 0;
	this.level = 1;
	this.jewels = 0;

	this.loop = null;
	this.timer = null;

	this.paused = false; // user pause
	this.locked = false; // hold for delays
	this.stopped = true; // game not playing

	this.options = options;
	this.scores = scores;
	this.display = new Display();
	this.cursor = null;

	this.fraction = 0;
}

Game.prototype.init = function() {
	this.display.init();

	this.cursor = new Cursor(
		Math.floor(COLS / 2) - 1,
		ROWS - this.options.read("height") - 1,
		this.display
	);
};

Game.prototype.play = function() {
	// reloads options every new game in case player changed something
	this.options.load(this.options.save());
	this.display.closeAllOverlays(); // makes sure options screen is closed

	this.difficulty = this.options.read("difficulty");
	this.level = this.options.read("start");
	this.mode = this.options.read("mode");

	if (this.mode == TIME_ATTACK) {
		this.time = TIME_ATTACK_LENGTH;
	}

	this.fillHeight();

	this.display.changeBackdrop(this.level - 1);
	this.display.drawCursor(this.cursor);
	this.display.startGame(this.mode);

	this.locked = false;

	this.loop = this.createLoop(this.level);
	this.timer = this.createTimer();
};

Game.prototype.resume = function(obj) {
	this.well = obj.well;
	this.time = obj.time;
	this.fraction = obj.fraction;

	this.score  = obj.score;
	this.level  = obj.level;
	this.jewels = obj.jewels;

	this.difficulty = this.options.read("difficulty");
	this.mode = this.options.read("mode");

	this.cursor.x = obj.cursor.x;
	this.cursor.y = obj.cursor.y;
	this.cursor.fraction = obj.fraction;

	this.display.changeBackdrop(this.level - 1);
	this.display.updateStats(this.level, this.score, this.jewels);
	this.display.updateTime(this.time);
	this.display.startGame(this.mode);

	this.loop = this.createLoop(this.level);
	this.timer = this.createTimer();

	this.scroll(); // draws well
	this.cursor.scroll();

	this.pause();
};

Game.prototype.createLoop = function(level) {
	this.stopped = false;

	// calculates stepping between fastest speed (1 ms) and slowest (SPEED)
	const FACTOR = ((SPEED - 1) / LEVELS) * level;

	return window.setInterval(function() {
		if (!this.paused && !this.locked && !this.stopped) {
			this.scroll();
			this.cursor.scroll();
			this.display.updateStats(this.level, this.score, this.jewels);

			if (level != this.level) {
				window.clearInterval(this.loop);
				this.loop = this.createLoop(this.level);
			}

			if (this.mode == TIME_ATTACK && this.time <= 0) {
				this.gameOver(); // checks time attack victory condition
			}
		}
	}.bind(this), ((SPEED - FACTOR) * 1000) / (STEP * ROWS));
};

Game.prototype.createTimer = function() {
	return window.setInterval(function() {
		if (!this.paused && !this.stopped) {
			if (this.mode == TIME_ATTACK) {
				this.time--;
			} else {
				this.time++;
			}

			this.display.updateTime(this.time);
		}
	}.bind(this), 1000);
};

Game.prototype.scroll = async function() {
	for (let y = 0; y < this.well.length; y++) {
		for (let x = 0; x < this.well[y].length; x++) {
			if (this.well[y][x] > 0) {
				this.display.clearCell(x, y, this.fraction);
			}
		}
	}

	if (this.fraction < STEP - 1) { // scrolls well up
		this.fraction++;

		// checks for defeat condition
		const filled = this.well[0].some(function(color) {
			return color > 0;
		});

		if (filled) {
			this.gameOver();
		}
	} else { // generates new line
		this.fraction = 0;
		await this.push();
	}

	for (let y = 0; y < this.well.length; y++) {
		for (let x = 0; x < this.well[y].length; x++) {
			const color = this.well[y][x];

			if (color > 0) {
				this.display.drawCell(x, y, color, this.fraction);
			}
		}
	}
};

Game.prototype.pause = function(state) {
	if (!this.stopped) {
		if (state == undefined || typeof state != "boolean") {
			state = !this.paused; // toggles if no state specified
		}

		this.paused = state;
		this.display.pauseGame(state);
	}
};

Game.prototype.stop = function() {
	window.clearInterval(this.loop);  // game loop
	window.clearInterval(this.timer); // timer

	this.pause(false); // makes sure pause button/overlay off
	this.locked = true;
	this.stopped = true;

	this.display.stopGame();
};

Game.prototype.save = function() {
	if (!this.stopped) {
		return {
			well:     this.well,
			time:     this.time,
			score:    this.score,
			level:    this.level,
			jewels:   this.jewels,
			cursor:   {x: this.cursor.x, y: this.cursor.y},
			fraction: this.fraction
		};
	}
};

Game.prototype.reset = function() {
	this.stop();
	this.display.resetGame();

	this.well = Array(ROWS + 1).fill().map(function() {
		return Array(COLS).fill(0);
	});

	this.time = 1;
	this.score = 0;
	this.level = 1;
	this.jewels = 0;

	this.fraction = 0;
};

Game.prototype.push = async function() {
	this.well.shift();
	this.well.push(Array(COLS).fill(0));

	this.generateLine(this.well.length - 1);

	this.locked = true;
	await this.findMatches();
	this.locked = false;
};

Game.prototype.swap = async function() {
	const x = this.cursor.x, y = this.cursor.y;
	const cell1 = this.well[y][x], cell2 = this.well[y][x + 1];

	this.well[y][x]     = cell2;
	this.well[y][x + 1] = cell1;

	this.locked = true;
	await this.display.swapCells(x, y, cell1, cell2, this.fraction);
	await this.findMatches();
	this.locked = false;

	// adjusts jewels needed for next level for starting level
	const start = this.options.read("start");
	let adjustedJewels = this.level * TIER - (start - 1) * TIER;

	// level threshold increases by ten for each level in standard mode
	if (this.mode == STANDARD && this.level > 1) {
		// triangular number;
		// calculates sum of previous values without iteration
		const level = this.level - 1;
		adjustedJewels += TIER_INCREASE * (level * (level + 1)) / 2;
	}

	if (this.jewels >= adjustedJewels && this.level < LEVELS) {
		this.level++;
		this.display.changeBackdrop();
	}
};

Game.prototype.gameOver = async function() {
	this.stop();

	await this.display.gameOver();
	this.display.clearCursor(this.cursor);
	this.display.showScores(this.scores, this.mode, this.difficulty, true);

	// prompts to save high score if game does not end in defeat condition
	if (this.mode == STANDARD || this.time <= 0) {
	  	this.display.togglePrompt(this.scores.check(
	  		this.mode, this.difficulty,
	  		this.time, this.score
		));
	} else {
		this.display.togglePrompt(false);
	}
};

Game.prototype.findMatches = async function(chain=0) {
	const well = this.well;
	const matches = [];

	// checks for drops before checking for matches to avoid case
	// when block matches over gap
	await this.display.dropMultiple(doGravity(), this.fraction);

	// matches horizontally
	scanMatrix(this.well, false);
	// matches vertically
	scanMatrix(transposeMatrix(this.well), true);

	const cleared = clearMatches();
	this.jewels += cleared.length;

	const points = cleared.length * 10 * this.level * (chain + 1);
	this.score += points;
	this.display.showPoints(points);

	const moved = doGravity();

	await this.display.clearMultiple(cleared, this.fraction);
	await this.display.dropMultiple(moved, this.fraction);

	if (cleared.length > 0 || moved.length > 0) {
		await this.findMatches(chain + 1);
	}

	function scanMatrix(grid, invertCoords=false) {
		for (let y = 0; y < grid.length; y++) {
			let currentColor = 0, prevColor = 0;
			let count = 0, match = [], found = false;

			for (let x = 0; x < grid[y].length; x++) {
				prevColor = currentColor;
				currentColor = grid[y][x];

				// non-consecutive block colors
				if (currentColor == 0 || currentColor != prevColor) {
					if (found) { // saves match if found
						found = false;
						matches.push(match);
					}

					count = 0;
					match = [];
				}

				count++;
				match.push(invertCoords ? {x: y, y: x} : {x, y});

				if (count >= MATCH_SIZE) {
					found = true;
				}
			}

			if (found) { // special case for matches at right end of well
				matches.push(match);
			}
		}
	}

	function transposeMatrix(oldGrid) {
		const newGrid = Array(COLS).fill().map(function() {
			return Array(ROWS).fill(0);
		});

		for (let y = 0; y < oldGrid.length; y++) {
			for (let x = 0; x < oldGrid[y].length; x++) {
				newGrid[x][y] = oldGrid[y][x];
			}
		}

		return newGrid;
	}

	function doGravity() {
		const moved = [];

		for (let y = well.length - 1; y >= 0; y--) {
			for (let x = 0; x < well[y].length; x++) {
				if (well[y][x] > 0) {
					continue; // cell is not empty
				}

				let n = 1;

				// finds next cell above current cell, which is not necessarily
				// the very next cell because of matches/clears
				while (well[y - n] != undefined) {
					if (well[y - n][x] > 0) {
						break;
					}

					n++;
				}

				// current cell is already highest
				// (next cell is out of bounds or not clear)
				if (well[y - n] == undefined || well[y - n][x] == 0) {
					continue;
				}

				moved.push({x, y, n, color: well[y - n][x]});

				well[y][x] = well[y - n][x];
				well[y - n][x] = 0;
			}
		}

		return moved;
	}

	function clearMatches() {
		const cleared = [];

		while (matches.length > 0) {
			const row = matches.pop();

			for (const cell of row) {
				cleared.push(cell);
				well[cell.y][cell.x] = 0;
			}
		}

		return cleared;
	}
};

Game.prototype.fillHeight = function() {
	const height = this.options.read("height") + 1;

	for (let y = this.well.length - height; y < this.well.length; y++) {
		this.generateLine(y);
	}
};

Game.prototype.generateLine = function(y) {
	const well = this.well;
	const complex = Math.floor(COLS / 2);

	// picks new starting color every other row to give more randomized
	// appearance
	let color = START_COLOR + Math.floor(Math.random() * this.difficulty);

	// goes through sequence in order unless there is a potential conflict;
	// choosing a random color for each cell often leads to situations
	// where there is no possible color left that does not cause a match
	for (let x = 0; x < this.well[y].length; color++, x++) {
		// loop breaks if number of iterations exceeds number of colors,
		// so it picks a color that causes a match rather than
		// infinite looping
		for (let i = 0; i < this.difficulty; color++, i++) {
			if (color >= this.difficulty + START_COLOR) {
				color = START_COLOR;
			}

			const matchesHorizontal = color != getValue(x - 1, y)
				|| color != getValue(x - 2, y);
			const matchesDiagonal1 = color != getValue(x - 1, y - 1)
				|| color != getValue(x - 2, y - 2);
			const matchesDiagonal2 = color != getValue(x + 1, y - 1)
				|| color != getValue(x + 2, y - 2);

			if (matchesHorizontal && matchesDiagonal1 && matchesDiagonal2) {
				const adj1 = color != getValue(x, y - 1);
				const adj2 = color != getValue(x, y - 2);

				// uses stricter matching rules at higher difficulties
				// (when there are more colors)
				if (
					(this.difficulty > complex && adj1 && adj2)
					|| (this.difficulty <= complex && (adj1 || adj2))
				) {
					break;
				}
			}
		}

		this.well[y][x] = color;
		this.display.drawCell(x, y, color, this.fraction);
	}

	function getValue(x, y) {
		if (well[y] == undefined) {
			return START_COLOR;
		}

		return well[y][x];
	}
};

/*
 * Cursor prototype
 */

function Cursor(x, y, display) {
	this.x = x;
	this.y = y;
	this.fraction = 0;

	this.display = display;
}

Cursor.prototype.moveLeft = function() {
	this.display.clearCursor(this);

	if (this.x > 0) {
		this.x--;
	}

	this.display.drawCursor(this);
};

Cursor.prototype.moveRight = function() {
	if (this.x == COLS - CURSOR_CELLS) {
		return;
	}

	this.display.clearCursor(this);

	if (this.x < COLS - 1) {
		this.x++;
	}

	this.display.drawCursor(this);
};

Cursor.prototype.moveUp = function() {
	this.display.clearCursor(this);

	if (this.y > 1) {
		this.y--;
	}

	this.display.drawCursor(this);
};

Cursor.prototype.moveDown = function() {
	this.display.clearCursor(this);

	if (this.y < ROWS - 1) {
		this.y++;
	}

	this.display.drawCursor(this);
};

Cursor.prototype.scroll = function() {
	this.display.clearCursor(this);

	if (this.y <= 0) {
		this.y++;
	}

	if (this.fraction < STEP - 1) {
		this.fraction++;
	} else {
		this.y--;
		this.fraction = 0;
	}

	this.display.drawCursor(this);
};

/*
 * Display prototype
 */

function Display() {
	this.context = null;
	this.cursorContext = null;

	this.index = 0;
	this.mode = STANDARD;
}

Display.prototype.init = function() {
	const canvas = $("#well");
	canvas.hidden = false;
	this.context = canvas.getContext("2d");
	this.context.canvas.width  = COLS * BLOCK_SIZE;
	this.context.canvas.height = ROWS * BLOCK_SIZE;
	this.context.lineWidth = BLOCK_STROKE_WIDTH;

	const cursorCanvas = $("#cursor");
	cursorCanvas.hidden = false;
	this.cursorContext = cursorCanvas.getContext("2d");
	this.cursorContext.canvas.width  = COLS * BLOCK_SIZE;
	this.cursorContext.canvas.height = ROWS * BLOCK_SIZE;

	if (document.documentElement.className == "") {
		this.changeBackdrop();
	}

	this.mode = STANDARD;

	this.closeAllOverlays();
	this.updateTime(0);
	this.updateStats(0, 0, 0);
};

Display.prototype.drawCursor = function(cursor) {
	for (let x = 0; x < CURSOR_CELLS; x++) {
		this.drawCursorCell(cursor.x + x, cursor.y, cursor.fraction);
	}
};

Display.prototype.drawCursorCell = function(x, y, fraction) {
	const cx = x * BLOCK_SIZE;
	const cy = y * BLOCK_SIZE;
	const offset = fraction/STEP * BLOCK_SIZE;

	this.cursorContext.beginPath();

	this.cursorContext.moveTo(
		cx + CURSOR_INSET,
		cy + CURSOR_INSET + CURSOR_SIZE - offset
	);
	this.cursorContext.lineTo(
		cx + CURSOR_INSET,
		cy + CURSOR_INSET - offset
	);
	this.cursorContext.lineTo(
		cx + CURSOR_INSET + CURSOR_SIZE,
		cy + CURSOR_INSET - offset
	);

	this.cursorContext.moveTo(
		cx - CURSOR_INSET + BLOCK_SIZE,
		cy + CURSOR_INSET + CURSOR_SIZE - offset
	);
	this.cursorContext.lineTo(
		cx - CURSOR_INSET + BLOCK_SIZE,
		cy + CURSOR_INSET - offset
	);
	this.cursorContext.lineTo(
		cx - CURSOR_INSET + BLOCK_SIZE - CURSOR_SIZE,
		cy + CURSOR_INSET - offset
	);

	this.cursorContext.moveTo(
		cx + CURSOR_INSET,
		cy - CURSOR_INSET + BLOCK_SIZE - CURSOR_SIZE - offset
	);
	this.cursorContext.lineTo(
		cx + CURSOR_INSET,
		cy - CURSOR_INSET + BLOCK_SIZE - offset
	);
	this.cursorContext.lineTo(
		cx + CURSOR_INSET + CURSOR_SIZE,
		cy - CURSOR_INSET + BLOCK_SIZE - offset
	);

	this.cursorContext.moveTo(
		cx - CURSOR_INSET + BLOCK_SIZE,
		cy - CURSOR_INSET + BLOCK_SIZE - CURSOR_SIZE - offset
	);
	this.cursorContext.lineTo(
		cx - CURSOR_INSET + BLOCK_SIZE,
		cy - CURSOR_INSET + BLOCK_SIZE - offset
	);
	this.cursorContext.lineTo(
		cx - CURSOR_INSET + BLOCK_SIZE - CURSOR_SIZE,
		cy - CURSOR_INSET + BLOCK_SIZE - offset
	);

	this.cursorContext.lineWidth = CURSOR_WIDTH;
	this.cursorContext.strokeStyle = CURSOR_COLOR;
	this.cursorContext.stroke();
};

Display.prototype.drawCell = function(x, y, color, yfraction=0, xfraction=0) {
	let cx = x * BLOCK_SIZE;
	let cy = y * BLOCK_SIZE;

	if (xfraction != 0) {
		cx -= xfraction/STEP * BLOCK_SIZE;
	}

	if (yfraction != 0) {
		cy -= yfraction/STEP * BLOCK_SIZE;
	}

	const gradient = this.context.createLinearGradient(
		cx, cy,
		cx + BLOCK_SIZE, cy + BLOCK_SIZE
	);
	gradient.addColorStop(0, COLORS[color][0]);
	gradient.addColorStop(1, COLORS[color][1]);

	this.context.fillStyle = gradient;
	this.context.fillRect(cx, cy, BLOCK_SIZE, BLOCK_SIZE);

	this.context.strokeStyle = COLORS[color][0];
	this.context.strokeRect(
		cx + BLOCK_STROKE_WIDTH, cy + BLOCK_STROKE_WIDTH,
		BLOCK_SIZE - BLOCK_STROKE_WIDTH * 2, BLOCK_SIZE - BLOCK_STROKE_WIDTH * 2
	);
};

Display.prototype.dropCell = function(x, y, color, fraction=0, n=1) {
	// calculates steps between old and new positions
	const limit = n * STEP - fraction;
	this.clearCell(x, y, fraction);

	return new Promise(function(resolve) {
		let steps = 0;

		const timer = window.setInterval(function() {
			this.clearCell(x, y + Math.floor(steps/STEP), -steps % STEP);

			// skips frames so higher drops are faster
			steps = Math.min(steps + n, limit);

			if (steps >= limit) {
				window.clearInterval(timer);
				resolve();
			}

			this.drawCell(x, y + Math.floor(steps/STEP), color, -steps % STEP);
		}.bind(this), DROP_DELAY);
	}.bind(this));
};

Display.prototype.clearAll = function() {
	const canvas = $("#well");
	this.context.clearRect(0, 0, canvas.width, canvas.height);

	const cursorCanvas = $("#cursor");
	this.cursorContext.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
};

Display.prototype.clearCell = function(x, y, fraction=0) {
	this.context.clearRect(
		x * BLOCK_SIZE, y * BLOCK_SIZE - fraction/STEP * BLOCK_SIZE,
		BLOCK_SIZE, BLOCK_SIZE
	);
};

Display.prototype.flashyClearCell = function(x, y, fraction=0) {
	return new Promise(function(resolve) {
		let color = 0;

		// flashes border before clearing
		const timer = window.setInterval(function() {
			if (color >= COLORS.length) {
				this.clearCell(x, y, fraction);

				window.clearInterval(timer);
				resolve();
				return;
			}

			this.drawCell(x, y, color, fraction);
			color++;
		}.bind(this), CLEAR_DELAY);
	}.bind(this));
};

Display.prototype.clearCursor = function(cursor) {
	for (let x = 0; x < CURSOR_CELLS; x++) {
		this.clearCursorCell(cursor.x + x, cursor.y, cursor.fraction);
	}
};

Display.prototype.clearCursorCell = function(x, y, fraction) {
	const cx = x * BLOCK_SIZE;
	const cy = y * BLOCK_SIZE;

	this.cursorContext.clearRect(
		cx, cy - fraction/STEP * BLOCK_SIZE,
		cx + BLOCK_SIZE, cy + BLOCK_SIZE - fraction/STEP * BLOCK_SIZE
	);
};

Display.prototype.clearMultiple = function(cleared, fraction) {
	const promises = [];

	for (const cell of cleared) {
		promises.push(this.flashyClearCell(cell.x, cell.y, fraction));
	}

	return Promise.all(promises);
};

Display.prototype.dropMultiple = function(moved, fraction) {
	const promises = [];

	for (const cell of moved) {
		promises.push(this.dropCell(
			cell.x, cell.y - cell.n,
			cell.color,
			fraction,
			cell.n
		));
	}

	return Promise.all(promises);
};

Display.prototype.swapCells = function(x, y, cell1, cell2, fraction) {
	return new Promise(function(resolve) {
		let steps = 0;

		const timer = window.setInterval(function() {
			this.clearCell(x, y, fraction);
			this.clearCell(x + 1, y, fraction);

			steps += SWAP_STEP;

			if (steps >= STEP) {
				window.clearInterval(timer);
				resolve();
			}

			if (cell1 > 0) {
				this.drawCell(x, y, cell1, fraction, -steps);
			}

			if (cell2 > 0) {
				this.drawCell(x + 1, y, cell2, fraction, steps);
			}
		}.bind(this), DROP_DELAY);
	}.bind(this));
};

Display.prototype.changeBackdrop = function(index) {
	if (index != undefined) {
		this.index = index;
	}

	if (this.index >= IMAGES.length) {
		this.index = 0;
	}

	document.documentElement.className = IMAGES[this.index];
	this.index++;
};

Display.prototype.closeAllOverlays = function() {
	for (const element of $$(".overlay")) {
		element.classList.remove("open");
	}
};

Display.prototype.startGame = function(mode) {
	this.mode = mode;

	$("#play").textContent = "Pause";
	$("#reset").disabled = false;
	this.toggleControls(true);

	for (const element of $$(".toggle")) {
		element.disabled = true;
	}
};

Display.prototype.pauseGame = function(state) {
	$("#play").textContent = state ? "Resume" : "Pause";
	$("#overlay_pause").classList.toggle("open", state);
};

Display.prototype.stopGame = function() {
	this.toggleControls(false);
};

Display.prototype.resetGame = function() {
	this.clearAll();
	this.closeAllOverlays();

	$("#play").textContent = "Play";
	$("#play").disabled = false;
	$("#reset").disabled = true;

	for (const element of $$(".toggle")) {
		element.disabled = false;
	}

	$("#time").classList.remove("flash");
};

Display.prototype.gameOver = async function() {
	await this.fillWell();

	$("#play").disabled = true;
	$("#overlay_gameover").classList.add("open");
};

Display.prototype.fillWell = function() {
	return new Promise(function(resolve) {
		let x = COLS;
		let y = ROWS;

		const timer = window.setInterval(function() { // covers well in blocks
			if (y < 0) {
				window.clearInterval(timer);
				resolve();
				return;
			}

			if (x < 0) {
				x = COLS;
				y--;
			}

			this.drawCell(x, y, 0, 0);

			x--;
		}.bind(this), FLASH_DELAY);
	}.bind(this));
};

Display.prototype.updateTime = function(time) {
	$("#time").textContent = this.formatTime(time);

	if (this.mode == TIME_ATTACK && time < TIME_ATTACK_FLASH) {
		this.mode = STANDARD;
		$("#time").classList.add("flash");
	}
};

Display.prototype.updateStats = function(level, score, jewels) {
	$("#level").textContent = level;
	$("#score").textContent = score.toLocaleString();
	$("#jewels").textContent = jewels.toLocaleString();
};

Display.prototype.showPoints = function(points) {
	if (points > 0) {
		// replaces element each time so CSS animation plays
		const div = document.createElement("div");
		div.id = "points";
		div.textContent = "+" + points.toLocaleString();
		$("#points").replaceWith(div);
	}
};

Display.prototype.showScores = function(scores, mode, difficulty, isEnd=false) {
	difficulty -= STARTING_DIFFICULTY; // adjusts score from number of colors

	if (
		scores.tables[mode] == undefined
		|| scores.tables[mode][difficulty] == undefined
	) {
		return;
	}

	const table = document.createElement("table");
	const tr = document.createElement("tr");
	const name = document.createElement("th");
	const time = document.createElement("th");
	const level = document.createElement("th");
	const jewels = document.createElement("th");
	const score = document.createElement("th");

	name.className = "name";
	time.className = "time";
	level.className = "level";
	jewels.className = "jewels";
	score.className = "score";

	name.textContent = "Player";
	time.textContent = "Time";
	level.textContent = "Level";
	jewels.textContent = "Blocks";
	score.textContent = "Score";

	tr.appendChild(name);
	tr.appendChild(time);
	tr.appendChild(level);
	tr.appendChild(jewels);
	tr.appendChild(score);
	table.appendChild(tr);

	for (let i = 0; i < TABLE_SIZE; i++) {
		const tr = document.createElement("tr");
		const name = document.createElement("td");
		const time = document.createElement("td");
		const level = document.createElement("td");
		const jewels = document.createElement("td");
		const score = document.createElement("td");

		name.className = "name";
		time.className = "time";
		level.className = "level";
		jewels.className = "jewels";
		score.className = "score";

		const scoreTable = scores.tables[mode][difficulty];

		if (scoreTable[i] != undefined) {
			name.textContent = scoreTable[i].name;
			time.textContent = this.formatTime(scoreTable[i].time);
			level.textContent = scoreTable[i].level;
			jewels.textContent = scoreTable[i].jewels.toLocaleString();
			score.textContent = scoreTable[i].score.toLocaleString();

			if (scoreTable[i].date > 0) {
				const date = new Date(scoreTable[i].date * 1000);
				name.setAttribute("title", date.toLocaleString());
			}
		} else {
			name.textContent = "—";
			time.textContent = "—";
			level.textContent = 0;
			jewels.textContent = 0;
			score.textContent = 0;
		}

		tr.appendChild(name);
		tr.appendChild(time);
		tr.appendChild(level);
		tr.appendChild(jewels);
		tr.appendChild(score);
		table.appendChild(tr);
	}

	const id = isEnd ? "gameover" : "scores";
	$(`#overlay_${id} table`).replaceWith(table);
};

Display.prototype.toggleControls = function(state=false) {
	for (const element of $$("#controls button")) {
		element.disabled = !state;
	}
};

Display.prototype.togglePrompt = function(state=false) {
	$("#prompt").hidden = !state;
	$("#prompt input").disabled = !state;
	$("#prompt button").disabled = !state;
};

Display.prototype.formatTime = function(time) {
	if (time < 0) {
		return "0:00";
	}

	const hr  = Math.floor(time / 3600).toString();
	const rem = time % 3600;
	const min = Math.floor(rem / 60).toString();
	const sec = Math.floor(rem % 60).toString().padStart(2, "0");

	if (hr > 0) {
		const pad = min.padStart(2, "0");
		return `${hr}:${pad}:${sec}`;
	}

	return `${min}:${sec}`;
};

/*
 * Options prototype
 */

function Options() {
	this.values = {};
	this.defaults = {
		name:       "",
		start:      DEFAULT_START_LEVEL,
		difficulty: DEFAULT_DIFFICULTY,
		height:     DEFAULT_HEIGHT,
		mode:       STANDARD
	};
}

Options.prototype.load = function(options) {
	if (options != undefined) {
		this.values = options;
	} else {
		this.values = Object.assign({}, this.defaults); // copies default values
	}

	// sets form elements
	for (const [key, value] of Object.entries(this.values)) {
		const elements = document.getElementsByName(key);

		if (elements.length > 0) { // radio buttons
			for (const element of document.getElementsByName(key)) {
				element.checked = Number(element.value) == value;
			}
		} else { // checkboxes and range sliders
			const element = $("#" + key);

			if (element != undefined) {
				if (element.type == "checkbox") {
					element.checked = Boolean(value);
				} else {
					element.value = Number(value);
				}
			}
		}
	}

	$("#prompt input").value = this.values.name || "";
};

Options.prototype.save = function() {
	const options = {};

	for (const element of $$(".option")) { // reads state of form elements
		if (element.type == "checkbox") {
			options[element.id] = Number(element.checked);
		} else if (element.type == "radio") {
			if (element.checked) {
				options[element.name] = Number(element.value);
			}
		} else {
			options[element.id] = Number(element.value);
		}
	}

	options.name = $("#prompt input").value;

	for (const option of Object.keys(options)) {
		if (this.defaults[option] == options[option]) {
			// removes options that are same as default values
			delete options[option];
		}
	}

	return options;
};

Options.prototype.read = function(key) {
	let value = 0;

	if (this.values[key] != undefined) {
		value = Number(this.values[key]);

		if (Number.isNaN(value)) {
			value = Number(this.defaults[key]);
		}
	} else {
		value = Number(this.defaults[key]);
	}

	return value;
};

/*
 * Scores prototype
 */

function Scores() {
	this.tables = Array(GAME_MODES).fill().map(function() {
		return Array(DIFFICULTY_LEVELS).fill().map(function() {
			return [];
		});
	});
	this.modified = false;
}

Scores.prototype.load = function(tables) {
	if (tables != undefined && tables.length > 0) {
		this.tables = tables;
		this.modified = true;
	} else { // fills with default values
		for (let i = 0; i < GAME_MODES; i++) {
			for (let j = 0; j < DIFFICULTY_LEVELS; j++) {
				this.tables[i][j] = Array(TABLE_SIZE).fill().map(function() {
					return {
						name:   "AAA",
						date:   0,
						time:   600,
						level:  1,
						score:  100,
						jewels: 10
					};
				});
			}
		}
	}
};

Scores.prototype.save = function() {
	if (this.modified) { // only saves tables if they contain player data
		return this.tables;
	}
};

Scores.prototype.add = function(name, mode, diff, time, level, score, jewels) {
	diff -= STARTING_DIFFICULTY;

	if (
		this.tables[mode] == undefined
		|| this.tables[mode][diff] == undefined
	) {
		return;
	}

	if (mode == TIME_ATTACK) {
		time = TIME_ATTACK_LENGTH;
	}

	const date = Math.floor(Date.now() / 1000);

	this.tables[mode][diff].push({name, date, time, level, score, jewels});
	this.tables[mode][diff].sort(function(a, b) {
		return b.score - a.score;
	});
	this.tables[mode][diff] = this.tables[mode][diff].slice(0, TABLE_SIZE);
	this.modified = true;
};

Scores.prototype.check = function(mode, diff, time, score) {
	diff -= STARTING_DIFFICULTY;

	if (
		this.tables[mode] == undefined
		|| this.tables[mode][diff] == undefined
	) {
		return;
	}

	return this.tables[mode][diff].some(function(row) {
		return score > row.score;
	});
};

/*
 * Storage prototype
 */

function Storage(name) {
	this.name = name;
}

Storage.prototype.load = function() {
	try {
		const contents = localStorage.getItem(this.name);

		if (contents != null) {
			return JSON.parse(contents);
		}
	} catch (err) {
		console.error(err);
		this.reset();
		return null;
	}
};

Storage.prototype.save = function(list) {
	try {
		if (Object.keys(list).length != 0) {
			localStorage.setItem(this.name, JSON.stringify(list));
		} else {
			this.reset();
		}
	} catch (err) {
		console.error(err);
	}
};

Storage.prototype.reset = function() {
	try {
		localStorage.removeItem(this.name);
	} catch (err) {
		console.error(err);
	}
};