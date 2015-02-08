
Graph = function(container) {
	this.container = container;
	// this.edgeSVG = document.createElement("svg");
	// this.edgeSVG.className = "fill";
	// this.container.appendChild(this.edgeSVG);
	this.nodeDIV = document.createElement("div");
	this.nodeDIV.className = "fill";
	this.container.appendChild(this.nodeDIV);
	this.buttons = document.createElement("div");
	this.container.appendChild(this.buttons);

	this.toggleButton = document.createElement("div");
	this.toggleButton.className = "button";
	this.toggleButton.innerHTML = "P";
	var this2 = this;
	this.toggleButton.onclick = function(evt) {
		this2.toggle();
	}
	this.buttons.appendChild(this.toggleButton);

	// this.aboutButton = document.createElement("div");
	// this.aboutButton.className = "button";
	// this.aboutButton.innerHTML = "?";
	// var this2 = this;
	// this.aboutButton.onclick = function(evt) {
	// 	alert("ABOUT: This strange layout experiment is far from complete, but I figured it was cool enough as is for use here.\n\nFor more info, click the 'Silk' node!");
	// }
	// this.buttons.appendChild(this.aboutButton);

	this.running = false;
	this.dragging = null;
	this.lOff = 0;
	this.rOff = 0;
	this.tOff = 0;
	this.bOff = 0;

	this.n = {};
	this.nodes = {};
	this.edges = {};

	this.autoFrame = true;
	this.zoom = 0.5;
	this.midx = 0;//.5;
	this.midy = 0;//.5;

	//this.wtf = 10/9+1/40;

	// this.container.onmouseup = function(e) {
	// 	graph.mouseup(e);
	// }
	// this.container.onmousemove = function(e) {
	// 	graph.mousemove(e);
	// }


}
Graph.prototype.addNode = function(id, parent, width, height) {

	this.n[id] = {
		inSet: {}, 
		keyArr: [], 
		children: {}, 
		parent: parent, 
		minWidth: width, 
		minHeight: height
	};
	this.n[id].left = Math.random()-0.5;
	this.n[id].right = this.n[id].left;
	this.n[id].top = Math.random()-0.5;
	this.n[id].bottom = this.n[id].top;
	this.n[id].dl = 0;
	this.n[id].dr = 0;
	this.n[id].dt = 0;
	this.n[id].db = 0;
	if (parent == null) {
		this.n[id].white = true;
	} else {
		this.n[id].white = !this.n[parent].white;
	}

	var node = document.createElement("div");
	// node.innerHTML = contents;
	node.className = "node";
	node.nid = id;
	node.style.backgroundColor = this.n[id].white ? "#FFF" : "#000";
	node.style.color = this.n[id].white ? "#000" : "#FFF";

	var this2 = this;
	// node.onmousedown = callback;

	// DRAGGING
	// var this2 = this;
	// node.onmousedown = function(e) {
	// 	if (this2.n[id].parent != null) {
	// 		this2.dragging = node;
	// 		var min = Math.min(this2.nodeDIV.offsetWidth, this2.nodeDIV.offsetHeight);
	// 		this2.lOff = this2.n[id].left - e.clientX / min / this2.zoom;
	// 		this2.rOff = this2.n[id].right - e.clientX / min / this2.zoom;
	// 		this2.tOff = this2.n[id].top - e.clientY / min / this2.zoom;
	// 		this2.bOff = this2.n[id].bottom - e.clientY / min / this2.zoom;
	// 		this2.n[id].dl = 0;
	// 		this2.n[id].dr = 0;
	// 		this2.n[id].dt = 0;
	// 		this2.n[id].db = 0;
	// 	}
	// 	if (e.stopPropagation) {
	//         // W3C standard variant
	//         e.stopPropagation();
	//     } else {
	//         // IE variant
	//         e.cancelBubble = true;
	//     }
	// }

	this.nodes[id] = node;
	this.nodeDIV.appendChild(node);

	if (parent != null) {
		this.n[parent].children[id] = true;
	}

	return node;
}
Graph.prototype.addEdge = function(node, key, inNode) {
	this.n[node].inSet[key] = inNode;
}
Graph.prototype.toggle = function() {
	this.running = !this.running;
	if (this.running) { 
		this.run();
	} else {
		for (var key in this.n) {
			this.n[key].dl = 0;
			this.n[key].dr = 0;
			this.n[key].dt = 0;
			this.n[key].db = 0;
		}
	}
}
Graph.prototype.step = function() {
	for (var key in this.n) {
		// for (var key2 in this.n) {				// springs to all nodes
		// 	if (key != key2 && !this.n[key].children[key2] && !this.n[key2].children[key]) {
		// 		var dl = this.n[key].left - this.n[key2].right;
		// 		var dr = this.n[key].right - this.n[key2].left;
		// 		var dt = this.n[key].top - this.n[key2].bottom;
		// 		var db = this.n[key].bottom - this.n[key2].top;
		// 		var w = this.n[key].right - this.n[key].left + this.n[key2].right - this.n[key2].left;
		// 		var h = this.n[key].bottom - this.n[key].top + this.n[key2].bottom - this.n[key2].top;

		// 		var dx = (dl+dr)/2;
		// 		var dy = (dt+db)/2;
		// 		var d2 = dx*dx + dy*dy;
		// 		var d = Math.sqrt(d2);
		// 		var f = (d-0.3-Math.sqrt(w*w + h*h))*0.003;//0.001;
		// 		if (!this.dragging || key != this.dragging.nid) {
		// 			this.n[key].dl -= dx/d*f;
		// 			this.n[key].dr -= dx/d*f;
		// 			this.n[key].dt -= dy/d*f;
		// 			this.n[key].db -= dy/d*f;
		// 		}
		// 	}
		// }

		// extra springs to inSet
		for (var key2 in this.n[key].inSet) {	
			var nid2 = this.n[key].inSet[key2];
			if (!this.n[key].children[nid2]) {
				var dl = this.n[key].left - this.n[nid2].right;
				var dr = this.n[key].right - this.n[nid2].left;
				var dt = this.n[key].top - this.n[nid2].bottom;
				var db = this.n[key].bottom - this.n[nid2].top;
				var w = this.n[key].right - this.n[key].right + this.n[nid2].right - this.n[nid2].right;
				var h = this.n[key].bottom - this.n[key].top + this.n[nid2].bottom - this.n[nid2].top;

				var dx = (dl+dr)/2;
				var dy = (dt+db)/2;
				var d2 = dx*dx + dy*dy;
				var d = Math.sqrt(d2);
				var f = (d-0.15-Math.sqrt(w*w + h*h))*0.02;//0.03;
				var fy = (dt-0.15-h)*0.02;//0.03;
				if (!this.dragging || key != this.dragging.nid) {
					this.n[key].dl -= dl/d*f;
					this.n[key].dr -= dr/d*f;
					this.n[key].dt -= dt/d*f+fy;
					this.n[key].db -= db/d*f+fy;
				}
				if (!this.dragging || nid2 != this.dragging.nid) {
					this.n[nid2].dl += dl/d*f;
					this.n[nid2].dr += dr/d*f;
					this.n[nid2].dt += dt/d*f+fy;
					this.n[nid2].db += db/d*f+fy;
				}
			}
		}

		// contain children
		if (this.n[key].children != null && any(this.n[key].children)) {
			var left = Infinity;
			var leftNode = null;
			var right = -Infinity;
			var rightNode = null;
			var top = Infinity;
			var topNode = null;
			var bottom = -Infinity;
			var bottomNode = null;
			for (var key2 in this.n[key].children) {
				if (left > this.n[key2].left) {
					left = this.n[key2].left;
					leftNode = this.n[key2];
				}
				if (right < this.n[key2].right) {
					right = this.n[key2].right;
					rightNode = this.n[key2];
				}
				if (top > this.n[key2].top) {
					top = this.n[key2].top;
					topNode = this.n[key2];
				}
				if (bottom < this.n[key2].bottom) {
					bottom = this.n[key2].bottom;
					bottomNode = this.n[key2];
				}
			}

			var dl = this.n[key].left - left;
			var dr = this.n[key].right - right;
			var dt = this.n[key].top - top;
			var db = this.n[key].bottom - bottom;

			var f = 0.1;
			if (!this.dragging || key != this.dragging.nid) {
				this.n[key].dl -= (dl+0.05)*f;
				this.n[key].dr -= (dr-0.05)*f;
				this.n[key].dt -= (dt+0.05)*f;
				this.n[key].db -= (db-0.05)*f;
			}

			if (!this.dragging || leftNode != this.dragging) {
				leftNode.dl += (dl+0.05)*f;
				leftNode.dr += (dl+0.05)*f;
			}
			if (!this.dragging || rightNode != this.dragging) {
				rightNode.dl += (dr-0.05)*f;
				rightNode.dr += (dr-0.05)*f;
			}
			if (!this.dragging || topNode != this.dragging) {
				topNode.dt += (dt+0.05)*f;
				topNode.db += (dt+0.05)*f;
			}
			if (!this.dragging || bottomNode != this.dragging) {
				bottomNode.dt += (db-0.05)*f;
				bottomNode.db += (db-0.05)*f;
			}
		}

		// springs between all immediate children
		for (var key2 in this.n[key].children) {
			if (!this.dragging || key2 != this.dragging.nid) {
				for (var key3 in this.n[key].children) {
					if (this.n[key2].parent != this.n[key3].parent) {		//key2 != key3) {
						// var dl = this.n[key3].left - this.n[key2].right;
						// var dr = this.n[key3].right - this.n[key2].left;
						// var dt = this.n[key3].top - this.n[key2].bottom;
						// var db = this.n[key3].bottom - this.n[key2].top;
						// var w = this.n[key3].right - this.n[key3].left + this.n[key2].right - this.n[key2].left;
						// var h = this.n[key3].bottom - this.n[key3].top + this.n[key2].bottom - this.n[key2].top;

						// var dx = (dl+dr)/2;
						// var dy = (dt+db)/2;
						// var d2 = dx*dx + dy*dy;
						// var d = Math.sqrt(d2);
						// var f = (d-0.2-Math.sqrt(w*w + h*h))*0.003;//0.001;
						// if (!this.dragging || key3 != this.dragging.nid) {
						// 	this.n[key3].dl -= dx/d*f;
						// 	this.n[key3].dr -= dx/d*f;
						// 	this.n[key3].dt -= dy/d*f;
						// 	this.n[key3].db -= dy/d*f;
						// }

						var w2 = this.n[key2].right - this.n[key2].left;
						var h2 = this.n[key2].bottom - this.n[key2].top;
						var mx2 = (this.n[key2].right + this.n[key2].left)/2;
						var my2 = (this.n[key2].bottom + this.n[key2].top)/2;
						var w3 = this.n[key3].right - this.n[key3].left;
						var h3 = this.n[key3].bottom - this.n[key3].top;
						var mx3 = (this.n[key3].right + this.n[key3].left)/2;
						var my3 = (this.n[key3].bottom + this.n[key3].top)/2;

						var dx = mx3 - mx2;
						var dx2 = Math.abs(dx) - (w2+w3)/2 - 0.15;
						var dy = my3 - my2;
						var dy2 = Math.abs(dy) - (h2+h3)/2 - 0.15;

						if (dx2 < 0 && dy2 < 0) {
							var fx = (dx > 0 ? 1 : -1) * dx2 * 0.03;
							var fy = (dy > 0 ? 1 : -1) * dy2 * 0.03;

							if (dx2 > dy2) {
								this.n[key2].dl += fx;
								this.n[key2].dr += fx;
							} else {
								this.n[key2].dt += fy;
								this.n[key2].db += fy;
							}	
						}
					}
				}
			}
		}

		// move children towards center slightly
		var mx = (this.n[key].right + this.n[key].left)/2;
		var my = (this.n[key].bottom + this.n[key].top)/2;
		for (var key2 in this.n[key].children) {
			if (!this.dragging || key2 != this.dragging.nid) {
				var mx2 = (this.n[key2].right + this.n[key2].left)/2;
				var my2 = (this.n[key2].bottom + this.n[key2].top)/2;

				// var dx = mx2 - mx;
				// var dy = my2 - my;
				// var d2 = dx*dx + dy*dy;
				// var d = Math.sqrt(d2);
				var fx = -0.0005*(mx2 > mx ? 1 : -1)		//dx/d;
				var fy = -0.0005*(my2 > my ? 1 : -1);		//dy/d;

				this.n[key2].dl += fx;
				this.n[key2].dr += fx;
				this.n[key2].dt += fy;
				this.n[key2].db += fy;
			}
		}

		// order ins
		var totWidth = 0;		// sum of all
		var totHeight = 0;
		for (var key2 in this.n[key].inSet) {
			var n1 = this.n[key].inSet[key2];
			totWidth += this.n[n1].right - this.n[n1].left + 0.05;
			totHeight += this.n[n1].bottom - this.n[n1].top + 0.05;
		}

		var bias = 1;
		if (this.n[key].parent == null) {
			bias = this.nodeDIV.offsetWidth/this.nodeDIV.offsetHeight;
		}
		if (this.n[key].tall) {		// groups try to stick with same direction, avoids flip-flopping
			bias *= 1.1;
		} else {
			bias /= 1.1;
		}
		this.n[key].tall = (totHeight*bias > totWidth);	// tall or squarish

		var keys = Object.keys(this.n[key].inSet).map(parseFloat).sort(function (a,b) {
    		return a - b;
		});
		for (var i=0; i<keys.length-1; i++) {
			var n1 = this.n[this.n[key].inSet[keys[i]]];//this.n[keys[i]];
			var n2 = this.n[this.n[key].inSet[keys[i+1]]];//this.n[keys[i+1]];

			if (this.n[key].tall) { 	
				var dx = n2.left - n1.right - 0.1;
				var fx = -dx*0.1;
				var dy = (n2.bottom+n2.top-n1.bottom-n1.top)/2;
				var fy = -dy*0.1;
			} else {
				var dx = (n2.right+n2.left-n1.right-n1.left)/2;
				var fx = -dx*0.1;
				var dy = n2.top - n1.bottom - 0.1;
				var fy = -dy*0.1;
			}

			n1.dl -= fx;
			n1.dr -= fx;
			n1.dt -= fy;
			n1.db -= fy;

			n2.dl += fx;
			n2.dr += fx;
			n2.dt += fy;
			n2.db += fy;
		}

		// compact self
		// this.n[key].dl += 0.01*(this.n[key].right - this.n[key].left);
		// this.n[key].dr -= 0.01*(this.n[key].right - this.n[key].left);

		// this.n[key].dt += 0.01*(this.n[key].bottom - this.n[key].top);
		// this.n[key].db -= 0.01*(this.n[key].bottom - this.n[key].top);

		// go to center
		if (this.n[key].parent == null) {
			this.n[key].dl -= 0.001*(this.n[key].left);
			this.n[key].dr -= 0.001*(this.n[key].right);
			this.n[key].dt -= 0.001*(this.n[key].top);
			this.n[key].db -= 0.001*(this.n[key].bottom);
		}
	}

	for (var key in this.n) {
		if (!this.dragging || key != this.dragging.nid) {
			this.n[key].dl *= 0.7;
			this.n[key].dr *= 0.7;
			this.n[key].dt *= 0.7;
			this.n[key].db *= 0.7;
			this.n[key].left += this.n[key].dl;
			this.n[key].right += this.n[key].dr;
			this.n[key].top += this.n[key].dt;
			this.n[key].bottom += this.n[key].db;
			if (this.n[key].minWidth && this.n[key].right - this.n[key].left < this.n[key].minWidth) {
				var midx = (this.n[key].left + this.n[key].right)/2;
				this.n[key].left = midx - this.n[key].minWidth/2;
				this.n[key].right = midx + this.n[key].minWidth/2;
			}
			if (this.n[key].minHeight && this.n[key].bottom - this.n[key].top < this.n[key].minHeight) {
				var midy = (this.n[key].top + this.n[key].bottom)/2;
				this.n[key].top = midy - this.n[key].minHeight/2;
				this.n[key].bottom = midy + this.n[key].minHeight/2;
			}
		}
	}

	this.doPlacement();
}
Graph.prototype.run = function(me) {
	me = me || this;
	me.step();
	if (me.running) {
		setTimeout(me.run, 40, me);
	}
}
// Graph.prototype.mouseup = function(e) {
// 	this.dragging = null;
// }
// Graph.prototype.mousemove = function(e) {
// 	if (this.dragging && this.dragging != "pan") {
// 		var min = Math.min(this.nodeDIV.offsetWidth, this.nodeDIV.offsetHeight);
// 		this.n[this.dragging.nid].left = e.clientX/min/this.zoom + this.lOff;
// 		this.n[this.dragging.nid].right = e.clientX/min/this.zoom + this.rOff;
// 		this.n[this.dragging.nid].top = e.clientY/min/this.zoom + this.tOff;
// 		this.n[this.dragging.nid].bottom = e.clientY/min/this.zoom + this.bOff;
	
//		// WARNING: doesn't match other placement code!
// 		this.nodes[this.dragging.nid].style.left = ((this.n[this.dragging.nid].left-this.midx)*100-2.5).toString()+'%';
// 		this.nodes[this.dragging.nid].style.width = ((this.n[this.dragging.nid].right-this.n[this.dragging.nid].left)*100+5).toString()+'%';
// 		this.nodes[this.dragging.nid].style.top = ((this.n[this.dragging.nid].top-this.midy)*100-2.5).toString()+'%';
// 		this.nodes[this.dragging.nid].style.height = ((this.n[this.dragging.nid].bottom-this.n[this.dragging.nid].top)*100+5).toString()+'%';

// 	}
// }
Graph.prototype.doPlacement = function() {

	var asp = this.nodeDIV.offsetWidth/this.nodeDIV.offsetHeight;
	var limitSize = this.nodeDIV.offsetHeight;

	if (this.autoFrame) {
		var minx = Infinity;
		var maxx = -Infinity;
		var miny = Infinity;
		var maxy = -Infinity;

		for (var key in this.n) {
			minx = Math.min(minx, this.n[key].left-0.075);
			maxx = Math.max(maxx, this.n[key].right+0.075);
			miny = Math.min(miny, this.n[key].top-0.075);
			maxy = Math.max(maxy, this.n[key].bottom+0.075);
		}

		var dec = 0.9;

		var m;
		if (maxx-minx > (maxy-miny)*asp) {
			m = maxx-minx;
			limitSize = this.nodeDIV.offsetWidth;
		} else {
			m = (maxy-miny)*asp;
			limitSize = this.nodeDIV.offsetHeight*asp;	// wtf
		}
		this.zoom = this.zoom*dec+(m ? 1/m : 1)*(1-dec);

		if (minx != Infinity) {
			this.midx = this.midx*dec+((minx+maxx)/2)*(1-dec);
			this.midy = this.midy*dec+((miny+maxy)/2)*(1-dec);
		}
	}

	var zoom = this.zoom || 1;

	for (var key in this.n) {
		this.nodes[key].style.left = (((this.n[key].left-this.midx)*100-2.5)*zoom+50).toString()+'%';
		this.nodes[key].style.width = (((this.n[key].right-this.n[key].left)*100+5)*zoom).toString()+'%';
		this.nodes[key].style.top = (((this.n[key].top-this.midy)*100*asp-2.5*asp)*zoom+50).toString()+'%';
		this.nodes[key].style.height = (((this.n[key].bottom-this.n[key].top)*100*asp+5*asp)*zoom).toString()+'%';
		this.nodes[key].style.fontSize = (zoom*limitSize/30)+"px";		// wtf
		this.nodes[key].style.lineHeight = (zoom*limitSize/20)+"px";
	}
	
	//this.nodeDIV.style.transform = "scale("+zoom+","+zoom+")";
	// var perc = ""+(100/zoom)+"%";
	// this.nodeDIV.style.width = perc;
	// this.nodeDIV.style.height = perc;
	// var pos = ""+(50-(50/zoom))+"%";
	// this.nodeDIV.style.left = pos;
	// this.nodeDIV.style.top = pos;
}