---
layout: post
title: "Function with 4-Fold Symmetry"
date: 2026-05-02
tags: [Puzzle, Math]
categories: [Puzzle, Math]
authors: [me]
hide: [toc]
---

**Puzzle**: Find a function $f: \R \rarr \R$ with 4-fold rotational symmetry.

<!-- more -->

- $f$ must be a total function
- When you rotate the graph of the function, it should appear unchanged: 
    - $f(x) = y \lrArr f(y) = -x \lrArr f(-x) = -y \lrArr f(-y) = x$

<details>
  <summary>Solution</summary>
  There are many solutions, but here's a nice animated family of them. Click the bottom right to view+edit.
  <iframe src="https://www.desmos.com/calculator/e75b3c7808?embed" width="500" height="500" style="border: 1px solid #ccc" frameborder=0></iframe>
  $$
    y = \begin{cases}
      0            & x = 0                                             \\
      x \cdot c    & \lfloor\log_{c}\lvert x\rvert\rfloor < 1 \pmod{2} \\
      \frac{-x}{c} & \text{otherwise}                                  \\
    \end{cases}
  $$
</details>