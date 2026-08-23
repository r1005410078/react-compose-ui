## ADDED Requirements

### Requirement: 组件实例的动画播放头

`component-instance` Renderer MUST 声明两条可绑定的 value Prop Contract：`animation`
（组件根 Frame 动画清单中的动画 id，允许 `null`）与 `animationTime`（播放头毫秒）。
Renderer MUST 在解析完实例覆盖之后、把文档交给嵌套 Layout Runtime 之前，按这两个值对嵌套
文档采样一次；采样结果 MUST NOT 被写回文档、覆盖或任何持久化位置。

`animationTime` MUST 被钳制到所选动画的 `[0, durationMs]`。`animation` 缺席或为 `null` 时
MUST NOT 采样，且 MUST NOT 回退到清单中的第一条动画。`animation` 指向清单中不存在的 id 时
MUST NOT 采样，MUST 保留该值不被静默清空，且 Inspector MUST 把它呈现为失效——「还没配」与
「配错了」必须可区分。

Renderer MUST 提供 Inspector，用组件根 Frame 清单构建动画下拉，并让两条 Prop 都可通过既有
Renderer 绑定入口绑定到页面导出。采样在 `editor` 与 `preview` 两种模式下 MUST 行为一致。

#### Scenario: 播放头驱动实例内部姿态

- **WHEN** 实例引用的组件含一条旋转动画，`animation` 选中它且 `animationTime` 从 0 改到轨道终点
- **THEN** 实例内部对应 Entity 的呈现按该时刻的采样值变化
- **AND** 实例覆盖与组件源均未被修改

#### Scenario: 未选择动画时逐像素不变

- **WHEN** 实例的 `animation` 缺席
- **THEN** 嵌套文档不被采样，渲染结果与不带这两个 Prop 时逐像素相同
- **AND** 不因此触发一次多余的嵌套布局重解

#### Scenario: 失效动画 id 可判别

- **WHEN** 实例的 `animation` 指向组件清单中已不存在的 id
- **THEN** 实例不采样且保留该值
- **AND** Inspector 把该项呈现为失效，而不是显示为「未选择」

#### Scenario: 播放头超出时长被钳制

- **WHEN** 绑定的导出给出大于动画时长的毫秒值或负值
- **THEN** 实例按 `[0, durationMs]` 内的端点采样
- **AND** 不产生错误状态

#### Scenario: 编辑期与预览一致

- **WHEN** 同一实例在 Stage（`editor`）与 Preview（`preview`）中以相同绑定值渲染
- **THEN** 两处呈现同一时刻的姿态
