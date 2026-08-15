
function init() {
	stage = new createjs.Stage("myCanvas");
	createjs.Ticker.setFPS(60);
	createjs.Ticker.addEventListener("tick", stage);
	width = stage.canvas.width;
	height = stage.canvas.height;

	dur = 400.0;
	size = 50.0;
	running = false;
	all = new All(3, 1);

	document.onkeydown = function (evt) {
		evt = evt || window.event;
		// console.log(evt.keyCode);
		// console.log(evt.metaKey);
		if (evt.keyCode == 32) {	// space
			step();
		} else if (evt.keyCode == 80) {	// p
			evt.stopPropagation();
			running = !running;
			step();
		} else if (evt.keyCode == 82 && !evt.metaKey) {	// r
			all.del();
			running = false;
			m = 0;
			while (!(m > 0)) {
				m = parseInt(prompt("1st Positive Integer:", "3"));
			}
			n = NaN;
			while (!(n > 0)) {
				n = parseInt(prompt("2nd Positive Integer:", "1"));
			}
			all = new All(m, n);
		} else if (evt.keyCode == 37) {	// <-
			if (dur * 2.0 < 2000) {
				dur = dur * 2.0;
			}
		} else if (evt.keyCode == 39) {	// ->
			if (dur / 2.0 > 10) {
				dur = dur / 2.0;
			}
		}
	}
}

function step() {
	if (!createjs.Tween.hasActiveTweens()) {
		all.stepTweened();
	}
}

function stepAgain() {
	if (running && createjs.Tween._tweens.length == 1) {
		all.stepTweened();
	}
}

function ack(L) {
	if (L.length < 2) {
		return L;
	}
	m = L[L.length - 2];
	n = L[L.length - 1];
	if (m == 0) {
		return [n + 1];
	} else if (n == 0) {
		return [m - 1, 1];
	} else {
		return [m - 1, m, n - 1];
	}
}

var Block = function (x, y, alpha = 1.0, sky = null) {
	this.sky = sky != null ? sky : !!y;
	this.shape = new createjs.Shape();
	this.shape.alpha = alpha;
	this.shape.graphics.beginFill(this.sky ? "DeepSkyBlue" : "LightGreen").beginStroke("Black");
	// this.shape.graphics.drawCircle(0, 0, size/2);
	// this.shape.graphics.drawRect(0, 0, size, size);
	// s = size; s2 = s/2; s4 = s/4; s6 = s/6; s8 = s/8;
	// this.shape.graphics.mt(0,0).lt(s4,0).lt(s4,s8).lt(3*s4,s8).lt(3*s4,0).lt(s,0).lt(s,s);
	// this.shape.graphics.lt(3*s/4,s).lt(3*s4,9*s8).lt(s4,9*s8).lt(s4,s).lt(0,s).lt(0,0);
	s = size; s2 = s / 2; s5 = s / 5; s1 = s / 10; s11 = 11 * s1; s0 = -s / 60;	// weird overlap
	this.shape.graphics.mt(0, s0).lt(s, s0).lt(s, s);
	// this.shape.graphics.lt(s5,0).lt(s5,s1).lt(2*s5,s1).lt(2*s5,0).lt(3*s5,0).lt(3*s5,s1).lt(4*s5,s1).lt(4*s5,0).lt(s,0).lt(s,s);
	this.shape.graphics.lt(4 * s5, s).lt(4 * s5, s11).lt(3 * s5, s11).lt(3 * s5, s).lt(2 * s5, s).lt(2 * s5, s11).lt(s5, s11).lt(s5, s).lt(0, s);
	this.shape.graphics.lt(0, s0);
	this.setPos(x, y);
	// stage.addChild(this.shape);
}
Block.prototype.setPos = function (x, y) {
	this.x = x != null ? x : this.x;
	this.y = y != null ? y : this.y;
	this.shape.x = this.x * size;
	this.shape.y = this.y * size;
};
Block.prototype.move = function (x, y, dt = 1000) {
	this.x = x != null ? x : this.x;
	this.y = y != null ? y : this.y;
	createjs.Tween.get(this.shape).to({ x: this.x * size, y: this.y * size }, dt).call(stepAgain);
};
Block.prototype.copy = function (x = null, y = null) {
	newx = x != null ? x : this.x;
	newy = y != null ? y : this.y;
	return new Block(newx, newy, true, this.sky);
}
Block.prototype.copyTo = function (x, y, dt = 1000) {
	block = new Block(this.x, this.y, true, this.sky);
	block.move(x, y);
	return block;
}
Block.prototype.fadeIn = function (dt = 1000) {
	this.shape.alpha = 0.0;
	createjs.Tween.get(this.shape).to({ alpha: 1.0 }, dt).call(stepAgain);
}
Block.prototype.fadeOut = function (dt = 1000) {
	this.shape.alpha = 1.0;
	createjs.Tween.get(this.shape).to({ alpha: 0.0 }, dt).call(this.del).call(stepAgain);
}
Block.prototype.del = function () {
	if (this.shape && this.shape.parent) {
		this.shape.parent.removeChild(this.shape);
	}
}

var All = function (m, n) {
	this.container = new createjs.Container();
	stage.addChild(this.container);
	this.L = [];
	this.blocks = [];
	this.addColumn(m);
	this.addColumn(n);
	this.fixScale(false);
}
All.prototype.addColumn = function (h) {
	x = this.L.length;
	this.L.push(h);
	col = [];
	for (var i = 0; i <= h; i++) {
		block = new Block(x, i);
		this.container.addChild(block.shape);
		col.push(block);
	}
	this.blocks.push(col);
}
All.prototype.delColumn = function () {
	this.L.pop();
	col = this.blocks.pop();
	for (i = 0; i < col.length; i++) {
		col[i].del();
	}
}
All.prototype.step = function () {
	if (this.L.length < 2) {
		return;
	}
	a = ack(this.L);
	this.delColumn();
	this.delColumn();
	for (var i = 0; i < a.length; i++) {
		this.addColumn(a[i]);
	}
}
All.prototype.stepTweened = function () {
	if (this.L.length < 2) {
		running = false;
		return;
	}
	mi = this.L.length - 2;
	m = this.L[mi];
	ni = this.L.length - 1;
	n = this.L[ni];
	if (m == 0) {
		// [n+1];
		this.L[mi] = n + 1;
		this.L.pop();
		block = new Block(mi, 1, 0);
		this.container.addChild(block.shape);
		block.fadeIn(dur);
		this.blocks[mi].push(block);
		for (var i = 1; i < this.blocks[ni].length; i++) {
			block2 = this.blocks[ni][i];
			block2.move(mi, i + 1, dur);
			this.blocks[mi].push(block2);
			this.container.removeChild(block2.shape);
			this.container.addChild(block2.shape);
		}
		this.blocks[ni][0].fadeOut(dur);
		this.blocks.pop();
	} else if (n == 0) {
		// [m-1, 1];
		this.L[mi] = m - 1;
		this.L[ni] = 1;
		block = this.blocks[mi].pop();
		block.move(ni, 1, dur);
		this.blocks[ni].push(block);
	} else {
		// [m-1, m, n-1];
		this.L[mi] = m - 1;
		this.L[ni] = m;
		this.L.push(n - 1);
		oi = ni + 1;
		this.blocks.push([]);
		for (var i = 0; i < this.blocks[ni].length; i++) {
			block = this.blocks[ni][i];
			block.move(oi, i, dur);
			this.blocks[oi].push(block);
		}
		this.blocks[ni] = [];
		this.blocks[oi].pop().fadeOut(dur);
		for (var i = 0; i < this.blocks[mi].length; i++) {
			block = this.blocks[mi][i].copy();
			this.container.addChild(block.shape);
			block.move(ni, i, dur);
			this.blocks[ni].push(block);
		}
		this.blocks[mi].pop().fadeOut(dur);
	}
	this.fixScale();
}
All.prototype.fixScale = function (animate = true) {
	iwidth = size * this.blocks.length;
	iheight = size * Math.max.apply(null, this.blocks.map((Li => Li.length)));
	targetWidth = width - 2 * size;
	targetHeight = height - 2 * size;
	iscale = Math.min(targetWidth / iwidth, targetHeight / iheight, 1);
	if (animate) {
		createjs.Tween.get(this.container).to({ scaleX: iscale, scaleY: -iscale }, dur).call(stepAgain);
	} else {
		this.container.scaleX = iscale;
		this.container.scaleY = -iscale;
	}
	this.container.y = height - size;
	this.container.x = size;
}
All.prototype.del = function () {
	for (var i = 0; i < this.blocks.length; i++) {
		for (var j = 0; j < this.blocks[i].length; j++) {
			this.blocks[i][j].del();
		}
	}
	if (this.container && this.container.parent) {
		this.container.parent.removeChild(this.container);
	}
}












// var Column = function(h, x, bx=null) {
// 	this.h = h;
// 	this.blocks = [];
// 	for (var i=0; i<=h; i++) {
// 		block = new Block(bx, i);
// 		this.blocks.push();
// 	}
// }
// Column.prototype.moveX = function(x, dt=1000) {
// 	for (var i=0; i<this.blocks.length; i++) {
// 		this.blocks[i].move(x, null, dt);
// 	}
// };
// Column.prototype.copyTo = function(x, y, dt=1000) {
// 	col = new Column(this.x, this.y, this.sky);
// 	block.move(x, y);
// 	return block;
// }
// Column.prototype.remove = function() {
// 	for (var i=0; i<this.blocks.length; i++) {
// 		this.blocks[i].remove();
// 	}
// 	this.blocks = [];
// }













