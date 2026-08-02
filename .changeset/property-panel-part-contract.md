---
"@compose-ui/property-panel": minor
"@compose-ui/materials": patch
---

Publish a supported styling contract for the property panel's structural containers. Every
structural element now carries `data-property-part` (`toolbar`, `separator`, `fields`, `ungrouped`,
`field`, `label`, `editor`, `actions`, `control`) alongside the existing field-level
`data-property-*` attributes. Consumers that need to restyle the panel shell should target these
attributes; the `property-panel__*` BEM class names are implementation details and are documented as
such.

Migrates the Auto Layout inspector in `@compose-ui/materials` off those internal class names, and
adds a guard test so material stylesheets cannot reach into them again. Purely additive: no class
name changed, selector specificity is preserved, and no golden screenshot moved.
