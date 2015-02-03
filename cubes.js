
window.onload = function() {

}

document.onkeydown = function(evt) {
    evt = evt || window.event;
    if (evt.keyCode == 32) {	// space
		
    }
}

function shrink(p, size) {
	var shrunk = [];
	for (var i=0; i<3; i++) {
		shrunk.push(Math.min(p[i], size-1-p[i]));
	}
	return shrunk;
}

function uniquify(p, size) {
	return shrink(p, size).sort();
}

function eq(a, b) {
	return (JSON.stringify(a) == JSON.stringify(b))
}




