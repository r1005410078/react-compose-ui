## ADDED Requirements

### Requirement: Editor 资源拖入桥接

默认 Editor MUST 把 Asset Browser Canvas drag 事件映射到当前 controller，并把显式
assetResolver 或默认 Provider resolver 注入 Stage；显式 resolver 优先。

#### Scenario: 默认资源面板拖入当前 Stage

- **WHEN** 一个 Editor 的默认 Asset Browser 发出拖拽事件
- **THEN** 只有该 Editor 的 interactionController 收到事件
- **AND** 宿主 onCanvasDrag 回调仍被调用
