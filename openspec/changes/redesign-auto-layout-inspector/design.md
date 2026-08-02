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
- 复合几何 Inspector 以名称、位置/自身对齐、旋转、尺寸、外边距五行呈现。Absolute 显示独立
  位置行 X/Y；Flow 在该行改为自身对齐。持久化 positioning 不再由 Inspector 直接编辑。
- Absolute 位置使用独立 Materials Position 自定义类型，在一个属性行中显示 X/Y；Flow 自身对齐
  使用独立 picklist 属性。旋转是独立 number 属性并显式使用内建 `angle` 语义类型。Materials 不再
  把位置、对齐和角度塞入同一自定义值，也不再直接渲染 Angle Picker；各自 Editor 负责输入与
  可访问性，变更仍由复合 Inspector 映射为既有 LayoutItem/Transform command。
- 尺寸行把 W/H 并排显示，每轴使用单一 compound control：W/H 前缀、值区和尾部模式触发器
  位于同一个边框、背景和焦点范围内，不再呈现相互分离的 input 与 select。Fixed 显示数字；
  Fill/Hug 显示本地化模式名。直接输入数字会转为 Fixed；从 Fill/Hug 选择 Fixed 时优先烘焙
  Snapshot 计算尺寸，缺失时使用 fallback。菜单只列出当前上下文合法的模式。
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

### Figma 对照与取舍

- Figma 把 rotation 作为独立字段，而不是 X/Y 的组成部分；本方案对应拆成独立 `angle` 属性行。
  参考：[Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions)。
- Figma 的 W/H 是主尺寸字段，轴向 sizing behavior 通过相邻菜单选择；输入数值会把该轴自动切到
  Fixed。本方案保留该交互，但把值区和菜单触发器收进同一个复合输入外壳，以适配 365px Inspector。
  参考：[Guide to auto layout](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout)。
- Figma 的数值字段还支持 scrub、算式以及在尺寸菜单中设置 min/max。本轮只复用字段拆分、融合菜单
  和“输入数字转 Fixed”语义；scrub、算式与 min/max UI 保持非目标。
- Figma 在画布中以 -180° 到 180° 表达可见旋转；本项目为兼容已有文档，文本输入继续保留任意有限
  角度与多圈数值，只有转盘和快捷角使用 0–359° 归一化值。

## 风险/权衡

- 新 Container 的默认行为改变，但只影响新建实例；已有文档保持原样。
- 移除依赖 Snapshot，因此加载期间必须禁用，而不能使用过期 offset 降级。
- missingInspector 是新增公共 Registry 协议，需保持通用，禁止让 Editor 硬编码 Materials 语义。
- 基础分组聚合增加公共 Registry 展示元数据，但不改变 Component JSON、命令或 LayoutSnapshot。
- 复合几何 Inspector 会同时编辑两个 Component，但每个可见属性拥有独立 Schema 字段与语义类型，
  并按字段路径分派既有 typed command，不引入新的文档或事务协议。

## 迁移计划

不进行加载时迁移。新 Preset/Capability 停止创建 Layout；旧 Layout 在用户主动移除时才解除旧基础归属。
