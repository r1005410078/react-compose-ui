---
"@compose-ui/property-panel": minor
"@compose-ui/component-registry": minor
"@compose-ui/asset-browser": minor
"@compose-ui/materials": minor
"@compose-ui/pages": minor
"@compose-ui/core": minor
"@compose-ui/editor": minor
"@compose-ui/preview": minor
---

Add the `node` base property editor so a property can reference a page: pick from a filterable
candidate list or drop a page from the asset browser. Referenced pages render live on the editing
canvas and in preview through the new `page-slot` material, which owns the loading state machine
so neither Stage nor Preview needs its own. Adds a stable asset reference drag payload, the
`nodeEditPort` / `pageDocumentPort` registry ports, and `createComposePageDocumentLoader`.
