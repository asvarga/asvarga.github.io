
function load() {
	canvas = document.getElementById("myCanvas");
	stage = new createjs.Stage("myCanvas");
	stage.enableMouseOver();
	createjs.Ticker.setFPS(60);
	createjs.Ticker.addEventListener("tick", tick);
	resize();

	modes = [id, cubic, quint];
	ind = -1;
	function changeMode() {
		ind = (ind+1)%modes.length;
		console.log(modes[ind]);
	}
	changeMode();

	stage.on("stagemousedown", function(evt) {
		createjs.Ticker.paused = !createjs.Ticker.paused;

		// for (var i=0; i<circles.length; i++) {
		// 	var circle = circles[i];
		//     circle.x = dual(circle.x, evt.stageX, circle.d);
		//     circle.y = dual(circle.y, evt.stageY, circle.d);
		// }
	});

	// circles = [];
	// // for (var i=1000; i<=2000; i+=100) {
	// // 	addCircle(i);
	// // }
	// addCircle(1000);

	MOUSE = new Point(500, 500);
	stage.on("stagemousemove", function(evt) {
		MOUSE.x = evt.stageX;
		MOUSE.y = evt.stageY;
	});

	this.document.onkeydown = function(evt) {
		console.log(event.keyCode);
		switch(event.keyCode) {
			// case 80: 	// p	
			// 	createjs.Ticker.paused = !createjs.Ticker.paused;
			// 	break;
			case 77: 	// m	
				changeMode();
				break;
		}
	};

	circle = new createjs.Shape();
	circle.graphics.beginFill("DeepSkyBlue").drawCircle(0, 0, 20);
	// var prog = IF(APP(quint, TIME), 800, 200);
	// prog = APP(add, 4, 5);
	// prog = APP(mul, prog, prog);
	circle.x = 500;//IF(APP(quint, FRAME()), 800, 200);
	// circle.y = IF(FRAME(), 800, 200);
	circle.y = 500;//IF(APP(cubic, FRAME()), 800, 200);
	// circle.x = 500;
	// circle.y = 500;

	stage.addChild(circle);
	

	tick();
}

// function addCircle(d) {
// 	circle = new createjs.Shape();
// 	circle.graphics.beginFill("DeepSkyBlue").drawCircle(0, 0, 20);
// 	circle.x = 500;
// 	circle.y = 500;
// 	circle.d = d;

// 	stage.addChild(circle);
// 	circles.push(circle);
// } 

function resize() {
	var w = window.innerWidth;
	var h = window.innerHeight;
	var s = Math.min(w, h)-15;
	canvas.style.position = "absolute";
	canvas.style.left = (w-s)/2+"px";
	canvas.style.top = (h-s)/2+"px";
	canvas.style.width = s+"px";
	canvas.style.height = s+"px";
}

function tick(evt={}) {
	if (!evt.paused) {
		circle.x = IF(APP(modes[ind], FRAME()), MOUSE.x, circle.x);
		circle.y = IF(APP(modes[ind], FRAME()), MOUSE.y, circle.y);
	// 	for (var i=0; i<circles.length; i++) {
	// 		var circle = circles[i];
	// 	    circle.x = dual(circle.x, MOUSE.x, frame(circle.d));
	// 	    circle.y = dual(circle.y, MOUSE.y, frame(circle.d));
	// 	}
		stage.update();
	// 	// console.log(depth(circle.x));
	}
}







