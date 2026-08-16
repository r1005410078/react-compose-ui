# 变更：新增 Compose Preview Dialog

## 原因

示例应用当前自行组合预览遮罩、对话框 chrome、目标切换、缩放和全屏控制，导致预览体验无法被其他宿主复用。

## 变更内容

- 在 `@compose-ui/preview` 提供受控 `ComposePreviewDialog` 公共组件。
- 组件复用既有 `ComposePreview` 输出协议，并提供文档/指定 Container 切换、缩放、全屏和关闭交互。
- 示例应用改为通过 `@compose-ui/preview` 公共入口使用该组件，删除本地预览弹框实现与样式。

## 影响

- 受影响规范：`compose-preview`
- 受影响代码：`packages/preview` 公共入口与 `app/` 示例集成
