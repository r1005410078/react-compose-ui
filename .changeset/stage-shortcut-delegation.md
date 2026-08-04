---
"@compose-ui/stage": minor
"@compose-ui/editor": minor
---

Let the host take over Stage shortcut actions so keyboard, toolbar, and command palette agree.

`ComposeStage` gains an optional `onShortcutAction`. When a configurable action matches, the Stage
asks the host first; returning `true` means the host executed it, so the Stage prevents the default
and skips its built-in path. Returning `false` — or omitting the prop entirely — keeps every existing
built-in behavior, so standalone Stage usage is unchanged. Press-and-hold temporary pan, Escape, and
arrow-key nudging never participate.

`@compose-ui/editor` splits its action catalog into a language-independent execution layer and a
localization layer on top, then feeds that one execution layer to both the command panel and the
Stage. This fixes a real divergence: "fit selection" previously used `min(w/target.w, h/target.h) *
0.85` from the keyboard but `min((w-128)/b.w, (h-128)/b.h)` from the toolbar, so the same action
produced two different viewports depending on how you invoked it. Group/ungroup unavailability
reasons are now bilingual as well; they previously came from `stage-engine` as Chinese-only strings.
