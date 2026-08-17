# 设计：Auto Layout 拖拽语义与手势期实时布局

## 1. 为什么默认值必须翻转，而不是修一个个判定分支

现状的结构是「reorder 是需要争取的特例，脱流是兜底」。落点判定（`resolveStageDropTarget`）
返回 null 的路径有四条以上，每条都通向 `setTransform` → 隐式烘焙 Absolute。逐条修补判定
条件无法穷尽，也改不掉「判定失败 = 破坏性结果」这个倒置的缺省。因此本变更把缺省翻转为
Figma 语义：**Flow 子级的 move 手势只可能产生 reorder、reparent 或 no-op 三种结果**，
positioning 永远不因拖拽而改变。脱流成为显式操作（面板开关），隐式路径从 core 层面删除。

## 2. core 意图字段

`setTransform` payload 的每个 update 项新增可选 `detachFromFlow?: boolean`（缺省 false）。
只有为 true 时 `appendSpatialTransformPatches` 才执行 flow→absolute 与 fill→fixed 烘焙。
选择放在 update 项而不是 payload 顶层：混合选区中只有部分目标需要脱流（面板批量操作时
Absolute 项应保持原样）。

旧命令 JSON 不含该字段，语义等价于 false——对已持久化的历史记录无迁移需求；但**行为**
变了：同样的拖拽不再产生同样的文档，属破坏性变更，走本提案评审。

## 3. 修饰键分配

| 键 | 手势中语义 | 冲突检查 |
| --- | --- | --- |
| `Command` | （既有）禁用吸附 | 不动，避免肌肉记忆破坏 |
| `Shift` | （既有）轴锁 | 不动 |
| `Alt` | 强制 reparent：指针命中的最内层合法容器直接成为落点，跳过 `isDeepInside` 的 16px 深入判定 | move 手势中 Alt 目前无语义（复制拖拽尚未实现；将来实现时用「按下瞬间」区分，Figma 同样如此） |
| `Space`（按住） | 锁定原父级：`containerAtPoint` 结果非原父级时不产生落点 | 画布平移的 Space 只在无手势时生效，手势进行中按下不冲突 |

Figma 用 Cmd/Ctrl 做强制进容器；我们的 Command 已绑定禁用吸附，直接照搬会撞键，
故用 Alt。修饰键状态从 `StageInteractionModifiers` 现有通道进入 `resolveStageDropTarget`
新增的 `modifiers` 入参，判定保持纯函数。

## 4. wrap 容器二维插槽

nowrap 的一维中点比较推广为两级：

1. **行分组**：按冻结 Snapshot 中各 Flow 兄弟 box 的交叉轴区间聚类成行（Yoga 已完成换行，
   同一行的交叉轴区间互相重叠；`wrap-reverse` 时行序取反）。
2. **行内命中**：指针交叉轴坐标先选行（与各行交叉轴中线比较），再在行内做既有的主轴
   中点比较得到插入序号。

插入序号仍映射回容器原始 `childIds` 下标，复用 `applyChildReorder` 的索引代数与 no-op
判定。落点指示线几何同样按「行内主轴位置」计算，`resolveStageDropIndicator` 扩展为支持
行定位。

已知限界：Yoga 换行结果依赖被拖动项自身占位，拖动中我们用「兄弟保持冻结位置」的近似，
与 Figma 的实时让位预览（见 §6）在 wrap 容器上可能有一行之差；首期接受，指示线始终反映
松手的真实结果。

## 5. 回弹与 no-op

（实施更新）不引入 `{ kind: 'none' }` 落点：null 继续表示「无结构意图」，回弹改在
Controller 的 setTransform 提交分支实现——move 手势的 updates 过滤掉全部 Flow 目标。
这比新增落点种类更简单，且天然覆盖「混合选区中 Absolute 正常提交坐标、Flow 回弹」的
情形。顺序未变时 pointerup 只清除 preview，不发 effect，历史无新增条目。方向键 nudge
同样过滤 Flow 目标（位置由布局决定，平移无可见效果）。

## 6. 手势期实时布局

### 6.1 预算与实测

基准（yoga-layout 3.2.1，M 系列 mac，bun，嵌套 wrap 容器、每容器 8 子级）：

| Entity 数 | 现状 updateDocument | 纯 calculateLayout | 读回全部 box | 全树 dirty+solve |
| --- | --- | --- | --- | --- |
| 500 | 4.70ms | 0.02ms | 0.11ms | 1.57ms |
| 2000 | 19.63ms | 0.03ms | 0.35ms | 1.50ms |

结论：Yoga 本身远在预算内（60fps = 16.6ms/帧，pointermove 可达 120Hz）；成本大头是
Runtime 每次 solve 无条件对全部 Entity 执行 `clearEntityStyle`+`applyEntityStyle`
（~25 次跨 WASM setter/Entity，~9.8µs/Entity 线性成本），以及 `applyEntityStyle` 内
同步调用 measurement port——Stage 的 adapter 走真实 DOM 测量，每帧全量重测是强制同步
reflow，是比 WASM setter 更大的隐患，且不在上表内。

### 6.2 增量求解（无行为变更的前置优化）

- **样式跳过**：文档不可变，一次几何变更只替换目标 Entity 及祖先链的对象引用。solve 时
  对「自身引用未变且父级 Layout 引用未变」的 Entity 跳过样式重写与 measure 安装；Yoga
  Node 保留上次状态。预计把 2000 Entity 的 19.6ms 压到 ~2ms 量级。
- **measurement 缓存**：以（Entity 引用，约束）为键缓存测量结果，引用未变时不重新调用
  port。port revision 失效仍走既有 `invalidateMeasurements` 路径。
- **box 复用**：`calculateAndPublish` 对值未变的 box 复用上一 Snapshot 的冻结对象，
  下游 memo/相等性检查得以生效。

三条都不改公共 API 与可观察布局结果，仅受「增量重解性能」规范约束。

### 6.3 预览通道

`ComposeLayoutRuntime` 新增：

```ts
previewDocument(document: ComposeDocument): void  // 提交瞬态预览文档
clearPreview(): void                              // 回到最后一次 updateDocument 的结果
```

- 预览求解复用同一棵 Yoga 树（增量样式让这近似免费），产出的 Snapshot 带预览标记；
- `updateDocument`（真提交）到达时隐式清除预览；
- 预览不进入 TransactionRuntime，不产生历史条目——这就是它不能走「每帧 dispatch 命令」
  的原因：undo 栈会被 pointermove 灌满，且命令校验成本每帧重付。
- editor 侧：resize 手势期间由 `useComposeEditorLayout` 把 controller 发布的
  `previewTransforms` 合成瞬态文档喂给 `previewDocument`，并以 rAF 合并（每帧最多一次
  求解）；cancel/pointerup 走 `clearPreview` 或真提交。

### 6.4 手势原子性的中止规则调整

「并发的文档或布局变化 MUST 中止空间手势」原样保留对**外部**变化的判定；手势自身触发的
预览 Snapshot MUST NOT 中止手势。

（实施更新）实现方式是预览 Snapshot **不进入** controller 的 `updateContext`：editor 只把
预览 Snapshot 交给 Stage 的场景渲染层，controller context 始终持有提交态文档与 Snapshot。
这同时保证了提交几何以冻结 Snapshot 为准——若预览进入 context，move 提交路径中
`persistedAbsolutePosition` 会用预览 box 反算 offset，产生错误坐标。外部并发变化的中止
判定因此完全不需要修改。

## 7. 面板开关的烘焙规则

「忽略 Auto Layout」开关（仅当父级是 Layout 容器时显示）：

- **开（脱流）**：`positioning: 'absolute'`，offset 从当前布局 box 反算（视觉位置不跳），
  fill 轴烘焙为 fixed（值取求解尺寸）——与 `createReparentCommand` 移出 Flow 的既有烘焙
  规则一致。
- **关（回流）**：`positioning: 'flow'`，复用 `update-auto-layout-adoption-sizing` 落地的
  `adoptComposeCrossAxisSizing` 采纳规则；插入序号保持当前 `childIds` 位置不变。
- 单条 `updateComponent` 事务，undo 一次恢复。

## 8. 已否决的替代方案

- **只做节流不做增量**：节流治标，200 Entity 以上叠加 DOM measurement 仍会掉帧；且不解决
  成本与文档规模线性绑定的问题。
- **手势期直接改 Yoga Node 绕过文档**：破坏「Yoga 指针不进公共 API」的包边界，且预览与
  提交走两条代码路径，结果可能不一致。
- **脱流用第三个修饰键**：三个手势修饰键超出可发现性预算；Figma 也不提供拖拽脱流，
  面板开关是对齐后的唯一入口。
- **wrap 重排等下一期**：wrap 是「拖一下就脱流」重灾区（判定第一条早退就是 wrap），
  不修等于默认语义翻转对 wrap 用户无效。
