## MODIFIED Requirements
### Requirement: DOM Scene 与 SVG Overlay 分层
The Stage package MUST export `ComposeStage`, compose-prefixed supporting types and `ComposeComponentPalette` from
its root while keeping coordinate, snapping and command planning in stage-engine.

#### Scenario: Stage structure refactor
- **WHEN** the Stage implementation is reorganized
- **THEN** its user-visible grid, rulers, overlays, pointer behaviour, ARIA and stable test IDs remain unchanged
