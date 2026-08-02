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

- Absolute 显示 offset、隐藏 alignSelf；Flow 隐藏 offset、显示 alignSelf。
- Fixed 显示可编辑 value；Fill/Hug 只显示 Snapshot 计算值，fallback 不暴露为普通输入。
- Flex 控件三行排列：direction/wrap、gap/align-content、justify-content/align-items。
- gap 相等时使用单值入口；分轴后编辑 rowGap/columnGap。重新合并时以 rowGap 统一两轴。
- padding 只在盒模型预览编辑。四值相等时默认联动；重新联动以 top 统一四边。
- wrap 预览保证形成多行，使 align-content 的变化可观察。

## 风险/权衡

- 新 Container 的默认行为改变，但只影响新建实例；已有文档保持原样。
- 移除依赖 Snapshot，因此加载期间必须禁用，而不能使用过期 offset 降级。
- missingInspector 是新增公共 Registry 协议，需保持通用，禁止让 Editor 硬编码 Materials 语义。

## 迁移计划

不进行加载时迁移。新 Preset/Capability 停止创建 Layout；旧 Layout 在用户主动移除时才解除旧基础归属。
