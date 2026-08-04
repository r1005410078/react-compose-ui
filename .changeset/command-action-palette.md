---
"@compose-ui/command-panel": minor
"@compose-ui/editor": minor
---

Add command search and execution to the command panel, plus an editor action catalog that feeds it.

`@compose-ui/command-panel` gains a `ComposeCommandAction` protocol and an `actions` prop. The panel
renders a search input implementing the WAI-ARIA Combobox with List Autocomplete pattern: an empty
query keeps the existing debugger layout untouched, `/` lists every action grouped by category, and
plain text filters on title, category, keywords, and id. A leading `/` is an optional prefix rather
than a mode selector. Actions carrying a `disabledReason` render as unavailable and show that reason
instead of silently doing nothing. Hosts supply already-localized titles; the panel never rewrites
them and never registers action keybindings.

`@compose-ui/editor` assembles the 16 configurable editor actions into that catalog, reusing their
existing ids, bilingual labels, user-remappable keybindings, and scopes. Each action decides for
itself whether to dispatch a command or mutate session state, so viewport and tool actions become
searchable without polluting the transaction history — no change to the `EditorCommand` or
`TransactionRuntime` protocols. Press-and-hold temporary pan is excluded, and actions whose entry
point the host does not provide are omitted entirely rather than rendered as dead entries.
