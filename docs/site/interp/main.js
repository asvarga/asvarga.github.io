
function load() {
	canvas = document.getElementById("myCanvas");
	stage = new createjs.Stage("myCanvas");
	createjs.Ticker.setFPS(60);
	createjs.Ticker.addEventListener("tick", tick);
	resize();

	var text = new createjs.Text("Click the canvas to start an interpolation towards that point.\nThere can be multiple interpolations at once.", "30px Arial", "#ff7700");
	text.x = 500;
	text.y = 50;
	text.textAlign = "center";
	stage.addChild(text);
	
	circle = new createjs.Shape();
	circle.graphics.beginFill("DeepSkyBlue").drawCircle(0, 0, 50);
	stage.addChild(circle);

	L = new Point(200, 200);
	stage.on("stagemousedown", function(evt) {
	    L = lerp(prune(L), new Point(evt.stageX, evt.stageY), 2000);
	});


	tick();
}

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

function tick() {
	circle.x = at(L.x);
	circle.y = at(L.y);
	stage.update();
}







