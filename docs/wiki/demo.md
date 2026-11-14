---
title: Demo
tags: [Test]
---



```py title="foo.py" linenums="1" hl_lines="2"
def foo():
    return 123
```

``` mermaid
graph LR
  A[Start] --> B{Error?};
  B -->|Yes| C[Hmm...];
  C --> D[Debug];
  D --> B;
  B ---->|No| E[Yay!];
```

Inline: $\omega^2$

Block: 

$$\omega^\omega$$
