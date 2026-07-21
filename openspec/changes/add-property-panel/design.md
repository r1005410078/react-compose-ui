## 上下文

属性面板需要从 Valibot Schema 自动生成编辑 UI，同时允许宿主以自定义 React renderer 编辑
领域类型。仓库尚未定义正式文档 Schema、Component Registry 或事务命令，因此面板不能拥有
文档状态，也不能把示例数据结构提升为编辑器公共协议。

Valibot Schema 是可遍历的普通对象：Schema 通过 `type` 标识种类，对象通过 `entries` 暴露
字段，包装器通过 `wrapped` 暴露内部 Schema，pipe 同时携带根 Schema、约束和 metadata。
首版直接使用这些公开运行时属性，不转换为 JSON Schema。

## 目标/非目标

- 目标：提供独立、受控、可访问且可主题化的 React 属性面板。
- 目标：覆盖常用基础类型和完整的对象/集合/联合结构编辑。
- 目标：通过实例级 registry 支持宿主自定义类型与 UI，并由 ECharts 示例验证扩展能力。
- 目标：保持字段修改可以转换成未来的 Editor Command。
- 非目标：正式页面文档 Schema、Component Registry、撤销重做、持久化和全局 renderer 注册。
- 非目标：异步 Valibot Schema、通用 JSON 编辑器、Map/Set 等所有 JavaScript 类型的内置 UI。

## 决策

### 包边界与受控状态

- 新包命名为 `@compose-ui/property-panel`，只依赖 React 和 Valibot 的公共入口。
- React、ReactDOM 和 Valibot 保持为 peer dependency，并在构建时外置。
- `PropertyPanel` 接收 `schema`、`value`、可选 `defaultValue`、可选 `header`、实例级
  `renderers` 和 `onValueChange`。根元素保留标准 `div` 属性透传。
- `value` 和回调中的 `nextValue` 使用 Schema input 类型；回调详情同时提供整个 Schema 的
  parsed output、字段路径、前后字段值和操作原因。
- 面板不直接依赖未来 Command 类型；宿主可以根据路径和原因把同一回调转换为命令。

### Schema 遍历与展示 metadata

- 自动 renderer 覆盖 string、number、bigint、boolean、date、literal、picklist 和 enum。
- 结构 renderer 覆盖 object/looseObject/strictObject/objectWithRest、array、tuple/tupleWithRest、
  record、union 和 variant；optional、nullable、nullish 等包装器提供值存在性控制。
- pipe 使用第一个 Schema 的输入类型选择 renderer，并读取 title、description、metadata 及
  min/max/multipleOf 等可映射约束。
- `v.title` 和 `v.description` 分别作为字段名称和说明。`v.metadata` 中的
  `propertyPanel` 命名空间只保存 editor ID、section、order、hidden、readOnly、advanced、unit、
  placeholder、optionLabels 和初始折叠状态，不保存 ReactNode 或组件函数。
- custom、intersect、lazy、Map/Set、Blob/File、instance、function、promise、symbol、any 和
  unknown 没有匹配的自定义 renderer 时显示可访问的不支持状态。
- 首版只接受同步 Schema；检测到 async Schema 时显示明确错误并禁用编辑。

### 自定义 renderer registry

- renderer 定义包含稳定 `id`、可选 `matches`、React Component、可选默认值生成函数，以及可选的
  `inline`/`full-width` 默认布局。
- 解析顺序为：metadata 显式 editor ID、调用方 renderer matcher、包内置 renderer、不支持状态。
- 同 ID 的实例 renderer 可以覆盖内置 renderer；registry 不写入模块全局状态。
- renderer props 包含 path、schema、metadata、value、issues、readOnly 和 `commit(candidate)`。
  自定义 renderer 可以拥有临时 UI 状态，但所有提交仍经过面板的完整 Schema 校验。
- 字段 metadata 可以覆盖匹配 renderer 的默认布局；全宽模式由面板保留标题和统一操作行，renderer
  在下一行跨越三列，避免大型控件自行重复实现搜索、重置和存在性语义。

### 校验、草稿和默认值

- 每个候选修改先不可变地写入完整 input，再使用同步 `safeParse` 校验完整 Schema。
- 无效候选保留为字段本地草稿并显示路径对应 issues，不调用 `onValueChange`。数字输入在
  blur 或 Enter 提交；字符串在候选完整有效时实时提交。
- 成功回调同时传递原始 next input 和 parsed output，避免 transform Schema 丢失输出结果。
- 重置和结构新增的候选值依次来自对应 `defaultValue` 路径、Valibot defaults、内置 renderer
  的确定性初值；生成结果未通过目标 Schema 时禁用操作并说明原因。
- 数组支持新增、删除、上移和下移；record 支持新增、改键和删除；tuple 固定项只编辑值，
  rest 项可增删；union/variant 只启用能够生成有效目标值的分支。

### 面板布局与交互

- header 只来自显式 prop；未提供时不渲染头部，Schema 根 metadata 不隐式改变宿主头部。
- 搜索对字段 title、key、完整路径和 description 做不区分大小写的子串匹配，保留匹配项祖先
  并临时展开；清空后恢复原折叠状态。
- 筛选菜单提供全部、已修改和有错误；设置菜单切换高级属性和描述，并恢复默认列宽。
- `defaultValue` 是修改比较和分组重置的稳定基线；无法解析基线的分组不显示重置入口。
- 所有行共享属性名、编辑器、操作区三列。第一条分隔线调整属性名和编辑器边界；第二条调整
  编辑器和操作区边界。默认属性名列约 36%，操作列 36px，编辑器列至少 120px。
- 分隔线使用 Pointer Capture，并以 `role="separator"` 暴露当前值和边界；方向键每次移动
  8px，Shift+方向键移动 24px。列宽、折叠、搜索、筛选和草稿只存活于组件实例。
- 使用禁用 Preflight、带 `pp` 前缀的 Tailwind CSS，并提供包级 CSS 变量覆盖紧凑深色主题。

### ECharts 自定义类型示例

- ECharts 仅作为示例应用依赖，不进入属性面板包的依赖或公共声明。
- 示例定义 `EChartOption` 的同步 `v.custom` Schema，并通过 metadata 指定
  `editor: 'echart'`；validator 至少验证 option 为普通对象且 series 为可接受数组。
- 示例注册默认使用 `full-width` 的 `echart` renderer，在统一标题行下展示完整结构化编辑器。
- 编辑界面提供标题、图表类型、series 名称和数值的结构化控件以及真实 ECharts 预览；不会把
  option 退化为无约束 JSON 字符串。
- 示例新增 ECharts 图表节点，Scene Tree、Canvas、PropertyPanel 使用同一份受控临时状态；
  renderer commit 后画布图表同步更新。该数据仍明确标记为示例状态，不是正式文档协议。

## 风险/权衡

- Valibot 类型很多且可以组合 → 遍历器按 Schema/包装器/结构分层，并对未支持类型显式降级。
- 整体 Schema 校验可能受跨字段规则影响 → 保留无效草稿和完整 issues，不把无效值提交给宿主。
- 集合编辑容易引入不稳定路径 → 变更事件使用 string/number 路径，数组结构变化后重新从受控值
  计算节点，不公开内部 React key。
- 两条分隔线在窄面板中会互相挤压 → 使用 ResizeObserver 重新 clamp，并优先保证编辑器最小宽度。
- ECharts 体积较大 → 只由示例应用按组件加载，属性面板包保持无 ECharts 依赖。
- 自定义 renderer 可能绕过内置交互约定 → 所有 commit 继续经过统一不可变更新和 Schema 校验。

## 迁移计划

1. 新增独立包、Schema 模型和组件测试，不改变 editor。
2. 完成面板骨架、两条分隔线、过滤与复杂结构编辑。
3. 示例应用通过 `inspectorPanel` 插槽接入属性面板，保留现有文本纵向流程。
4. 添加 ECharts 节点、自定义 Schema、renderer 和画布联动。
5. 更新文档、发布配置、E2E 与视觉黄金文件。

## 待解决问题

- 无。
