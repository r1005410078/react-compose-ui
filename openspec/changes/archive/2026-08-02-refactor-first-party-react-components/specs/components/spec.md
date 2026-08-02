## MODIFIED Requirements
### Requirement: 通用受控虚拟 Tree
`@compose-ui/components` MUST export compose-prefixed, domain-free React interaction patterns only. Each public
visual pattern MUST live in a feature directory with colocated type, model, style, test and Storybook story.

#### Scenario: Tree public pattern
- **WHEN** a consumer imports the shared tree pattern
- **THEN** it imports `ComposeTree` and `ComposeTreeProps` from the package root and receives the existing
  controlled selection, expansion, keyboard and ARIA behaviour

#### Scenario: Domain-free boundary
- **WHEN** a new shared component is proposed
- **THEN** it is rejected unless it has no ComposeDocument, asset Provider, transaction or editor workflow semantics
