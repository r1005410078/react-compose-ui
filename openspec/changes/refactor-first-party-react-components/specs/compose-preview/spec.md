## MODIFIED Requirements
### Requirement: Preview 配置与兼容
ComposePreview MUST require a document and registry, render a complete document or explicit Frame target, and MUST
NOT offer a legacy children container mode.

#### Scenario: Required document configuration
- **WHEN** a consumer renders ComposePreview with a document, registry and optional target
- **THEN** it renders the requested output using the existing output and clipping rules
