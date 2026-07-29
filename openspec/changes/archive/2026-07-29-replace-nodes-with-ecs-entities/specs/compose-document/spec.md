## RENAMED Requirements

- FROM: `### Requirement: 版本化 JSON 文档`
- TO: `### Requirement: 版本化 ECS JSON 文档`

- FROM: `### Requirement: 可序列化组件节点`
- TO: `### Requirement: 统一 Entity 与 PascalCase Components`

- FROM: `### Requirement: 节点变换与显示状态`
- TO: `### Requirement: Transform 与几何限制`

- FROM: `### Requirement: 规范化节点拓扑`
- TO: `### Requirement: ECS 层级拓扑`

- FROM: `### Requirement: 可选通用节点样式`
- TO: `### Requirement: Component 化外观和渲染数据`

## MODIFIED Requirements

### Requirement: 版本化 ECS JSON 文档

系统 MUST 在 `@compose-ui/core` 提供仅支持 `schemaVersion: 4` 的 ComposeDocument、严格 JSON
类型和无 React/DOM 的校验器。文档 MUST 保存 output、canvas、稳定 rootIds 与规范化 entities；
v3、旧 Node kind 和未知版本 MUST 被拒绝且不得自动迁移。

#### Scenario: 接受 v4 并拒绝 v3

- **WHEN** 宿主分别校验合法 v4 Entity 文档和 v3 Node 文档
- **THEN** 只有 v4 文档有效
- **AND** 失败结果包含稳定版本或字段问题

### Requirement: 统一 Entity 与 PascalCase Components

每个 ComposeEntity MUST 只保存稳定 id、name 和 JsonObject components。Component Key MUST 使用
PascalCase；系统 MUST 严格校验内建 Component，并保留未知合法 Component 的原始 JSON。

#### Scenario: 保存未知 Component

- **WHEN** Entity 包含当前宿主未注册但 Key 合法的 Component
- **THEN** Core 校验通过并原样保留其 JSON
- **AND** 运行时可用性留给 Registry 消费方处理

#### Scenario: 拒绝非法 Component Key

- **WHEN** components 包含 camelCase、全大写分隔符、空 Key 或非 JsonObject 值
- **THEN** 校验结果定位到对应 Component

### Requirement: Transform 与几何限制

Transform MUST 保存有限 position、正有限 size 和有限 rotation。TransformConstraints MAY 保存
movable、`free|preserve-aspect|horizontal|vertical|none` resize、rotatable、正有限 minSize 与
可选 maxSize；maxSize 不得小于 minSize。

#### Scenario: 保存独立几何限制

- **WHEN** Entity 设置水平 Resize、禁止旋转和有限尺寸区间
- **THEN** 文档校验通过并保持字段原值

#### Scenario: 拒绝非法尺寸限制

- **WHEN** Transform 或 TransformConstraints 包含非有限、非正、未知模式或逆向区间
- **THEN** 校验返回对应字段路径

### Requirement: ECS 层级拓扑

系统 MUST 使用隐式 Canvas 作为结构根，以 Hierarchy.childIds 表达唯一父子关系。每个 Entity
必须从 rootIds 恰好可达一次，不得存在缺失子项、重复父级、叶实体子项、孤儿或循环。

#### Scenario: 使用 Renderer 与 Hierarchy 组合树

- **WHEN** rootIds 包含纯 Renderer、纯 Container 和可渲染 Container
- **THEN** 文档校验通过并保留确定性场景顺序

#### Scenario: 拒绝非法 ECS 拓扑

- **WHEN** childIds 缺失、重复拥有父级、指向无 Hierarchy 的父级或形成循环
- **THEN** 校验器返回稳定 issue 和路径

### Requirement: Component 化外观和渲染数据

Appearance MUST 只保存背景、边框、圆角、透明度和结构化阴影；缺失时解析为透明默认值。
Renderer MUST 保存非空 type 与严格 JsonObject props，不得保存 React、Schema 或 factory。

#### Scenario: 解析明确或缺失 Appearance

- **WHEN** Entity 提供部分 Appearance 或完全省略 Appearance
- **THEN** 解析器分别合并给定值或返回透明默认外观
- **AND** 不依赖旧节点 kind

#### Scenario: 保存未知 Renderer

- **WHEN** Renderer.type 当前未注册但非空
- **THEN** Core 文档仍有效且 props 保持不变

### Requirement: 可持久化画布设置与辅助线

ComposeDocument v4 MUST 保存 grid、smartSnap 与全局世界坐标 guides。Grid stepX/stepY MUST 为有限
正数，offsetX/offsetY MUST 为有限数，primaryLineEvery MUST 为正整数；guide ID MUST 非空且唯一，
axis MUST 为 `x|y`，position MUST 为有限数。

#### Scenario: 创建默认画布设置

- **WHEN** 宿主调用 `createDefaultCanvasSettings`
- **THEN** 得到 8×8、零偏移、每 8 格主线且三类吸附开启的独立 JSON
- **AND** guides 初始为空且多次调用不共享可变对象

#### Scenario: 保存全局辅助线

- **WHEN** v4 文档包含位于正负世界坐标的合法水平和垂直辅助线
- **THEN** 校验保留 guide 顺序、ID、axis 与 position
- **AND** guides 不依赖任何 Container Entity 或 viewport

#### Scenario: 拒绝非法画布配置

- **WHEN** canvas 缺失、grid 数值非法、主线间隔不是正整数或 guide ID 重复
- **THEN** 校验返回稳定 issue code 和 canvas 字段 path
- **AND** 不返回经过静默修正的文档

### Requirement: 固定原点输出设置

ComposeDocument MUST 保存正有限 width/height 与非空 backgroundColor 的 output，并导出默认
`1280×720`、`transparent` 的 `createDefaultOutputSettings()`。输出原点 MUST 固定为世界
`(0,0)`；backgroundColor MUST 继续允许宿主配置其他非空 CSS 颜色字符串。

#### Scenario: 校验输出设置

- **WHEN** 宿主创建默认输出或提供合法自定义尺寸和背景
- **THEN** 文档校验通过且值可 JSON 往返
- **AND** 非正、非有限尺寸或空背景被拒绝

## ADDED Requirements

### Requirement: 场景 Entity 最小组合

每个 Entity MUST 拥有合法 Composition、Transform、Visibility 与 Lock，并 MUST 至少拥有 Renderer
或 Hierarchy。Renderer 与 Hierarchy MAY 同时存在；Clip MUST 依赖 Hierarchy，
TransformConstraints MUST 依赖 Transform。

#### Scenario: 可渲染容器

- **WHEN** Entity 同时拥有 Renderer 和带子项的 Hierarchy
- **THEN** 文档校验通过并保留两个 Components

#### Scenario: 拒绝不完整组合

- **WHEN** Entity 缺失基础 Component、同时缺少 Renderer/Hierarchy 或拥有无 Hierarchy 的 Clip
- **THEN** 校验器返回稳定组合问题和 Component 路径

### Requirement: Composition 归属数据

Composition MUST 保存非空或 null presetId、唯一合法 baseComponentKeys 与唯一 capabilityIds。
baseComponentKeys MUST 指向 Entity 当前存在的 Components，Composition 自身 MUST 始终受保护。

#### Scenario: 保存 Preset 和能力归属

- **WHEN** Entity 由 Preset 创建并添加能力
- **THEN** Composition 保留基础 Component Keys 和能力 ID
- **AND** JSON 往返不依赖运行时 Registry
