# Tweet thread — How Poker Coach evolved

> NOT cleared for posting until you complete REVIEW-BEFORE-SHARING.md.

## Standalone tweet

My poker app told me "you don't have the price to continue" and I thought: who talks like that?

That one annoyed reaction did more to shape the product than any planning doc I wrote. Four versions in, the best briefs all came from just using the thing.

## Thread

1/ I built a little app to get better at poker — play hands against bots, get plain feedback on each decision. Then I used it for real, and that's when I actually learned what I was building. Four versions of notes on that.

2/ Day one, before any code, I made two calls that everything else had to live with: the coach runs offline (no live AI bill mid-hand), and it never peeks at the bots' cards to grade me. Boring decisions. They're also the ones I never had to revisit.

3/ Then I played it. Chips reset every hand, so winning felt like nothing. Showdowns didn't say who won. And the coaching talked like a solver — "you don't have the price to continue." I wrote my complaints down exactly as grumpy as I felt them and handed them over as the brief.

4/ Half that round was me being talked out of things. I wanted multi-table bankrolls with banks per table. The question "what do you actually need?" cut it to: one stack of money that doesn't vanish when you close the tab. Way better.

5/ My favorite moment had nothing to do with poker. The tooling announced my spec was "corrupt" and offered me recovery options. I ignored them and asked why. Nothing was corrupt — it had misread a glitch and overwritten a good file. Now I ask "why?" before I believe "broken."

6/ The next feature came from me not understanding my own app. I couldn't follow the equity math, so I had it explained to me, saved the explanation as a doc, then built the feature straight from that doc. Same file taught me, designed it, and became the test it has to pass.

7/ That feature also shipped completely broken and every test was green. It had quietly frozen on the first hand. Only opening it in a browser caught it. Reminder I keep relearning: "tests pass" and "it works" are different sentences.

8/ Newer stuff is smaller and comes straight from playing — "wait, how do both these players win this pot?" turns into a real fix. The app's at the stage where it gets better just by me using it, which is the whole thing I wanted.

9/ If there's a lesson, it's quiet: be a genuine user of your own work, and write down the friction in the actual words you used. "Who talks like that?" was a better spec than anything I'd have typed in planning mode. None of that is really about poker.
