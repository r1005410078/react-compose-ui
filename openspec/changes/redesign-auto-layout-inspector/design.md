## 上下文

`Hierarchy` 已允许作为自由容器存在，只有 `Hierarchy + Layout` 才管理 Flow 子项。LayoutSnapshot
是几何事实来源，因此 Auto Layout 的移除不能读取旧 offset，而必须从当前 box 烘焙 Absolute。
Editor 当前只渲染 Entity 已拥有的 Component Inspector，Property Panel Section 也假定存在可折叠正文。

## 目标/非目标

- 目标：默认自由容器、稳定的“布局 +”入口、可逆 Auto Layout、紧凑且语义正确的 Inspector。
- 非目标：Grid、新 Schema 版本、Stage 内拖动重排、百分比/单位/变量、改变 Yoga 求解规则。

## 决策

### 缺失 Component 入口

- `ComposeComponentDefinition.missingInspector` 声明缺失 Component 时的可见条件和标题栏操作。
- Editor 按 Registry 顺序组合协议，不识别 Layout；Property Panel 提供不可折叠且无正文的
  action-only Section。
- Layout 的缺失入口只对拥有 Hierarchy 的 Entity 可见。`+` 始终打开菜单，当前仅含 Auto Layout。

### 添加与移除

- 添加使用 batch：添加默认 Layout，并按 `Hierarchy.childIds` 将直接子项切换为 Flow。
- 移除要求 Snapshot 完整：Flow 子项转 Absolute，Fill 转 Fixed；目标容器自身 Hug 转 Fixed。
- 子项 offset 使用 Snapshot local box 减去容器 border。Absolute 子项和嵌套 Layout 不变。
- 旧文档中 Layout 若仍属于 `baseComponentKeys`，只在用户主动移除时先解除该归属。
- 任一受影响 Entity 锁定、Snapshot 未就绪或 box 缺失时，不创建部分命令。

### Inspector 状态

- Component Definition 可声明 `inspectorGroup: 'basic'`，Editor 据此把 Inspector 放进 Identity
  基础分组；LayoutItem Definition 提供读取 Transform、LayoutItem 与 LayoutSnapshot 的复合几何
  Inspector，Transform 不再创建独立 Inspector，Editor 不硬编码具体 Component Key。
- Component/Renderer Definition 可声明 `inspectorDefaultExpanded`；基础与 Layout 默认展开，
  其余普通分组默认折叠，搜索命中时仍临时展开。
- 复合几何 Inspector 以名称、变换、尺寸、外边距四行呈现。Absolute 的变换行显示 X/Y/旋转；
  Flow 的同一位置改为自身对齐/旋转；持久化 positioning 不再由 Inspector 直接编辑。
- 尺寸行把 W/H 并排显示，每轴由可编辑值和模式下拉组成。Fixed 显示数字；Fill/Hug 显示本地化
  模式名。直接输入数字会转为 Fixed；从 Fill/Hug 选择 Fixed 时优先烘焙 Snapshot 计算尺寸，
  缺失时使用 fallback。
- 外边距四值相等时显示单值和展开按钮；展开后在同一属性行显示 T/R/B/L，重新联动时以 top
  统一四边。所有数值输入保留本地草稿，Enter/失焦提交，Escape 或非法草稿零提交。
- 基础分组不显示 CSS 副标题或独立计算尺寸行；Auto Layout 分组继续显示 CSS 属性名。
- 同一 Property Panel Section 中的多个嵌入式 Inspector 分别注册搜索可见性，Section 以任一子项
  可见作为整体可见条件，卸载时清理注册。
- Flex 控件三行排列：direction/wrap、gap/align-content、justify-content/align-items。
- gap 相等时使用单值入口；分轴后编辑 rowGap/columnGap。重新合并时以 rowGap 统一两轴。
- padding 只在盒模型预览编辑。四值相等时默认联动；重新联动以 top 统一四边。
- wrap 预览保证形成多行，使 align-content 的变化可观察。

### 共享角度选择器

- `@compose-ui/components` 发布受控、无文档语义的 Compose Angle Picker；Property Panel 基础
  Angle Editor 与 Materials 复合几何 Inspector 均复用该组件。
- 文本输入接受任意有限角度；转盘把显示和拖动归一到 0–359°，并提供 0°/90°/180°/270° 快捷角。
- 转盘拖动只修改组件内草稿，pointerup 只提交一次；Escape、焦点取消与卸载丢弃未提交草稿。
- 组件实现 slider 键盘语义、弹层焦点进入/退出与焦点恢复，并复用 Components 层现有 Base UI/
  Shadcn 源码与 Compose Theme token；Materials 不直接依赖弹层运行库。

## 风险/权衡

- 新 Container 的默认行为改变，但只影响新建实例；已有文档保持原样。
- 移除依赖 Snapshot，因此加载期间必须禁用，而不能使用过期 offset 降级。
- missingInspector 是新增公共 Registry 协议，需保持通用，禁止让 Editor 硬编码 Materials 语义。
- 基础分组聚合增加公共 Registry 展示元数据，但不改变 Component JSON、命令或 LayoutSnapshot。
- 复合几何 Inspector 会同时编辑两个 Component，但仍按字段路径分派既有 typed command，不引入新的
  文档或事务协议。

## 迁移计划

不进行加载时迁移。新 Preset/Capability 停止创建 Layout；旧 Layout 在用户主动移除时才解除旧基础归属。
