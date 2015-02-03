
window.onload = function() {
	// document.body.style.backgroundImage = "url('space.jpg')";
	// document.body.style.backgroundSize = "100%";

	topDiv = document.createElement("div");
	topDiv.style.position = "fixed";
	//topDiv.style.left = "100%";//"calc(50% - 50vmin)";
	topDiv.style.width = "100%";//"100vmin";
	//topDiv.style.top = "100%";//"calc(50% - 50vmin)";
	topDiv.style.height = "100%";//"100vmin";
	//topDiv.style.backgroundColor = "black";
	//topDiv.style.overflow = "hidden";
	// topDiv.style.display = "inline-block";
	document.body.appendChild(topDiv);

	graph = new Graph(topDiv);
	graph.toggle();

	//

	//graph.addNode(0);
	ind = 1;
	graph.addNode(ind, null, "CLICK A NODE!", function() {
		alert("YOOOO");
	}, 0.4);//, 0);
	ind++;
	// for (var i=2; i<=15; i++) {
	// 	graph.addNode(i, Math.floor(i/2));
	// }
	graph.doPlacement();

	setTimeout(addOneRep, 250);
}

function addOneRep() {
	addOne();
	if (ind <= 15) {
		setTimeout(addOneRep, 250);
	} else {
		graph.aboutButton = document.createElement("div");
		graph.aboutButton.className = "button";
		graph.aboutButton.innerHTML = "+";
		graph.aboutButton.onclick = function(evt) {
			addOne();
		}
		graph.buttons.appendChild(graph.aboutButton);
	}
}

function addOne() {
	var ind2 = ind;
	graph.addNode(ind, Math.floor(ind/2), "loooooooooooong text "+ind, function() {
		alert(ind2);
	}, 0.4);
	graph.addEdge(Math.floor(ind/2), ind, ind);
	graph.doPlacement();
	ind++;
}











