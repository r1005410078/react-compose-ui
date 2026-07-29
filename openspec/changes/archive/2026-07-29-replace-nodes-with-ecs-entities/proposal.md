# 变更：以 ECS Entity/Component 重构文档节点

## 原因

当前 ComposeDocument 通过 Frame/Component 联合类型和 ComposeNodeBase 继承固定节点能力，
Transform、Visibility、Lock、Appearance、Hierarchy 与 Renderer 语义被平铺或绑定到 kind。
这使容器与可渲染组件无法自由组合，也无法在不扩展节点联合类型的情况下新增点击、动画等能力。

## 变更内容

- **BREAKING**：ComposeDocument 升级到仅支持 schemaVersion 4，以 entities 和 PascalCase
  Components 替换 nodes、Frame/Component 联合类型及全部继承结构。
- 新增内建 Composition、Transform、TransformConstraints、Visibility、Lock、Hierarchy、Clip、
  Appearance 与 Renderer Components，并严格校验组合和拓扑。
- 用 ComposeEntityRegistry 统一 Renderer、Component、Entity Preset 与 Capability 注册。
- 将现有节点命令、Stage Engine、Stage、Materials、Preview、Inspector、Editor 和调试面板迁移到
  Entity/Component 语义。
- Inspector 使用单 Property Panel 聚合可折叠 Component 分组，并新增能力添加与确认移除；
  首批支持“容器”和“几何限制”。
- v3 文档、旧 Node/Frame 公共类型和命令被直接移除，不提供迁移器或兼容运行路径。

## 影响

- 受影响规范：compose-document、command-transaction、component-registry、stage-engine、stage、
  basic-materials、compose-preview、property-panel、editor-workspace-layout、editor-preferences、
  command-panel
- 受影响代码：core、component-registry、stage-engine、stage、materials、preview、editor、
  scene-tree adapter、command-panel、app、Storybook 与 E2E
- 非目标：页面系统、Instance、Interaction、Animation、结构变体和数据绑定
