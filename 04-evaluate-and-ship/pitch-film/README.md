# KYC Onboarding Agent, Pitch Film

A 96-second animated pitch film for the KYC Onboarding Agent, built in Claude Design and exported
as a single self-contained HTML file. It plays in any modern browser (autoplay, with a scrubber and
play/pause).

## Watch it
Open **[`kyc-onboarding-agent-pitch-film.html`](kyc-onboarding-agent-pitch-film.html)** in a browser
(double click the file). Everything is inlined, so no server or build step is needed. Controls:
space to play/pause, left and right arrows to seek, 0 to restart.

## What it covers (8 scenes)
1. Cold open: "Most AI guesses. This one cites every decision."
2. Meet Omar, a newcomer at the door, and what onboarding demands today.
3. How the agent works: retrieve the policy, decide with citations, grade the answer.
4. Three real cases graded live: Omar (proceed), Layla (request documents), Sara (escalate).
5. The standout moment: the "Break it" toggle, and the trust layer catching a bad answer in real time.
6. Proven, not asserted: the discrimination test (3 of 3 caught) and the find, fix, verify loop.
7. One newcomer, one journey: this agent onboards, the credit copilot lends.
8. Close: cited, honest, defensible.

All data is synthetic. Acme Bank UAE is fictional.

## Source
The editable source lives in the Claude Design project "Capstone pitch deck":
- `kyc-scene.jsx` is the scene (the eight scenes above).
- `animations.jsx` is the timeline engine (Stage, Sprite, easings).
- The `.dc.html` mounts the scene on the engine.

This `kyc-onboarding-agent-pitch-film.html` is the shareable export of that project (the built output),
kept here so the film travels with the repo.
