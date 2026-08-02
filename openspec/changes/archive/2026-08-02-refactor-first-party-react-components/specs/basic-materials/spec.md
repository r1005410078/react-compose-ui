## ADDED Requirements
### Requirement: Feature-local basic materials
Basic materials MUST retain a separate feature directory for each material and a purpose-named shared inspector kit;
their public factories and definitions MUST use compose-prefixed names.

#### Scenario: Render material definition
- **WHEN** a host registers a vNext basic material definition
- **THEN** Frame, Rectangle, Text, Image and SVG rendering and inspector behaviour remain unchanged
