# Collision Trees

The rules describing how these images are created are simple to describe. Grow a tree of branching lines in the obvious way, but whenever multiple branches collide, cut off the branches that reached there last. These simple rules lead to a surprising variety of behaviors. I give some implementation details at the bottom.

All of the trees in this first group only vary in the number and angle of their branches at each branching point. For example, each such tree can be parameterized by a list of angles like [+PI/4, -PI/4], in addition to a parameter for tree depth. See if you can figure out how each of their behaviors arise, given that they all start from a single vertical line.

<img src="images/62F47872-30A7-4C41-8E69-65BA1AB430E2.png" width="800">
<img src="images/D2523239-4F55-49FE-B35D-18B3C4E0149E.png" width="800">
<img src="images/11480D6E-7158-46AB-8052-79B265D46EE4.png" width="800">
<img src="images/7055400C-EA1A-477A-B9B5-99F1D02A6A14.png" width="800">
<img src="images/E0E98CE5-AC37-4E13-90A5-8BDAE2780DE3.png" width="800">
<img src="images/253137B5-05E2-4879-9215-CECED6FD9EAB.png" width="800">
<img src="images/2844C2E7-A25C-4F41-9420-3FEF1CC1ACB3.png" width="800">
<img src="images/A29CEEE1-4D82-4AF6-82C7-36ABF1A402C8.png" width="800">
<img src="images/E8A545D3-057A-43FD-9E94-49119E34B9BC.png" width="800">
<img src="images/39AFC872-B6A7-4B01-8FB0-C619E0CB9DF2.png" width="800">
<img src="images/A8EB31B9-FD4E-483F-BB23-44BE3E4FEDCB.png" width="800">
<img src="images/FA3E92B2-29BB-4843-8E9C-3346E34BB851.png" width="800">
<img src="images/3B235B2C-A1AA-4878-9DAA-0A572AA348DF.png" width="800">
<img src="images/4CD68081-D70D-432C-A739-B0F687AF9F1E.png" width="800">
<img src="images/D17AD138-3F91-4ADD-9BD2-C75CEACD6F9B.png" width="800">
<img src="images/FE31281F-262B-46CD-BEC5-D68EA2526709.png" width="800">

This tree breaks the pattern above by exponentially decaying the length of branches:

<img src="images/B2F97D53-2F40-4452-8261-3D1BAC3BB550.jpg" width="800">

These are Fibonacci Trees. Try counting the leaves of the various dendrites sticking out the top of the first image:

<img src="images/E60A41B9-F5C1-472D-830E-2F0F670D28E9.png" width="800">
<img src="images/7AC43F4A-735D-445E-8346-B001BC4D7CDF.png" width="800">

These images have multiple groups of trees growing at different speeds, racing to fill the plane. Compare to my <a href="../splotch/index.html">continuous simluation</a> of the same dynamic.

<img src="images/FADB83C7-B321-4030-BEE2-3A85DF0417DC.png" width="800">
<img src="images/04D52F72-22E3-4B60-9F09-20493F7533FF.png" width="800">

Here is one that my <a href="https://www.jaclynvarga.com/">sister</a> printed out and colored in:

<img src="images/colored.jpeg" width="800">

Some animations of growth:

<iframe src="https://player.vimeo.com/video/346623516" width="640" height="642" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>

<iframe src="https://player.vimeo.com/video/346623354" width="640" height="640" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>

The original idea for a self-colliding tree was conceived of by another member of the "Aesthetic Function Graphposting" Facebook group. My contribution was to improve the algorithm in the following ways so that I could further explore the parameter space:

- Performance: All line segment are stored in a hash-table indexed by their middle coordinates rounded to a pair of integers. Since each segment is limited to a length of 1, the algorithm only needs to check a segment for intersection with nearby coordinates.
- Generality: Allowing for multiple branches and branches at different angles, as well as the additional experiments above.
- Collision Conditions: The above generailities mean that branches that collide don't always reach that point at the same time and therefore don't all die. This requires keeping track of distance from the root.
- Float Errors: Care was taken to prevent unpredictable floating point errors when line segments start/end at "the same point".
