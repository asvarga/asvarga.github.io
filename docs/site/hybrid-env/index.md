---
title: Hybird Env
hide:
  - toc
---

# Hybrid Environments

<!DOCTYPE html>
<html>
	<head>
		<style type="text/css" media="screen">
			/* body {
				margin: 0px;
				background-color: aquamarine;
			} */
			/* #all {
				margin: 0 auto;
    			width: 1000px;
			} */
			.outerOutput { 
				position: absolute;
				right: 0;
				height: 100%;
				width: 40%;
				background-color: gray;
				overflow-y: scroll;
			}
			.innerOutput {
				padding: 10px;
				word-wrap: break-word;
				margin: auto;
			}
			/* .words {
				margin: 10px auto;
    			width: 600px;
    			padding: 10px;
    			background-color: lightgray;
			} */
		</style>
		<script src="parser.js"></script>
		<script src="code.js"></script>
	</head>
	<body>
		<div id="all">
			<div class="words">
				<b>The Challenge</b><br>
				Make a language...
				<ul>
					<li>with as few special forms as possible.</li>
					<li>where as much as possible is first class.</li>
					<li>with a simple interpreter.</li>
					<li>that is usable.</li>
				</ul>
				My solution is a combination of far too many quotes, and something I call "hydrid environments". I made a minimal interpreter to demonstrate the ideas in javascript. If nothing else, it's kinda fun.
			</div>

			<div class="words">
				<b>How to run the code snippets</b> 
				<ul>
					<li>Click into an editor and press command-enter or ctrl-enter to run it.</li>
					<li>Everything runs in a USER environment, so snippets may need to be run <em>in order.</em></li>
					<li>You can edit the code, but</li>
					<li>It's possible to mess everything up. If you do, refresh.</li>
				</ul>
				<b>Things that are bad</b> 
				<ul>
					<li>Code isn't sanitized or sandboxed.</li>
					<li>Printing and error messages are horrible.</li>
					<li>No comments.</li>
				</ul>
			</div>

			<div class="words">
				<b>Basics</b><br>
				It's a little lispy. 'noop' is a variadic function that just returns. This is useful for doing multiple things in sequence, because arguments are reduced strictly in order before being passed to operators/functions.
			</div>

			<div class="group" style="position: relative; height: 200px; margin: 10px auto;">
<div id="input2" style="position: absolute; height: 100%; left: 0; width: 60%;">
(noop
    (println (+ 1 2))
    (println (+ (println "First") (println "Second")))
)
</div>	
				<div class="outerOutput">
					<div class="innerOutput">
						<b>Output</b>
						<div class="output"></div>
						<hr>
						<b>Result</b>
						<div class="result"></div>
					</div>
				</div>
			</div>

			<div class="words">
				<b>Quotes</b><br>
				Quotes let us treat code as data and data as code. They're used a lot in this language. They're best thought of as objects that contain code and reduce to themselves, rather than a special form or a mechanism for delaying intepretation. Printing things can be uninformative, but the 'json' function sometimes helps.
			</div>

			<div class="group" style="position: relative; height: 200px; margin: 10px auto;">
<div id="input3" style="position: absolute; height: 100%; left: 0; width: 60%;">
(noop
    (println (+ 1 2))
    (println '(+ 1 2))
    (println (json '(+ 1 2)))
)
</div>	
				<div class="outerOutput">
					<div class="innerOutput">
						<b>Output</b>
						<div class="output"></div>
						<hr>
						<b>Result</b>
						<div class="result"></div>
					</div>
				</div>
			</div>

			<div class="words">
				<b>Hooks</b><br>
				Hooks are another type of thing. They are:
				<ul>
					<li>@run: reduces to the current interpreter.</li>
					<li>@nv: reduces to the current environment.</li>
					<li>@snv and @dnv: shorthand for @nv's static and dynamic parent environments (more on this later).</li>
				</ul>
				The interpreter itself is just a function in the language called "run". It takes two arguments, a quote expression and an environment, and returns the result of reducing the expression in that environment. So, (run '@run nv) == run, and (run '@nv nv) == nv, for any nv.
			</div>

			<div class="group" style="position: relative; height: 200px; margin: 10px auto;">
<div id="input4" style="position: absolute; height: 100%; left: 0; width: 60%;">
(noop
    (println @run)
    (println @nv)
    (println (@run '(+ 1 2) @nv))

    (println (== (@run '@run @nv) @run))
    (println (== (@run '@nv @nv) @nv))
)
</div>	
				<div class="outerOutput">
					<div class="innerOutput">
						<b>Output</b>
						<div class="output"></div>
						<hr>
						<b>Result</b>
						<div class="result"></div>
					</div>
				</div>
			</div>

			<div class="words">
				<b>Closures</b><br>
				Closures are what you'd think of as lambdas, but take their static environment as an explicit argument. The arguent list and body must be quoted to prevent them from being interpreted. It's a mess but we'll fix it soon.
			</div>

			<div class="group" style="position: relative; height: 200px; margin: 10px auto;">
<div id="input5" style="position: absolute; height: 100%; left: 0; width: 60%;">
(noop
    (println
    	(Closure '(x y) 
    			 '(+ (* x x) (* y y))
    			 @nv))
    (println  
    	((Closure '(x y) 
    			  '(+ (* x x) (* y y))
    			  @nv) 3 4))
)
</div>	
				<div class="outerOutput">
					<div class="innerOutput">
						<b>Output</b>
						<div class="output"></div>
						<hr>
						<b>Result</b>
						<div class="result"></div>
					</div>
				</div>
			</div>

			<div class="words">
				<b>Let</b><br>
				This language doesn't have a 'let' special form, or any other special forms, but we'll make one soon. We do get 'elet' though, which takes an explicit environment and an identifier to assign a value.
			</div>

			<div class="group" style="position: relative; height: 200px; margin: 10px auto;">
<div id="input6" style="position: absolute; height: 100%; left: 0; width: 60%;">
(noop
    (elet @nv 'x 321)
    (println x)
    (println (+ x 4000))
)
</div>	
				<div class="outerOutput">
					<div class="innerOutput">
						<b>Output</b>
						<div class="output"></div>
						<hr>
						<b>Result</b>
						<div class="result"></div>
					</div>
				</div>
			</div>

			<div class="words">
				<b>Hybrid Environments</b><br>
				This is also a mess, and we'll fix it now by writing a simple 'let' function using <em>hybrid environments</em>. When a Closure is appied to arguments, a hybrid environment is made consisting of 3 parts.
				<ul>
					<li>d: a personal dict for this application to store values.</li>
					<li>snv: the <em>static</em> environment that the Closure remembered, which was captured when the Closure was <em>created</em>.</li>
					<li>dnv: the <em>dynamic</em> environment which is the one from which the Closure was <em>called</em>.</li>
				</ul>
				Now we can write 'let' by using @dnv to get and modify the environment from which the 'let' Closure is called.
			</div>

			<div class="group" style="position: relative; height: 200px; margin: 10px auto;">
<div id="input7" style="position: absolute; height: 100%; left: 0; width: 60%;">
(noop    
	"let without explicit nv"
    (elet @nv 'let (Closure '(key val) '(elet @dnv key val) @nv))
    
    (let 'y 654000)
    (println (+ y x))
)
</div>	
				<div class="outerOutput">
					<div class="innerOutput">
						<b>Output</b>
						<div class="output"></div>
						<hr>
						<b>Result</b>
						<div class="result"></div>
					</div>
				</div>
			</div>

			<div class="words">
				<b>Some Fun Stuff</b><br>
				It's a little complicated, but we only have to do it once, and now we can simply use 'let'. Now we can fix that Closure mess, by writing 'lam'. Let's make some other fun stuff while we're at it, including short-circuiting functions, swap, and named functions. Demos below.
			</div>

			<div class="group" style="position: relative; height: 600px; margin: 10px auto;">
<div id="input8" style="position: absolute; height: 100%; left: 0; width: 60%;">
(noop    
    "closure without explicit nv"
	(let 'lam (Closure '(args body) '(Closure args body @dnv) @nv))

	"easily reduce value inside a quote"
	(let 'run (lam '(body) '(@run body @dnv)))
	"like run but in new scope"
	(let 'block (lam '(body) '((Closure '() body @dnv))))
	
	"short-circuiting if from _if"
	(let 'if (lam '(x y z) '(@run (_if x y z) @dnv)))
	"swap the values of 2 identifiers"
	(let 'swap (lam '(ida idb) '(noop
	                                (let 'tmp (eget @dnv ida))
	                                (elet @dnv ida (eget @dnv idb))
	                                (elet @dnv idb tmp))))
	   
	"named closures"                         
	(let 'function (lam '(name args body nv)
                        '(last
                             (let 'd (dict))
                             (let 'C (Closure args body (Env d nv)))
                             (dset d name C)
                             C)))
    "function without explicit nv"
    (let 'fun (lam '(name args body)
                   '(elet @dnv name (function name args body @dnv))))

    (println "success")
)
</div>	
				<div class="outerOutput">
					<div class="innerOutput">
						<b>Output</b>
						<div class="output"></div>
						<hr>
						<b>Result</b>
						<div class="result"></div>
					</div>
				</div>
			</div>

			<div class="group" style="position: relative; height: 600px; margin: 10px auto;">
<div id="input9" style="position: absolute; height: 100%; left: 0; width: 60%;">
(noop    
    "runs quote with new hybrid env"
    (block '(noop
        (let 'sqr (lam '(x) '(* x x)))
        "sqr in scope"
    	(println (sqr 6))
    ))
    "sqr out of scope"
    (println sqr) (println "")

    "never prints 3"
    (println (if (println 1) 
                 '(println 2) 
                 '(println 3)))
    (println "")

    "swap"
    (let 'a 4)
    (let 'b 5)
    (println (+ a (+ ", " b)))
    (swap 'a 'b)
    (println (+ a (+ ", " b)))
    (println "")

    "factorial"
    (fun 'fact 
          '(x)
          '(if (== x 0)
               '1
               '(* x (fact (- x 1)))))
    (println (fact 5))
)
</div>	
				<div class="outerOutput">
					<div class="innerOutput">
						<b>Output</b>
						<div class="output"></div>
						<hr>
						<b>Result</b>
						<div class="result"></div>
					</div>
				</div>
			</div>
		

			<div class="words">
				<b>Experiment</b><br>
				Here's a place to experiment. 'last' is a variadic function like 'noop', but it returns its last argument. You may want to 
				<button onclick="runAll();">Run All Editors</button>
			</div>

			<div class="group" style="position: relative; height: 600px; margin: 10px auto;">
<div id="input10" style="position: absolute; height: 100%; left: 0; width: 60%;">
(last    
	"do stuff here"

    "base environment keys"
	(println (json (keys (e-d base))))
	"user environment keys"
	(println (json (keys (e-d @nv))))

    (date)
)
</div>	
				<div class="outerOutput">
					<div class="innerOutput">
						<b>Output</b>
						<div class="output"></div>
						<hr>
						<b>Result</b>
						<div class="result"></div>
					</div>
				</div>
			</div>

			<div class="words">
				<b>First Attempt</b><br>
				My first attempt at giving applications access to both the static and dynamic environments was to pass both to the interpret function, along with the code to be interpreted. This doesn't work though, because it makes it impossible to get the dynamic parent of the dynamic parent of an environment. For example, if interp/@run took (code, snv, dnv), the short circuiting 'if' would look like:
```lisp
(let 'if (lam '(x y z) '(@run (_if x y z) @dnv false)))
(if true '(if true '1 '2) '3)
```
				The outer 'if' would want to run the inner 'if' in the dynamic environment from which it was called. However, it wouldn't have access to <em>that</em> environment's dynamic parent, which the inner 'if' needs.
			</div>

			<div class="words">
				<b>Goals</b><br>
				This achieves the original goals of making a language...
				<ul>
					<li>with as few special forms as possible: There are none, unless you count quotes, but they're more like objects.</li>
					<li>where as much as possible is first class: The current interpreter and environment are accessible and manipulable. Identifiers and expressions can be "used" by quoting them.</li>
					<li>with a simple interpreter: The interpreter has only 4 cases: expressions, identifiers, hooks, and everything else which reduces to itself.</li>
					<li>that is usable: For normal, less meta use, it's not bad at all, and only really gets tricky when writing "special forms". There's often an extra or missing quote. This is easier to debug in my version with better printing.</li>
				</ul>
			</div>

			<div class="words">
				<b>But Why?</b><br>
				Hybrid environments are clearly neither safe, sane, nor fast. All code has access to all code. However, I think there is value in its lack of value. Starting with a fully powerful, small, horrible language gives perspective on what is necessary to make any language safer, saner, and faster. I'm particlarly interested in "safer". Is it possible to sandbox in such a chaotic language? One might have to perform <em>static</em> analysis <em>dynamically</em>. The language might need a full "understanding" of it's own semantics so it could reason about itself, along with the "assertive force" to trust itself.
			</div>

			<div class="words">
				<!-- Made by Alex Varga in 2016 -->
				<!-- <br> -->
				Uses <a href="https://ace.c9.io" target="_blank">Ace</a> for the editors
			</div>

		</div>



		<script src="https://cdn.jsdelivr.net/ace/1.2.4/min/ace.js" type="text/javascript" charset="utf-8"></script>
		<script>
			var c = 2;
			while (document.getElementById("input"+c)) {
				var input = ace.edit("input"+c);
				input.setTheme("ace/theme/monokai");
				input.getSession().setMode("ace/mode/clojure");
				input.setBehavioursEnabled(false);
				input.commands.addCommand({
				    name: 'runCommand',
				    bindKey: {win: 'Ctrl-Enter',  mac: 'Command-Enter'},
				    exec: go,
				    readOnly: true // false if this command should not apply in readOnly mode
				});
				// go(input);
				c = c+1;
			}

			function runAll() {
				var c = 2;
				while (document.getElementById("input"+c)) {
					var input = ace.edit("input"+c);
					go(input);
					c = c+1;
				}
			}
		</script>
	</body>
</html>


