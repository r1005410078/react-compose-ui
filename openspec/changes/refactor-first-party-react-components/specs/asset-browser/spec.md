## MODIFIED Requirements
### Requirement: Editor 资源面板
The asset browser package MUST export compose-prefixed UI contracts only and MUST NOT re-export asset Provider,
resolver, reference or protocol types owned by `@compose-ui/assets`.

#### Scenario: Canonical resource protocol import
- **WHEN** a consumer configures a ComposeAssetBrowser provider or resolver
- **THEN** it imports those protocol types and factories from `@compose-ui/assets`
