## MODIFIED Requirements

### Requirement: 场景 Entity Preset

基础物料 MUST 注册一个 id 与 Frame Entity 的 `Composition.presetId` 一致的 Entity Preset，
使所有按 presetId 查询 Registry 的位置都能解析到它。该 Preset MUST 使用与 Container Preset
相同的图标与默认外观，但默认 Clip MUST 为不裁剪——场景是绝对坐标的原点与工作区里的
画板，内容越界默认可见，与「新建场景」命令及初始场景的行为一致；需要裁剪时由用户在
溢出属性里显式开启。Preset MUST 标记为面板隐藏——场景由绘制或具名动作产生，MUST NOT
出现在基础组件面板里供拖拽。

#### Scenario: 场景 Preset 可从 Registry 解析

- **WHEN** 宿主用 Frame Entity 的 `presetId` 查询 Registry
- **THEN** 返回场景 Preset，其图标与 Container Preset 相同且默认 Clip 为不裁剪

#### Scenario: 场景不出现在物料面板

- **WHEN** 基础组件面板列出可拖拽物料
- **THEN** 列表中不含场景，且列表内容不因新增该 Preset 而改变
