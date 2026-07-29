## 上下文

ComposeDocument v3 的所有节点都继承 ComposeNodeBase。Stage 只要看到未锁定且可见的 transform
就赋予 move、resize 和 rotate；Registry 则把默认尺寸、style、props、Renderer 和 Inspector
绑定在单个 ComponentDefinition 上。数据已经隐含“System 操作 Component”的模式，但协议仍由
kind 和继承限制。

## 目标/非目标

- 目标：建立单一 Entity/Component 文档模型，保持当前编辑、渲染、历史和资源纵向流程。
- 目标：让 Renderer 与 Hierarchy 可共存，并允许注册能力包原子增删 Components。
- 目标：用独立 TransformConstraints 控制 Stage 几何编辑。
- 非目标：实现页面、可复用 Definition/Instance、运行时交互、动画、变体或数据绑定。

## 决策

### 文档与组合约束

- ComposeDocument v4 使用 `entities`，每个 ComposeEntity 只保存 id、name 和 components。
- Component Key 必须匹配 `^[A-Z][A-Za-z0-9]*$`；未知合法 JsonObject 原样保留。
- 每个场景 Entity 必须有 Composition、Transform、Visibility、Lock，并至少有 Renderer 或
  Hierarchy。Clip 依赖 Hierarchy；Renderer 与 Hierarchy 可以同时存在。
- Composition 保存 presetId、baseComponentKeys 和 capabilityIds。它是内部 Authoring Component，
  不在普通 Inspector 中显示。
- Hierarchy.childIds 是唯一父子关系来源；rootIds 继续保存顶层顺序。

### 几何规则

- Transform 保存 position、size 与 rotation；TransformConstraints 独立保存 movable、resizable
  模式、rotatable、minSize 与 maxSize。
- TransformConstraints 缺失时默认允许全部变换、最小 1×1、无最大值。
- Resize 模式为 free、preserve-aspect、horizontal、vertical 或 none。Stage 根据模式显示
  八向、四角、水平、垂直或零个手柄。
- Stage 编辑变换与未来 Preview 用户交互是不同 System；本变更不实现后者。

### Registry 与能力归属

- ComposeEntityRegistry 分别注册 Renderer、Component、Entity Preset 与 Capability。
- Preset 创建时生成 Composition，初始 Component Keys 成为不可由能力面板移除的基础项。
- Capability 拥有的 Component Keys 在同一 Registry 内不得重叠；依赖不得循环，冲突项不会自动替换。
- 添加能力递归补齐依赖并形成一个 batch。移除存在依赖方、缺失定义、基础项或含子项 Container
  时被阻止，不级联删除。
- Core 只严格理解内建 Components；Registry 负责宿主 Component 的额外校验和降级 UI。

### 渲染与属性聚合

- Entity Preset 替代 Frame Preset 与 Component seed。Container 和所有基础物料走同一 Palette。
- Stage/Preview 先渲染 Renderer，再递归 Hierarchy 子项，Appearance 和 Clip 由独立 Component 控制。
- Inspector 通过一个 Property Panel Root 固定渲染 Identity，再按 Registry 顺序渲染独立校验和提交的
  Component Sections 与 Renderer 内容区；所有 Section 共享搜索、筛选、显示设置和列宽状态。
- Section 默认展开且可折叠，搜索时临时展开匹配组；顶部能力入口不参与属性搜索。锁定 Entity
  时仅 Lock 可编辑。

## 风险/权衡

- 这是跨包破坏性变更，现有 v3 JSON 无法读取。通过一次性切换所有第一方包和完整 E2E 降低双路径风险。
- Composition 含有可推导的 Authoring 元数据，但它使缺失 Registry 时仍能保护数据和能力归属。
- 场景 Entity 采用最小组合约束，不支持任意空 Entity；非空间 ECS Entity 留给未来独立协议。

## 迁移计划

1. 建立 v4 类型、校验、访问器和 Red 测试，删除 v3 类型。
2. 迁移命令与运行时 Patch 路径。
3. 迁移 Registry、Presets 与 Materials。
4. 迁移 Stage Engine、Stage、Preview 和 Inspector。
5. 迁移 Editor、调试面板、示例、Storybook、文档与 E2E。
6. 不保留 v3 reader、migration function 或兼容 alias。
