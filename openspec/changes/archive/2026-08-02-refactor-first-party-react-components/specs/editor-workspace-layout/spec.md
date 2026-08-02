## ADDED Requirements
### Requirement: VNext Editor composition API
ComposeEditor MUST replace flat panel, toolbar and children overrides with compose-prefixed `slots`, scene tree,
history and assets configuration; it MUST not retain legacy aliases.

#### Scenario: Slot overrides default workspace content
- **WHEN** a consumer provides an editor slot
- **THEN** that slot replaces only its matching default workspace content and the rest of the workspace remains intact
