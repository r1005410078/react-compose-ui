## ADDED Requirements

### Requirement: 文档可选动画清单

`ComposeDocument` MUST 支持可选的 `animations` 顶层字段，作为该文档的动画清单。清单每条
MUST 只包含稳定 `id`、用户可见 `name`、有限正数 `durationMs` 与 `playbackMode`，
MUST NOT 包含任何轨道或关键帧数据——那些存放在被动画 Entity 的 `Animation` Component 上。
该字段是向后兼容的加法扩展：缺省时等价于空清单，`schemaVersion` MUST 保持 `6`，
MUST NOT 引入迁移。`@compose-ui/core` MUST 提供归一化读取入口，使调用方不必各自处理 `undefined`。

#### Scenario: 老文档不含动画清单

- **WHEN** 校验一份没有 `animations` 字段的 `schemaVersion: 6` 文档
- **THEN** 校验通过
- **AND** 归一化读取入口返回空清单

#### Scenario: 新文档在动画清单上通过校验

- **WHEN** 校验一份含合法 `animations` 清单的文档
- **THEN** 校验通过且 `schemaVersion` 仍为 `6`

#### Scenario: 清单形状非法

- **WHEN** `animations` 不是数组
- **THEN** 校验失败并返回 `animation.invalid`，问题路径指向 `animations`

#### Scenario: 清单条目 ID 重复

- **WHEN** 清单中两条动画的 `id` 相同
- **THEN** 校验失败并返回 `animation.duplicate-id`

#### Scenario: 清单条目时长非法

- **WHEN** 某条动画的 `durationMs` 为零、负数或非有限数
- **THEN** 校验失败并返回 `animation.invalid-duration`

### Requirement: 动画播放控制绑定

清单条目 MUST 支持可选的 `bindings`，声明整条动画的播放控制到页面 setup 导出的绑定。
第一阶段 MUST 支持 `playing` 与 `currentTime` 两个目标，引用格式 MUST 复用既有的
`ComposePageExportReference`。绑定属于**整条动画**而非任何单个 Entity，因此 MUST 挂在清单条目上。
本需求只约束数据形状与校验，运行时语义由 `scene-animation` 之外的变更定义。

#### Scenario: 缺省无绑定

- **WHEN** 清单条目没有 `bindings` 字段
- **THEN** 校验通过，该动画不受任何脚本导出驱动

#### Scenario: 合法的播放绑定

- **WHEN** 某条动画的 `bindings.playing` 是 `{ scope: 'page', exportName: 'isReady' }`
- **THEN** 校验通过

#### Scenario: 绑定引用形状非法

- **WHEN** `bindings.playing` 的 `scope` 不是 `page`，或 `exportName` 是空字符串
- **THEN** 校验失败并返回 `animation.invalid-binding`
