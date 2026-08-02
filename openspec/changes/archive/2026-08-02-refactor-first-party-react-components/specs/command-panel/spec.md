## ADDED Requirements
### Requirement: Compose-prefixed Command Panel API
The command panel package MUST expose a compose-prefixed panel and contracts while keeping command validation and
runtime dispatch semantics unchanged.

#### Scenario: Submit a preset
- **WHEN** a user submits a valid command preset in the vNext panel
- **THEN** exactly the same structured command is sent to the dispatch boundary
