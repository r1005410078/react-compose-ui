# 变更：Auto Layout 拖拽语义对齐 Figma 与手势期实时布局

## Why

当前 Auto Layout 容器内拖动 Flow 子级的默认结果是「静默脱流」：move 手势结束时只要落点判定
失败（wrap 容器、拖回原位、指针短暂滑出容器、多选混入 Absolute 项任一条件），提交路径就回落到
`setTransform`，而 core 在 `operation === 'move'` 且 `positioning === 'flow'` 时无条件把节点
烘焙成 `absolute`（`packages/core/src/builtin-commands.ts` 的 `appendSpatialTransformPatches`）。
用户想「挪一下顺序」，得到的却是节点永久脱离自动布局，且没有任何提示和恢复入口——几何面板
不存在 positioning 切换开关，脱流是单向的。

对照 Figma 的交互模型，差距是系统性的：

| 维度 | 我们 | Figma |
| --- | --- | --- |
| 拖拽默认语义 | 落点判定失败 → 转 absolute | 恒为 reorder，失败即回弹 |
| 转 absolute 的入口 | 拖拽隐式触发 | 面板显式开关（Ignore auto layout） |
| wrap 容器 | 不支持重排 | 支持 |
| 拖到原位 | 脱流 | no-op |
| 强制放进容器 | 无手段（16px 留白不可绕过） | Cmd/Ctrl 强制 |
| 锁定原父级 | 无手段 | 有 |

另外，resize Auto Layout 子级时布局只在 Pointer Up 后重算，拖动过程中兄弟不让位，所见与
松手结果不一致。实测（yoga-layout 3.2.1，M 系列，bun）一次全量 `updateDocument` 在 2000
Entity 文档上耗时 ~19.6ms，其中 Yoga 求解只占 ~1.5ms、读回 box ~0.35ms，其余 ~90% 是
Runtime 每次 solve 对全部 Entity 无条件重写样式（每个 ~25 次跨 WASM setter）与同步重测
measurement 的实现开销。该开销与实际变更量无关，是线性固定成本；先消除它，实时布局才能在
真实文档规模下稳定在帧预算内。

## What Changes

### A. 拖拽不再隐式脱流（破坏性行为变更）

- core `setTransform` 删除「move Flow 子级即烘焙 Absolute」的隐式规则；Flow→Absolute 转换
  只由命令 payload 上新增的显式意图字段驱动。fill→fixed 的伴随烘焙同样跟随该意图字段。
- stage-engine 的 move 手势对 Flow 子级不再回落到 setTransform：有 reorder/reparent 落点则
  提交对应结构命令；无落点（含顺序未变）则回弹，不产生任何事务。
- 同容器重排支持 `wrap`/`wrap-reverse` 容器：按行/列分组做二维插槽命中，取代现有的
  「wrap 立即烘焙 Absolute」行为。
- Absolute 子级与顶层自由画布节点的 move 行为完全不变。

### B. 显式意图入口

- 拖拽新增两个修饰键（`Command` 已被「禁用吸附」占用，不复用）：
  - 按住 `Alt`：强制以指针命中的最内层合法容器为 reparent 落点，绕过 16px 边缘留白的
    深入判定；
  - 按住 `Space`（手势中）：锁定原父级，指针经过其他容器不产生 reparent 落点。
- basic-materials 几何 Inspector 新增「忽略 Auto Layout」开关，作为 Flow↔Absolute 的唯一
  显式转换入口：脱流时从布局 box 烘焙 offset 并把 fill 轴烘焙为 fixed；回流时按既有
  进入容器的采纳规则处理，单事务、可撤销。

### C. 手势期实时布局

- layout-engine 新增手势期预览求解通道：宿主可提交瞬态预览文档得到预览 Snapshot，
  不污染已提交状态，清除后回到最后一次提交结果；预览求解不产生文档事务。
- layout-engine 增量化：对象引用未变的 Entity 跳过样式重写与重新测量，measurement 结果
  按输入缓存，单次重解成本与变更子树成正比而不是文档总量。
- editor 在 resize 手势期间把预览几何合成瞬态文档喂给预览通道，Stage 按预览 Snapshot
  渲染，兄弟实时让位；取消手势立即恢复提交态 Snapshot。
- stage-engine「手势预览与原子提交」的中止规则区分外部并发变化（仍中止手势）与手势自身
  产生的预览 Snapshot（不中止）。

## 影响

- 受影响规范：`stage-engine`、`command-transaction`、`basic-materials`、`layout-engine`、`stage`
- 受影响代码：
  - `packages/core`：`appendSpatialTransformPatches` 意图字段、payload Schema
  - `packages/stage-engine`：`drop-target.ts`（wrap 插槽、修饰键、noop 落点）、
    `interaction-controller.ts`（提交分支、Alt/Space、预览中止规则）
  - `packages/layout-engine`：`layout-runtime.ts`（增量样式、measurement 缓存、预览通道、
    box 复用）
  - `packages/editor`：`use-layout-runtime.ts` 预览接线
  - `packages/materials`：`material-inspector-kit` 几何 Inspector 开关与 i18n
  - `packages/stage`：wrap 落点指示渲染
- 不改 `ComposeDocument`/`ComposeLayoutItem` 数据结构，无文档迁移
- 破坏性行为变化：依赖「拖一下即转 Absolute」的既有流程失效，改由面板开关承担；
  `e2e/auto-layout.spec.ts`、`e2e/stage-interactions.spec.ts` 中相关用例与黄金图需更新
- 与待归档变更 `update-auto-layout-adoption-sizing` 无 delta 冲突（其 stage-engine delta 只改
  「ECS 结构命令」，basic-materials delta 只改「Auto Layout 按需启用」）；本变更的「回流」
  路径复用其落地的 `adoptComposeCrossAxisSizing` 采纳规则
