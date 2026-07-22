# 变更：新增 Schema 驱动的独立属性面板

## 原因

编辑器右侧目前由示例应用中的单个文本输入框临时填充，既没有稳定的属性面板协议，也无法从
组件数据 Schema 自动生成匹配的编辑控件。需要提供一个可独立嵌入、支持复杂属性结构和宿主
自定义类型 UI 的属性面板包。

## 变更内容

- 新增 `@compose-ui/property-panel` 公共包及独立样式入口，提供受控属性值和字段变更意图协议。
- 遍历同步 Valibot Schema，自动生成基础类型、包装器、嵌套对象、数组、元组、record、union
  和 variant 的编辑 UI。
- 使用 Valibot title、description 和 `propertyPanel` metadata 描述标签、分组、顺序、可见性、
  高级属性、单位及自定义 editor ID。
- 提供实例级 renderer registry，使宿主可以为 `v.custom` 或其他语义类型注册 React 编辑器，
  Schema 中不保存 React 组件。
- 自定义 renderer 可以声明普通三列或“标题行 + 全宽内容区”布局，字段 metadata 可以覆盖
  renderer 默认布局，使图表、曲线等大型控件不受普通值列宽度限制。
- 提供 UE 风格紧凑深色面板骨架、搜索、筛选、设置、分组折叠和按默认值重置。
- 按 UE4 参考图精细还原默认 Inspector 宽度、三列比例、控件轨道、层级缩进、数值格式、单位、
  Checkbox、Visibility 和 Alignment 视觉细节。
- 将 UE4 紧凑信息密度作为默认视觉，并公开字体、区域高度、控件高度和树缩进 CSS 变量供宿主覆盖。
- 属性名、编辑器和右侧操作区使用共享三列布局；两条可访问分隔线分别调整属性名/编辑器和
  编辑器/操作区边界。
- 示例应用注册 `EChartOption` 自定义类型和 ECharts 专用属性 renderer；用户编辑配置后，画布
  中的真实 ECharts 图表同步更新。
- 示例应用启动时默认创建并选中 Rectangle；该节点集中展示面板已经支持的全部基础、包装、集合、
  联合和自定义类型，使新增类型能力可以在一个节点中发现和验收。

## 影响

- 受影响规范：新增 `property-panel`
- 受影响代码：新增 `packages/property-panel`，修改示例应用、根构建/发布配置及项目文档
- 新增依赖：属性面板以 Valibot 1.4 为 peer dependency；示例应用增加 Valibot 和 ECharts
- 架构边界：`property-panel` 不依赖 `core`、`editor` 或 `scene-tree`；editor 继续只通过
  `inspectorPanel` 插槽接收属性面板
- 兼容性：现有 editor 公共 API 和文本组件示例流程保持兼容
