## MODIFIED Requirements

### Requirement: Preview 配置与兼容
ComposePreview MUST require a document, a registry and a Frame target, and MUST render exactly one Frame.
When no target is given it MUST render the page's active Frame, falling back to the first root Frame.
The `defaultFrameId` prop MUST stay a pure fallback: it seeds the candidate list only, and an explicitly
supplied `frameId` MUST NOT fall back to it. Hosts typically pass `ComposePageFile.activeFrameId` as
`defaultFrameId`.
ComposePreview MUST accept optional `fit` (`contain | cover | fill | none`) and `alignment` props that
control how the Frame is mapped into the host box; these MUST NOT be read from or written to the document.
ComposePreview MUST NOT offer a legacy children container mode and MUST NOT keep a separate
whole-document rendering path.

#### Scenario: Required document configuration
- **WHEN** a consumer renders ComposePreview with a document, registry and optional Frame target
- **THEN** it renders that single Frame using the Frame's own size, background paint and clipping rules
- **AND** omitting the target renders the default root Frame

#### Scenario: Host-supplied fit
- **WHEN** a consumer renders the same document with `fit="contain"` and again with `fit="cover"`
- **THEN** the Frame is scaled to fit inside the host box in the first case and to cover it in the second
- **AND** the document is byte-identical in both cases

### Requirement: 受控 Preview Dialog

`@compose-ui/preview` MUST 提供受控 `ComposePreviewDialog`，接受与 `ComposePreview` 相同的文档、Registry、资源 Resolver 与页面加载端口，并由宿主通过 `open` 和关闭回调控制可见性。该组件不得依赖 Editor 或 Stage。对话框 MUST 以**场景选择器**表达预览目标：列出文档中的全部根 Frame，默认选中宿主给出的激活场景；预览目标任何时刻 MUST 恰好是一个 Frame。对话框 MUST NOT 再提供「完整文档 / 指定 Container」的二选一，也 MUST NOT 在解析目标时绕过宿主给出的默认值直接取第一个根 Frame；动画播放宿主 MUST 跟随当前解析出的目标 Frame。

#### Scenario: 打开完整文档预览

- **WHEN** 宿主以 `open=true` 渲染带 document 与 registry 的 ComposePreviewDialog
- **THEN** 组件以模态对话框呈现激活场景的预览
- **AND** 关闭控件、Esc 与遮罩操作请求宿主关闭对话框并恢复触发焦点

#### Scenario: 切换指定 Container 预览

- **WHEN** 用户在场景选择器中选择另一个根 Frame
- **THEN** 对话框以该 Frame 作为 ComposePreview 的目标
- **AND** 动画播放控制随之切换到该 Frame 的动画清单

#### Scenario: 默认目标来自激活场景

- **WHEN** 宿主传入的激活场景不是文档的第一个根 Frame
- **THEN** 对话框打开时选中的是激活场景而不是第一个根 Frame
