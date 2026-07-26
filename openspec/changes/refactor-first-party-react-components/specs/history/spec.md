## ADDED Requirements
### Requirement: Compose-prefixed History API
The history package MUST expose compose-prefixed panel, hook and controller contracts and colocate their
implementation, test and Storybook story.

#### Scenario: History navigation
- **WHEN** a consumer navigates immutable history through the vNext hook and panel
- **THEN** undo, redo, reset and shortcut behaviour remain unchanged
