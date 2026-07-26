## MODIFIED Requirements

### Requirement: 版本化 JSON 文档

系统 MUST 在 `@compose-ui/core` 提供仅支持 `schemaVersion: 3` 的 ComposeDocument、严格 JSON
类型和无 React/DOM 的校验器。文档 MUST 保存 output、canvas、稳定 rootIds 与规范化 nodes；
v2、Group 和未知版本 MUST 被拒绝且不得自动迁移。

#### Scenario: 接受 v3 并拒绝旧版本

- **WHEN** 宿主分别校验合法 v3 文档、v2 文档和包含 Group 的候选文档
- **THEN** 只有 v3 Frame/Component 文档有效
- **AND** 失败结果包含稳定版本或节点字段问题

### Requirement: 规范化节点拓扑

系统 MUST 使用隐式 Canvas 作为结构根，允许 Frame 或 Component 出现在 rootIds。Frame MUST
可以递归包含 Frame/Component，Component MUST 保持叶节点；每个节点必须从 rootIds 恰好可达
一次且不得形成环。

#### Scenario: 使用任意根与嵌套 Frame

- **WHEN** rootIds 同时包含 Component 与 Frame，且 Frame 包含旋转 Frame 和 Component
- **THEN** 文档校验通过并保留确定性场景顺序
- **AND** `parentId: null` 可稳定表示任意根节点位置

#### Scenario: 拒绝非法拓扑

- **WHEN** childIds 缺失、重复拥有父级、指向 Component 后代或形成循环
- **THEN** 校验器返回对应稳定 issue 和路径

### Requirement: 节点变换与显示状态

每个节点 MUST 保存有限局部 transform、visible 与 locked。Frame 与 Component MUST 都允许有限
rotation，width/height MUST 为有限正数；Frame MUST 保存 boolean `clipContent`。

#### Scenario: 旋转并裁剪 Frame

- **WHEN** 根级或嵌套 Frame 使用有限 rotation 和任一 clipContent 值
- **THEN** 文档校验通过并保持字段原值

## ADDED Requirements

### Requirement: 固定原点输出设置

ComposeDocument MUST 保存正有限 width/height 与非空 backgroundColor 的 output，并导出默认
`1280×720`、`transparent` 的 `createDefaultOutputSettings()`。输出原点 MUST 固定为世界
`(0,0)`；backgroundColor MUST 继续允许宿主配置其他非空 CSS 颜色字符串。

#### Scenario: 校验输出设置

- **WHEN** 宿主创建默认输出或提供合法自定义尺寸和背景
- **THEN** 文档校验通过且值可 JSON 往返
- **AND** 非正、非有限尺寸或空背景被拒绝
