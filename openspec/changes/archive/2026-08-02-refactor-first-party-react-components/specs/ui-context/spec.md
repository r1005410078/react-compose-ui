## MODIFIED Requirements
### Requirement: 共享 UI Context 包
The UI Context package MUST expose only compose-prefixed providers, hooks and types, and first-party UI MUST use
that Context rather than per-component locale compatibility props.

#### Scenario: Context-only localization
- **WHEN** an independently rendered first-party component needs a locale
- **THEN** it resolves language through `ComposeI18nProvider` or its inherited default and has no locale prop
