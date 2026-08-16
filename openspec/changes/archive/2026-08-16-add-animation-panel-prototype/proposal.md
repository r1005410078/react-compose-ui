# 变更：新增独立动画面板组件

## 原因

编辑器需要先落地与画布、文档解耦、但可实际操作的动画编辑组件，提供完整的本地时间线交互和
关键帧属性体验；后续再单独设计持久化动画协议。

## 变更内容

- 新增独立发布的 `@compose-ui/animation-panel` React 包。
- 提供可分置于底部与右侧的动画时间线、关键帧属性面板和共享受控/非受控会话 Provider。
- 严格按 `design/animation.png` 完成 300 ms、`Fault / 背景填充` 时间线、播放头、可拖动关键帧和曲线属性界面。
- 支持 Play once、Loop 与 PingPong 三种本地播放模式；选择或移动任意关键帧时右侧属性同步更新。
- 所有操作仅变更组件会话内存，**不**读取或写入 `ComposeDocument`、画布、Preview 或撤销历史。
- Editor 默认把动画面板作为底部工具区的“动画”标签挂载；激活时右侧属性区显示同一会话的关键帧属性。

## 影响

- 受影响规范：新增 `animation-panel`。
- 受影响代码：新增 `packages/animation-panel`，并由 `packages/editor` 作为纯 UI 宿主挂载。
