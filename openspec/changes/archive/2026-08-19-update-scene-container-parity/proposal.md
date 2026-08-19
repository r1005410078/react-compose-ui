# 变更：场景与容器归一——外观一致，根层落点自动升格

## 原因

上一轮把画板做成了「场景」，但场景与容器在代码里仍然是两种东西：

1. **长得不一样。** 场景比容器多一圈专属 SVG 描边（未选中主题中性色、选中强调色），而它的
   默认外观是 `transparent` 背景、无边框；Container Preset 默认是 `#1e2229` 底 + 1px `#3b4250`
   边框。同一条渲染管线上挂着两套默认数据外加一层额外装饰。
2. **图标不一样。** `Composition.presetId: 'frame'` 被写进文档五个位置，但 Registry 里从来
   没有 id 为 `frame` 的 Preset，`getPreset('frame')` 恒为 `undefined`，场景树因此掉到通用
   `DocumentIcon`，而容器有自己的图标。
3. **在场景外新建容器不会得到场景。** 三条 Stage 新建路径（绘制工具、物料面板拖放、资源
   拖放）与两条场景树路径在命不中任何容器时，统一回退到 `document.rootIds[0]`。规范
   `受约束的 Frame 升格入口` 列出的「新建场景」隐含升格从未实现，用户没有任何空间化的
   造场景手段。
4. **该回退还携带一个坐标缺陷。** 世界坐标到父级局部坐标的换算与 `parent` 是否存在共用同一
   个条件分支：回退发生时换算被整体跳过，实体带着**世界坐标**被写进 `rootIds[0]`。只有
   `rootIds[0]` 恰好位于世界原点时结果才正确，多场景下必错。
5. **`activeFrameId` 在新建路径上完全没有生效。** `resolveTargetFrameId` 是既有的「该作用于
   哪一块场景」解析器，也已经通过 `StageInteractionContext.activeFrameId` 接到 Stage，但八处
   落点回退没有一处调用它；粘贴用的 `resolveSuggestedEntityInsertion` 甚至已经预留了
   `fallbackFrameId` 形参，唯一的调用方不传。

本变更把「场景就是放在顶层的容器」这句话在代码里坐实。

## 变更内容

- **升格只做一件事：给既有 Entity 加 `Frame`。** core 导出 `promoteComposeEntityToFrame`
  纯函数，补齐 `Hierarchy`、把 `Frame` 写进 `baseComponentKeys`，其余 Component——包括
  `Appearance` 与 `Clip`——一概原地保留。`component-extraction` 里既有的内联升格改调它。
- **场景默认外观与容器一致。** core 导出 `COMPOSE_DEFAULT_SCENE_APPEARANCE`，
  `createComposeFrameEntity` 默认采用它并新增 `appearance` 选项；Preset 校验探针显式传回
  透明，因为它不是场景。
- **Stage 不再为 Frame 画专属描边。** 场景与容器共用同一条呈现管线，视觉上的唯一区别是
  标题标签（播放按钮与激活标记）。「哪一块会被发布」由标签上的激活标记承担。
- **新增 `frame` Entity Preset。** 图标与 Container 相同、`paletteHidden`，让场景树、拖拽
  预览等所有按 `presetId` 取图标的位置自动一致。
- **根层落点按类型分流。** 在任何 Frame 之外新建时：容器类 Entity 升格为新的根场景；
  非容器 Entity 落进**激活场景**，世界坐标换算后钳制进该场景边界，保证完整可见。
  所有新建路径 MUST NOT 再回退到 `rootIds[0]`。
- 粘贴无选中时传入 `fallbackFrameId`，落点从「第一块场景」改为「激活场景」。

## 非目标

- 不改变 `ComposeDocument` 版本或 `ComposePageFile` 版本。
- 不改已存在实体的拖拽语义：把实体拖到空白工作区仍然只改坐标、不改父级。
- 不提供裸露的「升格为 Frame」命令；升格仍只作为具名用户动作的隐含结果。
- 不实现场景降格：把一块场景拖进另一块场景保留 `Frame`，成为嵌套场景。
- 不解决「Frame 默认裁剪」与「可在场景边界外编辑」这对规范矛盾（见 design.md 已知遗留）。

## 影响

- 受影响的规范：`compose-document`、`stage`、`editor-workspace-layout`、`basic-materials`、
  `stage-engine`
- 受影响的代码：`packages/core`（升格纯函数、场景默认外观）、
  `packages/materials`（`frame` Preset）、
  `packages/stage-engine`（落点解析、钳制、`component-extraction` 去重）、
  `packages/stage`（三处落点回退、删除描边装饰、粘贴回退）、
  `packages/editor`（场景树根级落点、场景树图标标签）、`e2e/`
- 顺带修复：空白处新建实体带世界坐标写进 `rootIds[0]`；粘贴无选中时落进第一块场景而不是
  激活场景；`getPreset('frame')` 恒为 `undefined`；`.is-scene` 是一个没有任何 CSS 规则的死类。
