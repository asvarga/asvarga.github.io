
window.onload = function() {

	field = document.getElementById("top");
	field.onmousedown = function(e) {
		log(123);
	}
	dragging = null;
	lOff = 0;
	rOff = 0;
	tOff = 0;
	bOff = 0;
	
	n = {
		0:{ins:{}, outs:{}, children:{1:true}},
		1:{ins:{}, outs:{}, children:{}, parent:0}
	};

	for (var i=2; i<=15; i++) {
		n[i] = {ins:{}, outs:{}, children:{}, parent:0};
		n[i].ins[Math.floor(i/2)] = true;
		n[Math.floor(i/2)].outs[i] = true;
		n[0].children[i] = true;
		n[i].parent = 0;
	}
	
	function newNode(id, obj) {
		var node = document.createElement("div");
		node.innerHTML = id;
		node.className = "node";
		node.nid = id;
		node.onmousedown = function(e) {
			dragging = node;
			var min = Math.min(window.innerWidth, window.innerHeight);
			lOff = n[id].left - e.clientX / min;
			rOff = n[id].right - e.clientX / min;
			tOff = n[id].top - e.clientY / min;
			bOff = n[id].bottom - e.clientY / min;
			if (e.stopPropagation) {
		        // W3C standard variant
		        e.stopPropagation();
		    } else {
		        // IE variant
		        e.cancelBubble = true;
		    }
		}
		return node;
	}

	nodes = {};

	for (var key in n) {
		if (n[key].parent == null) {
			n[key].left = 0.5;
			n[key].right = 0.5;
			n[key].top = 0.01;
			n[key].bottom = 0.01;
		} else {
			var x = 0;
			var y = 0;
			var c = 0;
			for (var key2 in n[key].ins) {
				x += (n[key2].left || 0) + (n[key2].right || 0);
				y += (n[key2].top || 0) + (n[key2].bottom || 0);
				c++;
			}
			n[key].left = c ? x/c/2 : (n[n[key].parent].left + n[n[key].parent].right)/2;
			n[key].right = n[key].left;
			n[key].top = (c ? y/c/2 : (n[n[key].parent].top + n[n[key].parent].bottom)/2)+0.1;
			n[key].bottom = n[key].top;
		}
		var node = newNode(key, n[key]);
		node.style.left = (n[key].left*95).toString()+'vmin';
		node.style.width = ((n[key].right-n[key].left)*95+5).toString()+'vmin';
		node.style.top = (n[key].top*95).toString()+'vmin';
		node.style.height = ((n[key].bottom-n[key].top)*95+5).toString()+'vmin';

		nodes[key] = node;

		field.appendChild(node);
	}
};

var running = false;

document.onkeydown = function(evt) {
    evt = evt || window.event;
    if (evt.keyCode == 32) {	// space
		running = !running;
		if (running) { 
			step(); 
		} else {
			for (var key in n) {
				n[key].dl = 0;
				n[key].dr = 0;
				n[key].dt = 0;
				n[key].db = 0;
			}
		}
    }
}

document.onmouseup = function(e) {
	dragging = null;
}

document.onmousemove = function(e) {
	if (dragging && dragging != "pan") {
		var min = Math.min(window.innerWidth, window.innerHeight)
		n[dragging.nid].left = e.clientX/min + lOff;
		n[dragging.nid].right = e.clientX/min + rOff;
		n[dragging.nid].top = e.clientY/min + tOff;
		n[dragging.nid].bottom = e.clientY/min + bOff;
		nodes[dragging.nid].style.left = (n[dragging.nid].left*95).toString()+'vmin';
		nodes[dragging.nid].style.width = ((n[dragging.nid].right-n[dragging.nid].left)*95+5).toString()+'vmin';
		nodes[dragging.nid].style.top = (n[dragging.nid].top*95).toString()+'vmin';
		nodes[dragging.nid].style.height = ((n[dragging.nid].bottom-n[dragging.nid].top)*95+5).toString()+'vmin';
	}
}

function step() {
	for (var key in n) {
		for (var key2 in n) {				// springs to all nodes
			if (key != key2 && !n[key].children[key2] && !n[key2].children[key]) {
				var dl = n[key].left - n[key2].right;
				var dr = n[key].right - n[key2].left;
				var dt = n[key].top - n[key2].bottom;
				var db = n[key].bottom - n[key2].top;
				var w = n[key].right - n[key].left + n[key2].right - n[key2].left;
				var h = n[key].bottom - n[key].top + n[key2].bottom - n[key2].top;

				var dx = (dl+dr)/2;6
				var dy = (dt+db)/2;
				var d2 = dx*dx + dy*dy;
				var d = Math.sqrt(d2);
				var f = (d-0.3-Math.sqrt(w*w + h*h))*0.001;
				if (!dragging || key != dragging.nid) {
					n[key].dl -= dx/d*f;
					n[key].dr -= dx/d*f;
					n[key].dt -= dy/d*f;
					n[key].db -= dy/d*f;
				}
			}
		}

		for (var key2 in n[key].ins) {		// extra springs to ins
			var dl = n[key].left - n[key2].right;
			var dr = n[key].right - n[key2].left;
			var dt = n[key].top - n[key2].bottom;
			var db = n[key].bottom - n[key2].top;
			var w = n[key].right - n[key].right + n[key2].right - n[key2].right;
			var h = n[key].bottom - n[key].top + n[key2].bottom - n[key2].top;

			var dx = (dl+dr)/2;
			var dy = (dt+db)/2;
			var d2 = dx*dx + dy*dy;
			var d = Math.sqrt(d2);
			var f = (d-0.15-Math.sqrt(w*w + h*h))*0.03;
			var fy = (dt-0.15-h)*0.03;
			if (!dragging || key != dragging.nid) {
				n[key].dl -= dl/d*f;
				n[key].dr -= dr/d*f;
				n[key].dt -= dt/d*f+fy;
				n[key].db -= db/d*f+fy;
			}
			if (!dragging || key2 != dragging.nid) {
				n[key2].dl += dl/d*f;
				n[key2].dr += dr/d*f;
				n[key2].dt += dt/d*f+fy;
				n[key2].db += db/d*f+fy;
			}
		}

		// contain children
		if (n[key].children != null && any(n[key].children)) {
			var left = Infinity;
			var right = -Infinity;
			var top = Infinity;
			var bottom = -Infinity;
			for (var key2 in n[key].children) {
				left = Math.min(left, n[key2].left);
				right = Math.max(right, n[key2].right);
				top = Math.min(top, n[key2].top);
				bottom = Math.max(bottom, n[key2].bottom);
			}

			var dl = n[key].left - left;
			var dr = n[key].right - right;
			var dt = n[key].top - top;
			var db = n[key].bottom - bottom;

			if (!dragging || key != dragging.nid) {
				n[key].dl -= (dl+0.05)*0.05;
				n[key].dr -= (dr-0.05)*0.05;
				n[key].dt -= (dt+0.05)*0.05;
				n[key].db -= (db-0.05)*0.05;
			}
		}
	}

	for (var key in n) {
		if (!dragging || key != dragging.nid) {
			n[key].dl *= 0.9;
			n[key].dr *= 0.9;
			n[key].dt *= 0.9;
			n[key].db *= 0.9;
			n[key].left += n[key].dl;
			n[key].right += n[key].dr;
			n[key].top += n[key].dt;
			n[key].bottom += n[key].db;
			nodes[key].style.left = (n[key].left*95).toString()+'vmin';
			nodes[key].style.width = ((n[key].right-n[key].left)*95+5).toString()+'vmin';
			nodes[key].style.top = (n[key].top*95).toString()+'vmin';
			nodes[key].style.height = ((n[key].bottom-n[key].top)*95+5).toString()+'vmin';
		}
	}

	if (running) {
		setTimeout(step, 40);
	}
}









