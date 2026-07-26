## ADDED Requirements
### Requirement: Feature-local Property Panel implementation
The Property Panel MUST separate schema model, recursive groups, fields, bindings and view parts into feature-local
modules without changing Schema validation or binding semantics.

#### Scenario: Property mutation after decomposition
- **WHEN** a user edits a nested or bound property
- **THEN** the panel emits the same validated change result and preserves keyboard and focus behaviour
