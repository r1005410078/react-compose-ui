## ADDED Requirements

### Requirement: 世界坐标轴显示是编辑器偏好

`ComposeEditorPreferences` MUST 包含 `showWorldAxes: boolean`，默认 `true`。规范化时字段缺席
或不是布尔 MUST 回落 `true`，MUST NOT 让整份偏好无效。

它 MUST 是用户偏好而不是工作区会话开关：三个内建工作区的画布表现刚刚被统一过，再加一个按
工作区分叉的开关会重演同一个困惑。它 MUST NOT 写文档、MUST NOT 进撤销历史。

编辑器 MUST 把它经 `ComposeStagePolicy.worldAxes` 交给 Stage。设置对话框的「画布」分类 MUST
含「世界坐标轴」一节，并 MUST 说明该开关同时管两条轴线与原点标记——只写「坐标轴」会让用户
以为原点标记还留着。搜索 MUST 能以「坐标轴」「原点」命中这一节。

#### Scenario: 默认显示

- **WHEN** 宿主不提供受控 preferences 并挂载 ComposeEditor
- **THEN** `showWorldAxes` 为 `true`，画布上有坐标轴与原点标记

#### Scenario: 旧偏好缺这一段

- **WHEN** 宿主回传的 preferences 没有 `showWorldAxes`，或它的值不是布尔
- **THEN** 规范化后为 `true`，不报错

#### Scenario: 在设置里关掉

- **WHEN** 用户在设置 › 画布 里取消勾选「世界坐标轴」
- **THEN** onPreferencesChange 收到 `showWorldAxes: false` 的完整规范化偏好
- **AND** 画布上两条轴线与原点标记都不再绘制
- **AND** 网格照常绘制
