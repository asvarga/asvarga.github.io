
window.onload = function() {

	field = document.getElementById("top");
	// field.onmousedown = function(e) {
	// 	log(123);
	// }
	dragging = null;
	lOff = 0;
	rOff = 0;
	tOff = 0;
	bOff = 0;

	linesSVG = document.getElementById("lines");
	lines = [];
	
	n = {
		0:{inSet:{}, inArr:[], children:{1:true}},
		1:{inSet:{}, inArr:[], children:{}}
	};

	for (var i=2; i<=15; i++) {
		n[i] = {inSet:{}, inArr:[], children:{}};
		n[Math.floor(i/2)].inSet[i] = true;
		n[Math.floor(i/2)].inArr.push(i);
		n[0].children[i] = true;
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
			n[id].dl = 0;
			n[id].dr = 0;
			n[id].dt = 0;
			n[id].db = 0;
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
		n[key].left = Math.random();
		n[key].right = n[key].left;
		n[key].top = Math.random();
		n[key].bottom = n[key].top;
		n[key].dl = 0;
		n[key].dr = 0;
		n[key].dt = 0;
		n[key].db = 0;

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

				var dx = (dl+dr)/2;
				var dy = (dt+db)/2;
				var d2 = dx*dx + dy*dy;
				var d = Math.sqrt(d2);
				var f = (d-0.3-Math.sqrt(w*w + h*h))*0.003;//0.001;
				if (!dragging || key != dragging.nid) {
					n[key].dl -= dx/d*f;
					n[key].dr -= dx/d*f;
					n[key].dt -= dy/d*f;
					n[key].db -= dy/d*f;
				}
			}
		}

		// extra springs to inSet
		for (var key2 in n[key].inSet) {		
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
			var f = (d-0.15-Math.sqrt(w*w + h*h))*0.02;//0.03;
			var fy = (dt+0.15-h)*0.02;//0.03;
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
			var leftNode = null;
			var right = -Infinity;
			var rightNode = null;
			var top = Infinity;
			var topNode = null;
			var bottom = -Infinity;
			var bottomNode = null;
			for (var key2 in n[key].children) {
				if (left > n[key2].left) {
					left = n[key2].left;
					leftNode = n[key2];
				}
				if (right < n[key2].right) {
					right = n[key2].right;
					rightNode = n[key2];
				}
				if (top > n[key2].top) {
					top = n[key2].top;
					topNode = n[key2];
				}
				if (bottom < n[key2].bottom) {
					bottom = n[key2].bottom;
					bottomNode = n[key2];
				}
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

			if (!dragging || leftNode != dragging) {
				leftNode.dl += (dl+0.05)*0.05;
				leftNode.dr += (dl+0.05)*0.05;
			}
			if (!dragging || rightNode != dragging) {
				rightNode.dl += (dr-0.05)*0.05;
				rightNode.dr += (dr-0.05)*0.05;
			}
			if (!dragging || topNode != dragging) {
				topNode.dt += (dt+0.05)*0.05;
				topNode.db += (dt+0.05)*0.05;
			}
			if (!dragging || bottomNode != dragging) {
				bottomNode.dt += (db-0.05)*0.05;
				bottomNode.db += (db-0.05)*0.05;
			}
		}

		// order children
		for (var i=0; i<n[key].inArr.length-1; i++) {
			var d = n[n[key].inArr[i]].right - n[n[key].inArr[i+1]].left + 0.1;
			//if (d > 0) {
				if (!dragging || n[n[key].inArr[i]] != dragging) {
					n[n[key].inArr[i]].dl -= 0.3*d;
					n[n[key].inArr[i]].dr -= 0.3*d;
				}
				if (!dragging || n[n[key].inArr[i+1]] != dragging) {
					n[n[key].inArr[i+1]].dl += 0.3*d;
					n[n[key].inArr[i+1]].dr += 0.3*d;
				}
			//}
		}

		// compact self
		// n[key].dl += 0.01*(n[key].right - n[key].left);
		// n[key].dr -= 0.01*(n[key].right - n[key].left);

		// n[key].dt += 0.01*(n[key].bottom - n[key].top);
		// n[key].db -= 0.01*(n[key].bottom - n[key].top);


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









