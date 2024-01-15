---
layout: post
title: "Transfinite Meta-Posting - Part 1"
tags: [Ordinal, Meta]
author: "Alexander Varga"
excerpt_separator: <!--more-->
---

In the beginning, I wrote blog posts.

Once I ran out of ideas, I started to write blog posts about my experience writing blog posts. These were my first meta-posts.

As my ego inflated ever larger, I began to post about my meta-posts.

…

<!--more-->

It wasn’t long until I realized that I had discovered an endless trove of Content. I became the worlds most efficient content creator, each day reflecting on and posting about the creative process behind the previous day’s work. I was now a multi-stage poster.

But it wasn’t long before other bloggers started to rip off my process. Their original posts may have been unique, but after a few days of iterated reflection stages their content was nearly indistinguishable from my own. I needed to stand out from these other multi-stage posters, so I wrote a new kind of reflective post.

In that blog post I explained my infinite content creation process, and how I could have continued forever. This post wasn’t like those that came before it. It was about the infinite iteration itself, rather than being just another step in that iteration. It pushed the limit of content creation to entirely new levels. But this is not that blog post.

The next day, I returned to my tried and true method of reflecting on the previous day. I detailed that limit-pushing post in all its glory, much as I have above.

The next day I reflected again. And the next day. And the next.

…

And then I reflected on this second infinite iteration.

etc.

### Now Do Programming

That was exhausting, thanks for sticking with me. But the moral of the story is:
>  The semantics of natural language are closed under reflection and limits.

That is to say, for any topic we can talk about: we can talk about talking about it, and we can talk about infinitely iterating processes of reflection.

Such conversations aren’t very useful, but we *can* have them, and it’s *efficient* to do so. In particular, I can easily talk about talking without referring to the raw letters or phonemes from which conversation itself is built. So I tried to define a *formal* language with this property, and I think I’ve found one.

The area of multi-stage programming which I punned at above starts this process. It presents infinite reflective towers of languages, each hosting the stage below it. At the bottom of the tower is a ground stage behaving like a normal programming language, which is analogous to the “normal” blog posts in the story above. MSP languages manage to do this efficiently without each stage needing to encode the syntax of the stage below it in it’s own syntax. To see how this nested representation might grow exponentially with the number of stages if we’re not careful, consider the Python program:

![](https://cdn-images-1.medium.com/max/5024/1*AVdZzA2lMTkWs5_gyItmsw.png)

The third line of output is an encoding of an encoding of an encoding of the number 2, and is over 2500 characters long. Multi-stage programming circumvents this explosion by introducing a concept of quotation, inspired by natural language. For example, I can say that the first word of this sentence is “For” rather than saying that it is formed by joining the sixth, fifteenth, and eighteenth letters of the English alphabet.

What multi-stage programming has that natural language doesn’t (but should) is a notion of splicing/unquoting. In spoken language this ends up looking like “I was walking in the park and ran into {oh what’s his name? your friend whose name starts with an “S”} and he says “Hello”.” That sentence contains a nested quote for the greeting, and we could nest quotes arbitrarily deeply if we wanted: “I said “I said “I said “Hello””””. However, it also contains a splice in curly brackets. The idea is to resolve the contents of the brackets to a syntactic object like a name and splice it into the surrounding sentence. Depending on context, the above meta-sentence might resolve to “I was walking in the park and ran into Steve and he says “Hello”.”

Maybe you recognize this as f-strings or template strings in Python or JavaScript. If so, try not to get too hung up on the presence of strings in my examples. Strings are natural and easy to write down, but the concepts I’m getting at are more general and relate broadly to the relationships between syntax like strings, blog posts, or syntax trees and their semantics.

Now we run into a problem. How do we actually talk about splices themselves? If we were to try to say something like “I claim that {the color of the sky} is different than {the color of the ocean}”, this would resolve to “I claim that blue is different than blue” which isn’t so. We failed to properly quote the splice, and it interacted with the quote. We’re gonna need a bigger quote.

This same problem arises in multi-stage programming. Partial evaluation is a technique to turn a 1-stage program into a multi-stage program by carefully inserting quotes and splices. But at which stage does the partial evaluator live? What type might we assign it? How can it possibly output splices without interacting with them? The same questions apply for programs that interpret multi-stage programs. These programs exist “above” all of the stages in traditional MSP.

### Bigger Quotes

We might start towards a solution to the above problem by introducing big quotes as, say, square brackets like: “I claim that [{the color of the sky}] is different than [{the color of the ocean}]”. The big quotes tell us not to resolve their contents. This might be sufficient for our needs, but once we consider big splices, we’ll run into the same problem, and so we’ll need ever larger quotes.

If you can’t tell from my previous blog posts, I like ordinals, and that’s what we need here. In order to discuss a quote that contains splices, without resolving those splices, you need a different kind of quote. We end up wanting a different size quote for each ordinal. This could be implemented directly, but I’ll cut to the real punchline:
>  We can accomplish transfinite meta-programming by starting with a language using DeBruijn indices and extending the domain of indices to larger ordinals.

In the next post, I’ll explain how extend a simple Lambda Calculus-like language in this way. For some vague intuition:

* A DeBruijn index of ω corresponds to a splice.

* An index of ω+n corresponds to a splice containing an index of n into the meta-language.

* An index of n+ω indexes into the current language by n but then splices to the meta-language anyways, so ends up equivalent to an index of n+ω = ω, or a normal splice.

* With indices up to ω² we can do all of multi-stage programming.

As an additional teaser, here is a trace of an unstaging function written in my language to prove that it works: [https://github.com/asvarga/wiki/blob/main/other/Trace.tfdbi](https://github.com/asvarga/wiki/blob/main/other/Trace.tfdbi). Yes, it uses the transfinite lists data structure from my last post :)
