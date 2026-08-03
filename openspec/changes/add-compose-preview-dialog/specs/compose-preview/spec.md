## ADDED Requirements

### Requirement: 受控 Preview Dialog

`@compose-ui/preview` MUST 提供受控 `ComposePreviewDialog`，接受与 `ComposePreview` 相同的文档、Registry、资源 Resolver 与页面加载端口，并由宿主通过 `open` 和关闭回调控制可见性。该组件不得依赖 Editor 或 Stage。

#### Scenario: 打开完整文档预览

- **WHEN** 宿主以 `open=true` 渲染带 document 与 registry 的 ComposePreviewDialog
- **THEN** 组件以模态对话框呈现完整文档预览
- **AND** 关闭控件、Esc 与遮罩操作请求宿主关闭对话框并恢复触发焦点

#### Scenario: 切换指定 Container 预览

- **WHEN** 宿主提供有效的 Container entity ID 并在对话框中选择该范围
- **THEN** 对话框使用该 ID 作为 ComposePreview 的 Container target
- **AND** 没有有效 Container 时该切换控件不可用

### Requirement: Preview Dialog 视图控制

ComposePreviewDialog MUST 提供不改变文档的预览缩放与全屏控制；缩放只影响对话框中的画板呈现，不能改变 ComposePreview 的输出语义。

#### Scenario: 调整预览缩放

- **WHEN** 用户选择一个支持的缩放比例
- **THEN** 画板在预览舞台中按该比例呈现
- **AND** document、target 与渲染内容不被修改
