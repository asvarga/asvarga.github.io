
window.onload = function() {

	topDiv = document.createElement("div");
	topDiv.style.position = "fixed";
	topDiv.style.width = "100%";//"100vmin";
	topDiv.style.height = "100%";//"100vmin";
	document.body.appendChild(topDiv);

	graph = new Graph(topDiv);
	graph.toggle();

	graph.backButton = document.createElement("div");
	graph.backButton.className = "button";
	graph.backButton.innerHTML = "<=";
	graph.backButton.onclick = function(evt) {
		window.location = "./Main.html";
	}
	graph.buttons.appendChild(graph.backButton);

	//

	ind = 0;
	addNodeTo();

	// setTimeout(addOneRep, 250);

}

function addNodeTo(parent) {
	var node = graph.addNode(ind, parent);
	node.innerHTML = ind;
	var ind2 = ind;
	node.onclick = function(e) {
		addNodeTo(ind2);
	}
	graph.doPlacement();
	if (parent !== null && parent !== undefined) {
		graph.addEdge(parent, ind, ind);
	}
	ind++;
}

// function addOneRep() {
// 	addOne();
// 	if (ind <= 15) {
// 		setTimeout(addOneRep, 250);
// 	} else {
// 		graph.aboutButton = document.createElement("div");
// 		graph.aboutButton.className = "button";
// 		graph.aboutButton.innerHTML = "+";
// 		graph.aboutButton.onclick = function(evt) {
// 			addOne();
// 		}
// 		graph.buttons.appendChild(graph.aboutButton);
// 	}
// }

// function addOne() {
// 	if (ind == 0) {
// 		var node = graph.addNode(ind, null);
// 	} else {
// 		var node = graph.addNode(ind, Math.floor(ind/2));
// 		graph.addEdge(Math.floor(ind/2), ind, ind);
// 	}
	
// 	node.innerHTML = ind;
// 	var ind2 = ind;
// 	node.onclick = function(e) { alert(ind2); }
// 	graph.doPlacement();
// 	ind++;
// }











