// Div Jumper moved to /div-jumper/divJumper.js. Bookmarklets saved before the
// move still load this file, so it hands them the new one.
(function () {
	var old = document.getElementById('divJumper');
	if (old) old.removeAttribute('id');
	var s = document.createElement('script');
	s.id = 'divJumper';
	s.src = 'https://asvarga.com/div-jumper/divJumper.js';
	document.body.appendChild(s);
})();
