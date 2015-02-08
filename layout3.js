
window.onload = function() {

	topDiv = document.createElement("div");
	topDiv.style.position = "fixed";
	topDiv.style.width = "100%";//"100vmin";
	topDiv.style.height = "100%";//"100vmin";
	document.body.appendChild(topDiv);

	graph = new Graph(topDiv);
	graph.toggle();

	//

	ind = 0;

	NONE = 0;
	ALERT = 1;
	LINK = 2;
	CUSTOM = 3;

	data = [
		{id:'top', text:'ALEX VARGA\'S SITE', type:ALERT, data:"You clicked the root.", width:0.4},
		{id:'welcome', text:'Welcome!', parent:'top', type:NONE, width:0.12},
		{id:'readme', text:'README', parent:'welcome', type:LINK, data:"./readme.html", width:0.12},
		{id:'meta', text:'Meta', parent:'welcome', type:LINK, data:"./meta.html", width:0.08},
		{id:'fun', text:'Fun', parent:'welcome', type:LINK, data:"./fun.html", width:0.12},
		{id:'math', text:'Math', parent:'top', type:NONE, width:0.12},
		{id:'math1', text:'Mathy Thing 1', parent:'math', type:ALERT, data:"TODO: Link to mathy thing #1", width:0.25},
		{id:'math2', text:'Mathy Thing 2', parent:'math', type:ALERT, data:"TODO: Link to mathy thing #2", width:0.25},
		{id:'code', text:'Code', parent:'top', type:NONE, width:0.12},
		{id:'silk', text:'Silk', parent:'code', type:LINK, data:"./silk.html", width:0.1},
		{id:'code2', text:'Code Thing 2', parent:'code', type:ALERT, data:"TODO: Link to code thing #2", width:0.15},
		{id:'code3', text:'Code Thing 3', parent:'code', type:ALERT, data:"TODO: Link to code thing #3", width:0.15},

	];

	for (var i=0; i<data.length; i++) {
		data[i].nextChildId = 0;
	}

	//

	// //graph.addNode(0);
	// ind = 1;
	// var node = graph.addNode(ind, null, 0.4);//, 0);
	// node.innerHTML = "CLICK A NODE!";
	// node.onclick = function(e) { alert("#YOLO"); }
	// ind++;
	// // for (var i=2; i<=15; i++) {
	// // 	graph.addNode(i, Math.floor(i/2));
	// // }
	// graph.doPlacement();

	setTimeout(addOneRep, 250);
}

function addOneRep() {
	// addOne();
	// if (ind <= 15) {
	// 	setTimeout(addOneRep, 250);
	// } else {
	// 	// graph.aboutButton = document.createElement("div");
	// 	// graph.aboutButton.className = "button";
	// 	// graph.aboutButton.innerHTML = "+";
	// 	// graph.aboutButton.onclick = function(evt) {
	// 	// 	addOne();
	// 	// }
	// 	// graph.buttons.appendChild(graph.aboutButton);
	// }

	addOne();
	if (ind < data.length) {
		setTimeout(addOneRep, 250);
	}
}

function addOne() {
	// var node = graph.addNode(ind, Math.floor(ind/2), 0.4);
	// node.innerHTML = ind;
	// var ind2 = ind;
	// node.onclick = function(e) { alert(ind2); }
	// graph.addEdge(Math.floor(ind/2), ind, ind);
	// graph.doPlacement();
	// ind++;

	var datum = data[ind++];
	var node = graph.addNode(datum.id, datum.parent, datum.width, datum.height);
	if (datum.type == ALERT) {
		node.onclick = function(e) { alert(datum.data); }
	} else if (datum.type == LINK) {
		node.onclick = function(e) { window.location = datum.data; }
	} else if (datum.type == CUSTOM) {
		node.onclick = datum.data;
	} else {
		node.style.cursor = "default";
	}
	if (datum.parent !== undefined && datum.parent !== null) {
		node.innerHTML = datum.text;
		graph.addEdge(datum.parent, ind, datum.id);
	} else {
		node.innerHTML = "<u><b>"+datum.text+"</b></u>";
	}
	graph.doPlacement();
}











