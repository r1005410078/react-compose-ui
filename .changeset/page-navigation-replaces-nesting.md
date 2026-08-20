---
"@compose-ui/core": minor
"@compose-ui/pages": minor
"@compose-ui/script-runtime": minor
"@compose-ui/preview": minor
"@compose-ui/materials": minor
"@compose-ui/component-registry": minor
"@compose-ui/stage": minor
"@compose-ui/editor": minor
---

页面之间改为跳转关系，不再支持嵌套。

新增可选的 `Interaction` Entity Component（v1 只有 `click` trigger 与 `navigate` /
`navigate-back` 两种 action，可挂在任意 Entity 上），`core` 的 `ComposeNavigationPort`
协议、`pages` 的导航会话实现，以及 `preview` 的 `ComposePageHost`。页面脚本另有
`ctx.navigate` / `ctx.navigateBack` 作为条件跳转的逃生舱。编辑期不跳转：Stage 的命中
测试与手势完全不受 `Interaction` 影响。

**BREAKING**：删除 Page Slot 物料、Renderer、Preset 与资源拖入创建路径；删除 `core`
基于祖先页面链与深度上限的嵌套护栏（`COMPOSE_PAGE_NEST_DEPTH_LIMIT`、
`resolveComposePageNestState`、`ComposePageNestState`）。复用一块 UI 改用 Component
Asset v2 与 Variant。不提供迁移器——残留的 `page-slot` Entity 落到 Registry 既有的
「未知 Renderer」占位上，几何与外观保留。

**BREAKING**：删除只为 Page Slot 存在的 `pageDocumentPort` 渲染上下文端口，以及
`stage` 与 `editor` 的 `pageLoader` 选项。`preview` 的 `pageLoader` 保留，但只服务导航。

**BREAKING**：删除弃用别名 `ComposePageDocumentLoader` 与
`createComposePageDocumentLoader`，改用 `ComposePageLoader` / `createComposePageLoader`。
