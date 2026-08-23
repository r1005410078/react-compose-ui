## ADDED Requirements

### Requirement: 组件提取搬运动画清单

`createComponentExtractionPlan` MUST 把源文档中**至少有一条轨道落在被提取实体上**的动画清单
条目复制到新组件根的 `Animations.items` 上。清单条目的 `id` MUST 逐字保留——轨道按动画 id
分组（`Animation.clips[animationId]`），换 id 会让刚提取出来的轨道全部变成悬空分组，而这不会
被任何校验拒绝，只表现为时间线上什么都不动。

提取器 MUST 复制而不是搬运：源文档的清单条目 MUST 原样留下，源文档 MUST NOT 被修改。
与被提取实体无关的动画 MUST NOT 出现在组件文档里。

复制的条目 MUST 丢弃 `bindings`；组件根的 `Animations.source` MUST 缺席。

提取器 MUST NOT 通过修改 `promoteComposeEntityToFrame` 实现本要求——升格只做一件事，
它还有别的调用方，那些调用方没有源清单可搬。

#### Scenario: 动画 id 与轨道分组键一致

- **WHEN** 用户把一个带旋转关键帧的容器创建为组件
- **THEN** 组件根 `Animations.items` 中该条目的 id 等于其子级 `Animation.clips` 的键
- **AND** 关键帧的时间、值、插值与空间切线逐字段不变

#### Scenario: 部分选区不破坏留下的轨道

- **WHEN** 一条动画同时给 A 与 B 打了关键帧，用户只把 A 创建为组件
- **THEN** 组件里的这条动画只含 A 的轨道
- **AND** 源文档的清单条目仍在，B 的轨道未被修改

#### Scenario: 无关动画不进组件

- **WHEN** 页面上另有一条只给未被提取的实体打点的动画
- **THEN** 该动画不出现在组件文档的清单里

#### Scenario: 不携带文件引用与页面绑定

- **WHEN** 源 Frame 的 `Animations` 带有 `source`，且被复制的动画带有 `bindings`
- **THEN** 组件根的 `Animations` 不含 `source`，被复制的条目不含 `bindings`
