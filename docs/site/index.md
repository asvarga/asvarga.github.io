---
title: Site
---

<style type="text/css" media="screen">
    /* html {
        margin: 0px;
        height: 100%;
        width: 100%;
    }
    body {
        margin: 0px;
        min-height: 100%;
        width: 100%;
        background-color: lightblue;
        position: relative;
    }
    h1 {
        text-align: center;
        font-size: 48px;
    } */

    /*#all {
        margin: 0 auto;
        width: 1000px;
    }*/
    /* .outerOutput { 
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
    .words {
        margin: 10px auto;
        width: 600px;
        padding: 10px;
        background-color: lightgray;
    } */
    
    .animate-letters {
        display: inline-block;
    }
    .animate-letters > span {
        font-family: "Lucida Console", Monaco, monospace;
        display: inline-block;
        border-radius: 50%;
        -webkit-transition: -webkit-transform .8s ease-in-out;
        transition: transform .8s ease-in-out;
    }
    .animate-letters:hover > span.rotate, .fake-hover > span.rotate {
        -webkit-transform: rotate(180deg) translate(0, 5%);
        transform: rotate(180deg) translate(0, 5%);
    }
    .animate-letters:hover > span.flip, .fake-hover > span.flip {
        -webkit-transform: scaleY(-1) translate(0, 5%);
        transform: scaleY(-1) translate(0, 5%);
    }

    .tag-proofs { padding: 0px; /*border: 1px solid red;*/ background-color: #ec706380; }
    .tag-proofs::after { content: "#proofs" }

    .tag-languages { padding: 0px; /*border: 1px solid orange;*/ background-color: #f5b04180; }
    .tag-languages::after { content: "#languages" }

    .tag-algorithms { padding: 0px; /*border: 1px solid yellow;*/ background-color: #e4e03f80; }
    .tag-algorithms::after { content: "#algorithms" }

    .tag-gpu { padding: 0px; /*border: 1px solid green;*/ background-color: #58d68d80; }
    .tag-gpu::after { content: "#gpu" }

    .tag-pretty { padding: 0px; /*border: 1px solid blue;*/ background-color: #5dade280; }
    .tag-pretty::after { content: "#pretty" }

    .tag-games { padding: 0px; /*border: 1px solid purple;*/ background-color: #884ea080; }
    .tag-games::after { content: "#games" }

</style>


<!-- <h1>
    <div id="av" class="animate-letters fake-hover" alt="ALEX VARGA">
        <span class="rotate">A</span>
        <span class="flip">L</span>
        <span class="rotate">E</span>
        <span class="flip">X</span>
        <span>&nbsp;</span>
        <span>V</span>
        <span>A</span>
        <span>R</span>
        <span>G</span>
        <span>A</span>
    </div>
    <script type="text/javascript">
        setTimeout(function() {
            document.getElementById("av").classList.remove("fake-hover");
        }, 0);
    </script>
</h1> -->

<!-- ## Bio
I am a mathematically-minded software engineer who is fascinated by programming languages and abstractions that enable coherent, maintainable, and verifiably-correct software. One of my long-term projects is combining metaprogramming, formal verification, and actor models to create a multi-user programming environment. -->


# Some Interactive Projects


<ul>
    <li>
        <!-- ./resume/index.html?exec=trs -->
        <a target="_blank" href="./gproof">Graphical Proof Assistant</a> : Graph-based proof assistant using my "Hybrid UI". Made this tool to help me experiment with type systems. (<a target="_blank" href="https://vimeo.com/355226173" target="_blank">Video</a>) 
        <span class="tag-proofs"></span> 
        <span class="tag-pretty"></span>
    </li>
    <li>
        <a target="_blank" href="https://github.com/asvarga/ordinal-arithmetic">Verified Ordinal Arithmetic</a> : Implementation of ordinal arithmetic with properties verified in Liquid Haskell (Haskell + Refinement Types). I proved that my Cantor Normal Form representation of ordinals is closed under the operations needed to implement the Num and Ord typeclasses.
        <span class="tag-proofs"></span> 
        <span class="tag-algorithms"></span>
    </li>
    <li>
        <a href="./fireworks">3D Fireworks</a> : Graphics Course final project with thousands of particles with real-time lighting. 
        <span class="tag-gpu"></span> 
        <span class="tag-pretty"></span>
    </li>
    <li>
        <a href="./hybrid-env">Hybrid Environments</a> : A programming language combining static and dynamic scoping. It's fun but probably a horrible idea; try it in the browser! 
        <span class="tag-languages"></span>
    </li>
    <li>
        <a href="./collision-trees">Collision Trees</a> : Computational art from self-colliding trees with a surprising variety of emergent behaviors. 
        <span class="tag-algorithms"></span> 
        <span class="tag-pretty"></span>
    </li>
    <li>
        <a href="./ackermann">Ackermann Blocks</a> : Interactive Ackermann function visualizer. 
        <span class="tag-algorithms"></span>
    </li>
    <li>
        <!-- <a target="_blank" href="http://turingturtle.appspot.com/">Turing Turtle</a> -->
        Turing Turtle : Puzzle game with turing machine programming. 
        <!-- I made an iOS version but it's not currently in the App Store.  -->
        <span class="tag-games"></span>
        <span class="tag-algorithms"></span>
        <ul>
            <li><a target="_blank" href="https://www.youtube.com/watch?v=lBxgJZyGVoQ">4 minute video</a></li>
            <li><a target="_blank" href="https://www.youtube.com/watch?v=E6qZlcyR4uc">1 minute video</a></li>
        </ul>
    </li>
    <li>
        <a href="./splotch">Paint Splotch Shadertoy</a> : Watching this simulated paint dry isn't boring, I promise! 
        <span class="tag-gpu"></span>
    </li>
    <li>
        <a target="_blank" href="https://github.com/asvarga/String-Reuse-Visualizer">String Reuse Visualizer</a> : Visualize how text transformers reuse chars in memory. 
        <span class="tag-languages"></span>
    </li>
    <li>
        <a href="./div-jumper">Div Jumper</a>
    </li>
    <!-- 
    <li>
        <a target="_blank" href="http://thealexvarga.appspot.com/sets">Set Theory Explorer</a> : A simple set theory proof assistant (very old). (<a target="_blank" href="./images/set.png">Screenshot</a>) 
        <span class="tag-proofs"></span>
    </li>
    
    <li>
        <a target="_blank" href="http://graupelgames.appspot.com/">Graupel Games</a> : A javascript content management site. Here are some games I made with it:
        <ul>
            <li>
                <a target="_blank" href="http://graupelgames.appspot.com/?urls=%5B%22%2FRoMuSHoo%2Fcode%2FRoMuSHoo.js%22%5D">Romantic Mushroom Shoot</a> : I was randomly assigned this game name in a game jam and threw this together in ~8 hours.
                <span class="tag-games"></span>
            </li>
            <li>
                <a target="_blank" href="http://graupelgames.appspot.com/?urls=%5B%22%2Faboidance%2Fcode%2Faboidance.js%22%5D">Aboidance</a> : Flocking boids you can chase.
                <span class="tag-games"></span>
                <span class="tag-algorithms"></span>
            </li>
            <li>
                <a target="_blank" href="http://graupelgames.appspot.com/?urls=%5B%22%2Fphrog%2Fphrog.js%22%5D">Phrog</a> : Beginnings of an attempt to make an extensible 3D Frogger-like game. Click Levels > Play > Use WASD/Arrows
                <span class="tag-games"></span>
            </li>
        </ul>
    </li>
    <li>
        <a target="_blank" href="./motp/index.html">Mars of the Penguins</a> : In-progress game about programming a colony of bots.
        <span class="tag-games"></span>
    </li>
    <li>
        <a href="http://www.java4k.com/index.php?action=games&method=view&gid=393">Tide Frog</a> : My submission to Java4K 2012.
    </li> -->
</ul>





<!-- <div class="words">
    <h2>Fun things I made in school recently</h2>
    <br>
    <a href="https://flic.kr/p/rxgdaY">3D Robotic Tree</a> : 3D robotic L-system tree.
</div> -->
<!-- <div class="words">
    <h2>Goals</h2>

    Let's make an abstract operating system grounded in metaprogramming, formal methods, and capabilities.

    I should write more here, but most of my computational goals stem from trying to make it safe to run untrusted code received at run-time and exploring the new ways of "interacting with computing" that this enables.

    I'm very interesting in the challenge of letting code from many different "coders" who don't necessarily trust each other interact harmoniously. These "coders" might be
    <ul>
        <li>Users of an application that wish to customize it's behavior with scripts.</li>
        <li>Many developers of the same project.</li>
        <li>Teachers running programs to assess programs their students have written.</li>
        <li>Gamers that wish to automate in-game processes.</li>
        <li>Genetic algorithms that produce randomized programs.</li>
    </ul>
    Capability-based programming languages like E enable a significant amount of this. I'm interested in how such languages can be made more "expressive". It should be possible to ask untrusted code for proof of any imaginable guarantee about its behavior, as well as generating and verifying such proofs, all within the constructs of the language. Guarantees about the computational cost of running the given code would be especially useful. Monte is a language based on E with a JIT-compiler and some really neat features that seems like a promising contender to achieve these things, and I'd really like to contribute to its development. 
</div> -->
<!-- <div class="words" style="text-align: center;">
    <a id="button" href="javascript:var s=document.createElement('script');document.body.appendChild(s);s.id='divJumper';s.src='https://thealexvarga.bitbucket.io/divJumper.js';void(0);">Div Jumper!</a> (<a href="./div-jumper">about</a>)
</div> -->




