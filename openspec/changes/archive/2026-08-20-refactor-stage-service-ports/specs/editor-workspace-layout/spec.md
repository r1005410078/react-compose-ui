## ADDED Requirements

### Requirement: Editor Stage 属性显式组合

ComposeEditor MUST 通过显式属性组合把宿主覆盖合并到 controller 计算的 Stage 属性上，
MUST NOT 使用 `cloneElement` 向 Stage 元素克隆注入。覆盖优先级 MUST 由组合函数签名与类型
表达，MUST NOT 依赖注释约定。宿主直接渲染 `controller.stage` 元素的既有用法 MUST 保持可用。

编辑器模式（如动画模式）MUST 通过组装一个 `policy` 表达其画布语义，MUST NOT 以逐项条件
spread 平铺布尔的方式注入。

#### Scenario: 宿主覆盖优先于 controller 默认值

- **WHEN** controller 计算出的 Stage 属性与宿主覆盖同时提供 `assetResolver`
- **THEN** 生效值为宿主覆盖
- **AND** 该优先级由类型检查保证，而非运行时约定

#### Scenario: 动画模式组装 policy

- **WHEN** 编辑器进入动画模式
- **THEN** Stage 收到的 `policy.lockGestureParent` 为 true
- **AND** 退出动画模式后该项恢复缺省，画布跨父级挂载行为与既有一致

#### Scenario: 直接渲染 controller.stage

- **WHEN** 宿主不使用默认工作区而直接渲染 `controller.stage`
- **THEN** Stage 正常渲染并保持既有行为

## MODIFIED Requirements

### Requirement: Editor 资源拖入桥接

默认 Editor MUST 把 Asset Browser Canvas drag 事件映射到当前 controller，并把显式
assetResolver 或默认 Provider resolver 经 `services` 注入 Stage；显式 resolver 优先。

#### Scenario: 默认资源面板拖入当前 Stage

- **WHEN** 一个 Editor 的默认 Asset Browser 发出拖拽事件
- **THEN** 只有该 Editor 的 interactionController 收到事件
- **AND** 宿主 onCanvasDrag 回调仍被调用
