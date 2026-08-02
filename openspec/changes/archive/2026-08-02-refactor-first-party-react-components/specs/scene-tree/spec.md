## MODIFIED Requirements
### Requirement: 独立受控场景树包
The scene tree package MUST export `ComposeSceneTree` and compose-prefixed contracts, compose the shared
`ComposeTree`, and no longer accept an explicit locale prop.

#### Scenario: Scene tree after vNext import
- **WHEN** a consumer uses the vNext scene tree
- **THEN** selection, move commands, keyboard navigation, visibility and locking retain their current behaviour
