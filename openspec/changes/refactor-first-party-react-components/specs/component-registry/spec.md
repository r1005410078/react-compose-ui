## ADDED Requirements
### Requirement: Compose-prefixed Registry React bridge
The component registry MUST expose compose-prefixed factory and renderer bridge names while preserving its headless
registry protocol and renderer error handling.

#### Scenario: Render registered component
- **WHEN** a consumer renders a registered component through the vNext bridge
- **THEN** renderer props, error boundaries and inspector dispatch retain their current semantics
