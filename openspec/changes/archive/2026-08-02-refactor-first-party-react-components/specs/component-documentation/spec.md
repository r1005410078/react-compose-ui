## ADDED Requirements
### Requirement: First-party component Storybook documentation
The repository MUST provide a private Vite Storybook workspace that discovers every public first-party visual
component's colocated story and renders it with Compose Theme/I18n providers and public package styles.

#### Scenario: Browse component states
- **WHEN** a developer starts Storybook
- **THEN** they can inspect Default and all applicable empty, loading, error, disabled, long-content or large-data
  states for every public visual component

### Requirement: Story browser and accessibility verification
Storybook stories MUST run in Playwright Chromium through the Storybook Vitest addon and MUST fail on Axe violations
unless a scenario documents an unavoidable manual check.

#### Scenario: Run Storybook tests
- **WHEN** the Storybook test command runs in CI
- **THEN** every discovered story renders in Chromium and automated accessibility violations fail the command
