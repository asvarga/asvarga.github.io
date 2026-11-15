

if (!document.ranDivJumper) {
	(function () {
		var DOC = DOC = document.documentElement;
		var BODY = BODY = document.body;
		var TICK_RESPONDERS = [];
		var KEY_RESPONDERS = [];
		var DOWN = {};
		var LAST_TIME = 0;
		var TEST = null;
		var CHAR = null;

		// Arrows move, as in every game here: up jumps, down drops through.
		// Inside, they keep the letters the game was written with.
		var ARROWS = { ArrowUp: 'W', ArrowLeft: 'A', ArrowDown: 'S', ArrowRight: 'D' };
		// The frog's sprites sit beside this script, wherever it's served from.
		var HERE = (document.currentScript && document.currentScript.src) || location.href;

		document.addEventListener("keydown", function (evt) {
			var c = ARROWS[evt.key];
			if (!c) return;
			evt.preventDefault();
			if (!DOWN[c]) {
				DOWN[c] = true;
				for (var i = 0; i < KEY_RESPONDERS.length; i++) {
					KEY_RESPONDERS[i].key(c);
				}
			}
			evt.stopPropagation();
		});
		document.addEventListener("keyup", function (evt) {
			var c = ARROWS[evt.key];
			if (DOWN[c]) { delete DOWN[c]; }
		});


		// Two poses, both facing left in the same 120x84 box: sitting, and mid-leap.
		var SIT = new URL("../images/frog.svg", HERE).href;
		var LEAP = new URL("../images/frog-leap.svg", HERE).href;
		new Image().src = LEAP; // preload, so the first hop doesn't flicker

		var elem = document.createElement('img');
		elem.src = SIT;
		elem.alt = "";
		// A page's own img styles mustn't move or squeeze the frog.
		elem.style.margin = "0";
		elem.style.maxWidth = "none";
		elem.style.pointerEvents = "none";
		elem.style.transformOrigin = "50% 100%"; // squash and tilt from the feet
		elem.style.zIndex = "2147483647";
		elem.addEventListener("load", function start() {
			elem.removeEventListener("load", start); // swapping poses fires load again
			BODY.appendChild(elem);
			window.scrollTo(0, BODY.scrollHeight);
			// Start on the bottom of the page, at the right, facing into the page.
			CHAR = new Character(elem, DOC.clientWidth - 100, 0, 84);
			LAST_TIME = new Date().getTime();
			setInterval(tick, 20);
		});

		function tick() {
			var t = new Date().getTime();
			var dt = t - LAST_TIME;
			LAST_TIME = t;
			for (var i = 0; i < TICK_RESPONDERS.length; i++) {
				TICK_RESPONDERS[i].tick(dt);
			}
		}

		class Thing {
			constructor(elem, x = 0, y = 0) {
				this.elem = elem;
				elem.style.position = "absolute";
				this.setx(x);
				this.sety(y);
			}
			setx(x) {
				this.x = x;
				this.elem.style.left = x - this.elem.width / 2 + "px";
			}
			sety(y) {
				this.y = y;
				this.elem.style.top = BODY.offsetHeight - y - this.elem.height + "px";
			}
			setleft(left) {
				this.elem.style.left = left + "px";
				this.x = left + this.elem.width / 2;
			}
			settop(top) {
				this.elem.style.top = top + "px";
				this.y = BODY.offsetHeight - top - this.elem.height;
			}
			remove() {
				BODY.removeChild(this.elem);
			}
		}
		class Character extends Thing {
			constructor(elem, x = 0, y = 0, w = 100) {

				elem.width = w;
				elem.height = w * (elem.offsetHeight / elem.offsetWidth);

				super(elem, x, y);
				TICK_RESPONDERS.push(this);
				KEY_RESPONDERS.push(this);
				this.dy = 0;
				this.on = this.under();
				this.facing = 1; // 1: left, as drawn; -1: mirrored to face right
				this.jumpedAt = -Infinity;
				this.landedAt = -Infinity;
				this.pose();
			}
			tick(dt = 0) {
				var wasUp = this.y > 0;
				if (DOWN['D'] && !DOWN['A']) {
					this.facing = -1;
					this.setx(Math.min(DOC.clientWidth - this.elem.width / 2, this.x + dt * 0.5));
				}
				if (DOWN['A'] && !DOWN['D']) {
					this.facing = 1;
					this.setx(Math.max(this.elem.width / 2, this.x - dt * 0.5));
				}

				if (DOWN['S'] || this.under() != this.on) {
					this.on = null;
				}

				if (this.on) {
					this.dy = 0;
				} else {
					this.dy = this.dy - dt * 0.003;
					if (DOWN['S'] || this.dy >= 0) {
						this.sety(Math.max(0, this.y + this.dy * dt));
					} else {
						var e1 = this.under();
						this.sety(Math.max(0, this.y + this.dy * dt));
						var e2 = this.under();
						if (e2 && !(e1 && e2.contains(e1))) {
							this.sitOn(e2);
						}
					}
					if (wasUp && this.y <= 0) this.landedAt = Date.now(); // hit the page bottom
				}
				this.pose();
				this.follow();
			}
			// Sitting or leaping sprite, a stretch on takeoff and a squash on landing,
			// and a nose-down tilt on the way down.
			pose() {
				var now = Date.now();
				var grounded = this.on || this.y <= 0;
				var src = grounded ? SIT : LEAP;
				if (this.elem.src !== src) this.elem.src = src;
				var sx = 1, sy = 1, tilt = 0, k;
				if (now - this.landedAt < 140) {
					k = 1 - (now - this.landedAt) / 140;
					sx = 1 + 0.12 * k; sy = 1 - 0.16 * k;
				} else if (now - this.jumpedAt < 160) {
					k = 1 - (now - this.jumpedAt) / 160;
					sx = 1 - 0.08 * k; sy = 1 + 0.12 * k;
				}
				if (!grounded && this.dy < 0) tilt = Math.max(-18, this.dy * 18);
				this.elem.style.transform =
					"scaleX(" + this.facing * sx + ") scaleY(" + sy + ") rotate(" + tilt + "deg)";
			}
			// Scroll the page to keep the frog in view (the arrow keys can't).
			follow() {
				var r = this.elem.getBoundingClientRect();
				var margin = Math.min(160, window.innerHeight / 4);
				if (r.top < margin) {
					window.scrollBy(0, r.top - margin);
				} else if (r.bottom > window.innerHeight - margin) {
					window.scrollBy(0, r.bottom - (window.innerHeight - margin));
				}
			}
			sitOn(elem) {
				if (!this.on) this.landedAt = Date.now();
				this.on = elem;
				this.dy = 0;
				this.settop(elem.getBoundingClientRect().top - BODY.getBoundingClientRect().top - this.elem.height);
			}
			jump(elem) {
				this.dy = 1;
				this.on = null;
				this.jumpedAt = Date.now();
			}
			key(c) {
				switch (c) {
					case 'W':
						this.jump();
						break;
				}
			}
			under() {
				// Measure the untransformed box, so squash and tilt never move the feet.
				var x = this.elem.offsetLeft + this.elem.offsetWidth / 2 - window.scrollX;
				var bottom = this.elem.offsetTop + this.elem.offsetHeight - window.scrollY;
				return getDiv(document.elementFromPoint(x, bottom + 1));
			}
			remove() {
				TICK_RESPONDERS.splice(TICK_RESPONDERS.indexOf(this), 1);
				KEY_RESPONDERS.splice(KEY_RESPONDERS.indexOf(this), 1);
				super.remove();
			}
		}

		var SEATS = {
			"DIV": 1, "IMG": 1, "BUTTON": 1 //, "H1":1, "H2":1, "H3":1
		}

		function canSit(x) {
			var tag = x.tagName.toUpperCase();
			// A footer is a floor at any width; anything else wider than 800px is
			// probably a layout wrapper rather than something to stand on.
			if (tag === "FOOTER") return true;
			// Pages can mark anything as a platform with a data-platform attribute.
			if (x.hasAttribute && x.hasAttribute("data-platform")) return true;
			return tag in SEATS && x.offsetWidth <= 800;//BODY.scrollWidth;
		}

		function getDiv(x) {
			while (x && !canSit(x)) {
				x = x.parentElement;
			}
			return x;
		}

		document.ranDivJumper = true;
	})();
}
var divJumperScript = document.getElementById('divJumper');
if (divJumperScript) {
	document.body.removeChild(divJumperScript);
}



