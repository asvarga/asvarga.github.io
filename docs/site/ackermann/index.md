---
title: Ackermann Blocks
---


<!DOCTYPE html>


<head>
	<script src="https://code.createjs.com/easeljs-0.8.2.min.js"></script>
	<script src="https://code.createjs.com/tweenjs-0.6.2.min.js"></script>
	<script src="./js/ack.js"></script>
	<link rel="stylesheet" type="text/css" href="./css/style.css">
</head>

# Ackermann Blocks
<body onload="init();">
	<center>
		The size of the block piles represent equations using the Ackermann function A. <br>
		For example, when the piles are [2, 1, 1, 1], that represents A(2, A(1, A(1, 1))). <br>
		The default settings show A(3, 1) reducing to 13. <br><br>
		<a href="https://en.wikipedia.org/wiki/Ackermann_function">About the Ackermann Function</a>
		<pre>Space : Step    P : Play/Pause    R : Restart</pre>
		<pre><= : Slower    => : Faster</pre>

	</center>
	<canvas id="myCanvas" width="800" height="500"></canvas>
</body>

