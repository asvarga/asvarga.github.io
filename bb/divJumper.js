

if (!document.ranDivJumper) {
	(function() {
		var DOC = DOC = document.documentElement;
		var BODY = BODY = document.body;
		var TICK_RESPONDERS = [];
		var KEY_RESPONDERS = [];
		var DOWN = {};
		var LAST_TIME = 0;
		var TEST = null;
		var CHAR = null;

		document.addEventListener("keydown", function(evt) {
			var c = String.fromCharCode(event.keyCode);
			if (!DOWN[c]) {
				DOWN[c] = true;
				for (var i=0; i<KEY_RESPONDERS.length; i++) {
					KEY_RESPONDERS[i].key(c);
				}
			}
		});
		document.addEventListener("keyup", function(evt) {
			var c = String.fromCharCode(event.keyCode);
			if (DOWN[c]) { delete DOWN[c]; }
		});


		var elem = document.createElement('img');
		elem.src = "https://thealexvarga.bitbucket.io/images/penguin.png";
		elem.addEventListener("load", ()=>{
			BODY.appendChild(elem);
			window.scrollTo(0, BODY.scrollHeight);
			CHAR = new Character(elem, 100, 0, 75);
			LAST_TIME = new Date().getTime();
			setInterval(tick, 20);
		});

		function tick() {
			var t = new Date().getTime();
			var dt = t-LAST_TIME;
			LAST_TIME = t;
			for (var i=0; i<TICK_RESPONDERS.length; i++) {
				TICK_RESPONDERS[i].tick(dt);
			}
		}

		class Thing {
			constructor(elem, x=0, y=0) {
				this.elem = elem;
				elem.style.position = "absolute";
				this.setx(x);
				this.sety(y);
			}
			setx(x) {
				this.x = x;
				this.elem.style.left = x-this.elem.width/2+"px";
			}
			sety(y) {
				this.y = y;
				this.elem.style.top = BODY.offsetHeight-y-this.elem.height+"px";
			}
			setleft(left) {
				this.elem.style.left = left+"px";
				this.x = left+this.elem.width/2;
			}
			settop(top) {
				this.elem.style.top = top+"px";
				this.y = BODY.offsetHeight-top-this.elem.height;
			}
			remove() {
				BODY.removeChild(this.elem);
			}
		}
		class Character extends Thing {
			constructor(elem, x=0, y=0, w=100) {
				
				elem.width = w;
				elem.height = w*(elem.offsetHeight/elem.offsetWidth);
				
				super(elem, x, y);
				TICK_RESPONDERS.push(this);
				KEY_RESPONDERS.push(this);
				this.dy = 0;
				this.on = this.under();

				// console.log(elem.offsetHeight);
				// elem.height = h;
				
				
			}
			tick(dt=0) {
				if (DOWN['D'] && !DOWN['A']) {
					this.elem.style.transform = "rotateY(180deg)";
					this.setx(Math.min(BODY.offsetWidth-this.elem.width/2, this.x+dt*0.5));
				}
				if (DOWN['A'] && !DOWN['D']) {
					this.elem.style.transform = "rotateY(0deg)";
					this.setx(Math.max(this.elem.width/2, this.x-dt*0.5));
				}

				if (DOWN['S'] || this.under() != this.on) {
					this.on = null;
				}

				if (this.on) {
					this.dy = 0;
				} else {
					this.dy = this.dy-dt*0.003;
					if (DOWN['S'] || this.dy >= 0) {
						this.sety(Math.max(0, this.y+this.dy*dt));
					} else {
						var e1 = this.under();
						this.sety(Math.max(0, this.y+this.dy*dt));
						var e2 = this.under();
						if (e2 && !(e1 && e2.contains(e1))) {
							this.sitOn(e2);
						}
					}
				}
			}
			sitOn(elem) {
				this.on = elem;
				this.dy = 0;
				this.settop(elem.getBoundingClientRect().top-BODY.getBoundingClientRect().top-this.elem.height);
			}
			jump(elem) {
				this.dy = 1;
				this.on = null;
			}
			key(c) {
				switch(c) {
					case 'W':
						this.jump();
						break;
				}
			}
			under() {
				var rect = this.elem.getBoundingClientRect();
				return getDiv(document.elementFromPoint((rect.left+rect.right)/2, rect.bottom+1));
			}
			remove() {
				TICK_RESPONDERS.splice(TICK_RESPONDERS.indexOf(this), 1);
				KEY_RESPONDERS.splice(KEY_RESPONDERS.indexOf(this), 1);
				super.remove();
			}
		}

		var SEATS = {
			"DIV":1, "IMG":1, "BUTTON": 1 //, "H1":1, "H2":1, "H3":1
		}

		function canSit(x) {
			return x.tagName.toUpperCase() in SEATS && x.offsetWidth <= 800;//BODY.scrollWidth;
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



