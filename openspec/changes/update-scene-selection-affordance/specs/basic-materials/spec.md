## MODIFIED Requirements

### Requirement: 场景 Entity Preset

基础物料 MUST 注册一个 id 与 Frame Entity 的 `Composition.presetId` 一致的 Entity Preset，
使所有按 presetId 查询 Registry 的位置都能解析到它。该 Preset MUST 使用与 Container Preset
相同的图标，但默认外观 MUST 取自 core 的场景默认外观（透明背景、无边框）而不是 Container
Preset 的默认外观——场景背景是会被发布出去的真实像素，由用户决定；默认 Clip MUST 为不裁剪
——场景是绝对坐标的原点与工作区里的画板，内容越界默认可见，与「新建场景」命令及初始场景的
行为一致；需要裁剪时由用户在溢出属性里显式开启。Preset MUST 标记为面板隐藏——场景由绘制或
具名动作产生，MUST NOT 出现在基础组件面板里供拖拽。

#### Scenario: 场景 Preset 可从 Registry 解析

- **WHEN** 宿主用 Frame Entity 的 `presetId` 查询 Registry
- **THEN** 返回场景 Preset，其图标与 Container Preset 相同且默认 Clip 为不裁剪

#### Scenario: 场景 Preset 背景透明而容器不透明

- **WHEN** 分别用场景 Preset 与 Container Preset 创建 Entity
- **THEN** 场景的 `Appearance.backgroundPaint` 是透明的，容器的仍是深色

#### Scenario: 场景不出现在物料面板

- **WHEN** 基础组件面板列出可拖拽物料
- **THEN** 列表中不含场景，且列表内容不因新增该 Preset 而改变
