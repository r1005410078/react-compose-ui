# Stage 插件化内核重构路线图

## 文档定位

本文是 Stage 交互层重构的**纲领性路线图**，用于串联多个 OpenSpec 变更，不代表当前已经
稳定的公共 API。每一步都是一个独立可发布、可回退的 OpenSpec 提案；行为由现有单测与 e2e
黄金图钉死。与 `overview.md` 同为指导提案的架构文档，区别是本文只覆盖 Stage 交互层。

配套架构设计稿（分层图、手势时序、Before/After）：
<https://claude.ai/code/artifact/c6a00d81-7458-4ab1-a12a-5a490e987807>

## 要解决的问题

- **巨石 TSX**：`compose-stage.tsx` 3077 行 / 88 处 hook 调用，把手势编排、文本原地编辑、
  实例下钻、剪贴板、快捷键、实时布局预览与 Overlay 组装粘在一起，违反 AGENTS.md 的
  「状态模型 / React 适配 / 渲染分层」要求。
- **宿主策略以散装布尔累积**：`lockGestureParent`、`marqueeMode` 等，每来一个编辑器模式
  就往 props 上钉一颗钉子，模式语义在 Stage 内部被拍平成互不相识的布尔分支。
- **注入机制不正规**：`ComposeEditor` 通过 `cloneElement` 向 Stage 覆盖属性，覆盖优先级
  靠注释约定维持（见 `editor-controller/viewport-bound-panels.tsx`）。

`stage-engine` 的 `StageInteractionController`（外部 store + 事件驱动 + `updateContext`）
已经是干净的 headless 内核雏形，问题只是全部手势焊死在内部。因此本重构不是推倒重来，
而是把单体状态机拆成「仲裁器 + 插件」。

## 目标架构

显式组合根 + headless 微内核 + 可替换插件。依赖注入通过类型化端口对象与组合函数完成，
**不引入 DI 容器框架**——没有装饰器、没有反射、没有运行时容器。

```text
组合根        createComposeStageRuntime({ plugins, overlays, services, policy })
React 适配层   Surface（事件归一化）· SceneLayer（文档渲染）· OverlayHost（按 slot 渲染）
Stage Kernel  Input Pipeline · Session Arbiter · Plugin/Overlay Registry · 快照 Store
插件          move · resize · rotate · marquee · draw-* · guides · text-edit · drilldown
服务端口      dispatch · clipboard · registry · assetResolver · measurement · layoutPreview
```

### 三个契约

- `StageInteractionPlugin`：`claim(event, ctx) → StageSession | 'consumed' | null`，纯判定
  是否接管输入；`consumed` 表示本次按下已处理但不开会话，仲裁器停止询问其余插件。
- `StageSession`：`update` 每帧产出效果（只写预览快照，不写文档）、`commit` 至多规划一个
  batch 事务、`cancel` 无条件清理（Esc / 并发文档变化 / 卸载）。仲裁器保证 `commit` 前已用
  最终点调用过一次 `update`，因此 `commit` 不接收终点参数。
- `StageOverlayContribution`：`select(snapshot, ctx) → OverlayModel | null`，按 slot
  （`underlay | selection | handles | feedback | chrome`）从快照纯派生。

服务端口聚合为 `StageServices`，宿主模式语义聚合为 `StagePolicy`。插件是纯状态机，
不碰 React 与 DOM，Vitest 直接喂事件序列即可测试。

### 继承的不变量

- 手势期间只有预览态，绝不写文档；松手至多提交一个事务。
- 预览 Snapshot 不进入交互上下文，提交几何以冻结的提交态 Snapshot 为准。
- 集合引用必须稳定：隐藏集合、场景子树与 SceneIndex 缓存的引用漂移会重建整棵场景。
- `defaultStagePlugins()` 保持现有行为开箱即用。

## 现有职责 → 插件映射

| 现有职责 | 现在的位置 | 目标归属 |
| --- | --- | --- |
| 移动 / 换父级 | compose-stage + controller 分支 | `move` 插件，换父级受 policy 约束 |
| 缩放 + 实时布局 | compose-stage（预览求解粘连最深） | `resize` 插件 + `layoutPreview` 端口 |
| 旋转 | controller 分支 | `rotate` 插件 |
| 框选 | marquee-selection.ts + controller | `marquee` 插件，命中模式来自 policy |
| 绘制工具 | 引擎 `draw` 手势（单一手势带 tool 判别）+ drawing-entity.ts | `draw` 插件，preset 由注入参数给定 |
| 辅助线拖放 | 引擎 `guide-create` / `guide-move` 两个手势 | 同名两个插件 |
| 文本原地编辑 | compose-stage（ref 会话 + 测量链路） | `text-edit` 插件 + React 伴生组件 |
| 实例下钻 / 内部测量 | instance-drilldown.ts + TSX | `drilldown` 插件 + `measurement` 端口 |
| 运动路径顶点编辑 | 引擎 `path` 手势 + editor/use-motion-path | `path` 插件（引擎已有该手势，非动画模式专有） |
| Paint 手柄与图层取色 | 引擎 `paint` / `paint-sample` 手势 | 同名两个插件 |
| 两点 Shape 端点 | 引擎 `segment-resize` 手势 | `segment-resize` 插件 |
| 平移 | 引擎 `pan` 手势 | `pan` 插件 |
| Overlay 绘制 | stage-overlay.tsx 单文件 871 行 | 按 slot 拆分的 OverlayContribution |
| 快捷键 / 剪贴板 | compose-stage 内联 | 内核输入管线动作表 + `clipboard` 端口 |

## 绞杀式重构路线

靠「legacy 巨插件」保证每一步都可发布、可回退。**一步一个 OpenSpec 提案**，上一步合并后
再起草下一步——后一步的细节依赖前一步的实测结果。

### 步骤 0 · 行为基线（无需提案）

现有单测与 e2e 黄金图即特征测试；对无覆盖的手势路径先补测试再动刀。按 AGENTS.md，
纯测试新增可直接实施。**门槛**：基线全绿。

### 步骤 1 · 端口与策略聚合 — `refactor-stage-service-ports` ✅ 已完成

散装 props 收敛为 `services` / `policy` 两个对象；删除 `cloneElement` 注入，覆盖优先级
从注释约定变为类型约定（`controller.renderStage(overrides)` + `composeEditorStageProps`）。
**无行为变化**：lint / typecheck / test 45 / build / e2e 99 全绿，黄金图零差异。

落地要点：Stage 按**字段**消费两个聚合对象，不以对象引用作缓存键，因此宿主重建 services
不会重建场景；`services` 与 `policy` 在 controller 各自记忆化，「端口变了」与「模式变了」
在依赖数组上就是两件事。

### 步骤 2 · 内核骨架 + legacy 巨插件 — `refactor-stage-kernel-arbiter` ✅ 已完成

`stage-engine` 落地 Session Arbiter 与 Plugin Registry；现有单体 controller 原样包成一个
插件整体注册，对外快照协议不变。**验证**：lint / typecheck 46 / test 45（stage-engine
198，含 25 个新增内核用例）/ build 24 / e2e 99 全绿，`interaction-controller.test.ts`
2225 行**一行未改**。

落地要点：

- 仲裁器额外提供 `release()`——丢弃会话引用但不调用 `cancel`。`reset()` 的 6 个调用点里有
  4 个在指针生命周期之外（并发文档变化、surface 断开、dispose、外部拖入开始），它们已自行
  拆除手势；`reset()` 统一调用 `release()` 让仲裁器同步，否则下一次接管会被误拒。
- `finish()` 开头内联的 `updateGesture` 已移除，最终点推进改由仲裁器在 `commit` 前驱动。
  legacy 会话记住最近一次指针事件，供 `finish` 读取松手时的修饰键（marquee 的布尔组合以
  释放时按住的键为准）。

读代码得到的两处修正（详见该变更的 design.md）：

- **claim 是三态**而不是两态：`StageSession | 'consumed' | null`。`begin()` 里文字编辑守卫
  与 `tool === 'rotate'` 兜底都是「已消费、不开会话、且必须阻止后续判定」，两态表达不了。
- **Overlay Registry 移到步骤 4**：它在步骤 4 之前没有消费方，提前建注册表属于提前抽象。

### 步骤 3 · 逐手势搬迁 — 每个手势一个提案

引擎的 `Gesture` 联合实有 **12 个变体**：`pan`、`marquee`、`move`、`resize`、
`segment-resize`、`rotate`、`guide-create`、`guide-move`、`paint`、`paint-sample`、`path`、
`draw`；另有两个只存在于 React 层的会话——`text-edit` 与 `drilldown`（它们不在引擎里）。
`path` 就是动画模式的运动路径编辑。

**抽取顺序必须严格按优先级自上而下**，不能按「缠绕程度从低到高」——这条是踩坑之后改正的，
理由是硬的：

> legacy 单体插件的 claim 在 `begin()` 未产生手势时一律返回 `consumed`，因此它**必须始终排在
> 最后**（优先级 0）。于是任何仍留在 legacy 里的分支，其**实际**优先级都是 0。抽出一个优先级
> 为 p 的分支，就等于把它提到所有未抽取分支之前；只要存在优先级高于 p 且尚未抽取的分支，
> 顺序就发生了反转。

第一次抽取 `pan`(1700) 时正是这样翻车的：`text-edit-guard`(1800) 仍在 legacy 里，于是编辑态下
按中键绕过守卫——不仅会开始平移，编辑会话还再也退不出去。修复方式是把守卫也抽成插件
（`fix-stage-extraction-order`），并加了两条回归用例与一条**前缀不变量**测试：已抽取集合必须
是优先级表的前缀，出现空洞即失败。

因此实际顺序就是优先级表的顺序：
`text-edit-guard` ✅ → `pan` ✅ → `rotate-tool` ✅ → `paint-sample` ✅ → `path` ✅ → `paint` ✅
→ `segment-resize` ✅ → `marquee-tool` ✅ → `draw` ✅ → `move-axis` ✅ → `marquee-converge` ✅
→ `entity-select-move` ✅ → `resize` ✅ → `legacy-rotate-hit` → `guide-create` → `guide-move`
→ `rotate-tool-fallback` → `marquee-fallback`。

注意 `marquee` 的三个入口分散在 1100 / 800 / 100，中间夹着 draw、resize、guide 等，
**不能作为一个插件一次抽完**：它必须是三个共享同一会话工厂的插件，各自在自己的位次落地。

每搬一个，legacy 巨插件瘦一圈，对应测试转为插件纯状态机测试
（`interaction-controller.test.ts` 2225 行由此自然散成十来个小文件）。
**门槛**：每步 e2e 绿、legacy 行数单调递减、前缀不变量测试通过。

**已完成：`text-edit-guard`(1800) 与 `pan`(1700)**，`interaction-controller.ts` 2922 → 2879 行。

`pan`（`refactor-stage-pan-plugin`）逼出两处契约扩展：`StagePluginContext` 的只读 `snapshot`
与 `idleSnapshot()`（claim 要读跨会话存活的 `temporaryPan`），以及
`StageSessionArbiter.activePluginId()`（内核在 `temporary-pan.end` 上要区分会话种类，
而手势分类不得回流到内核）。

`text-edit-guard`（`fix-stage-extraction-order`）本是修复上述顺序反转而抽取的。它不是手势
而是级联的最高优先级前置判定，三种结果恰好各自对应契约的一态：命中编辑目标或变换手柄返回
`consumed`；编辑态下按在别处发出 `text-editing.exit` 后返回 `null`（本次按下继续交给后续
插件）；非编辑态返回 `null`。**`claim` 允许有副作用**——它本就要发 `pointer.capture`，
这里发的是退出编辑。

`rotate-tool`(1600) 是下一项，但它没法像 pan 那样直接抽：`startTransform` 是 move/resize/rotate
共用的目标解析工厂，提交分支也是三者的融合体，合计约 200 行。因此先做
两个前置：`refactor-stage-transform-helpers` ✅ 抽出提交侧纯函数
（`resolveTransformTargets` / `planTransformCommit`），`refactor-stage-transform-preview` ✅
把预览几何（`transformedSelection` 及其依赖链）移出 controller——插件导入私有函数会构成运行时
循环。随后 `refactor-stage-rotate-plugin` ✅ 落地插件本体。

`interaction-controller.ts` 至此 2879 → 2509 行。rotate 又暴露契约两处缺口：
`StageSession.cancel` 需要接收 ctx（会话发布过快照、捕获过指针，取消时必须自己还原——
**pan 也有同一问题**，取消后快照会停在 `pan` phase），以及 `isCompatibleWith` +
`arbiter.revalidate`：并发文档变化中止空间手势原本靠内核枚举 `gesture.type`，会话进插件后
必须由会话自己判断。

`paint-sample`(1500) ✅ 随后落地：它的接管条件与命中类型无关（采样期间任何位置按下都是一次
采样），因此挡在其后所有按命中判定的插件之前，抽取顺序上必须早做。`interaction-controller.ts`
2500 → 2385 行。

两个洞随后被 `fix-stage-plugin-extraction-guards` 补上，都是抽取过程中静默产生的：
rotate 的 `isCompatibleWith` 只比了选区，丢掉了基线规范要求的「并发文档或布局变化中止空间
手势」——危害不在交互期，预览照常跟随指针，只有落库的角度是绕过期中心算出来的；而
`extraction-order.test.ts` 里的「已抽取集合」是手抄字面量，停在两项没跟上 rotate 与
paint-sample，守卫看着还在、其实早已不检查新插件。

由此立了两条**长期机制**：`captureStageSpatialBaseline` 承载「并发中止」判据，按**是否持有
冻结几何**划分而不是按「有没有提到 Entity」——旋转中心、外接盒、起点局部坐标这类接管当刻
算好、之后不再重算的量必须绑文档恒等，而每帧重新求值的取色刻意不绑；
`STAGE_EXTRACTED_PLUGIN_FACTORIES` 成为已抽取插件的唯一登记处，controller 与顺序不变量
测试共用它，新增插件不可能只改一处。

`path`(1400) ✅ 是第一个**中断时必须主动向宿主发效果**的会话：路径几何住在宿主的本地预览里，
引擎既不产 Patch 也不缓存几何，手势被打断时不显式发一次 `path.change` `phase: 'cancel'`，
宿主的预览就永远停在半途。抽取前这条通知挂在 legacy 的 `reset()` 里——那是中止手势的唯一
漏斗，却有一半调用点在指针生命周期之外；会话化之后它落到 `cancel(ctx)`，由会话自己还原
自己发布过的东西。`interaction-controller.ts` 2385 → 2271 行。

`paint`(1300) ✅ 顺带消掉一处**已经存在的重复**：`paint-sample` 抽取时把「世界坐标 → Paint
归一化局部坐标」的换算原样内联进了 `samplePaintAt`，与 controller 里的 `paintAtLocalPoint`
是同一段逆世界矩阵除以 resolved 尺寸。paint 需要同一段换算，不提取就会变成三份，于是它连同
`updatePaintFromPointer` 一起进了 `paint-geometry.ts`。**判断留还是走的标准是「属于手势还是
属于快照派生」**：`paintHandlesFor` 同样是 Paint 几何，但它算的是派生字段，因此留在 controller。
`interaction-controller.ts` 2271 → 2145 行。

`segment-resize`(1200) ✅ 是第一个需要**吸附求解**的会话：端点拖动复用 `snapResizePoint` 的
smart/grid 规则，候选来自 `index.snapCandidates`，而候选作用域要按活动 Frame 求解。这条链原本
靠 controller 的私有 `targetFrameId` 闭包拿到，插件里改为直接调用 `resolveTargetFrameId`——
同一个纯函数，只是不再经过闭包。`move`(700) 与 `resize`(600) 走同一条链，这刀先把路探通。
`interaction-controller.ts` 2145 → 2053 行。

`marquee-tool`(1100) ✅ 是第一刀**不能一次抽完**的手势。框选有三个入口，分散在 1100 / 800 /
100，中间夹着 draw(1000)、move-axis(900)、entity-select-move(700)、resize(600)、guide(400/300)、
rotate-fallback(200) 六类仍在 legacy 里的分支；把 800 提到 legacy(0) 之前就等于把它插到了
draw(1000) 前面，前缀不变量会当场失败。

处理办法是**先建共享件、再逐个入口落位**：`createStageMarqueeSession` 与 `claimStageMarquee`
承载「接管之后的全部行为」，三个入口只在何时接管上不同，差异收敛成 `originEntityId` 一个参数。
这一刀只把 1100 那个入口挪进插件，legacy 的 marquee 分支照旧留着给 800 与 100 用——但它的
`finish` 改调新的 `resolveMarqueeCommit`，因此**不存在两份提交实现**。这是绞杀式重构里
"一个手势跨多刀"的标准形状：共享件先行，入口逐个搬，任何时刻都只有一份实现。

同时把两个通用件提了上来：`rectFromPoints` 从 controller 私有函数进 `geometry.ts`（draw 与
resize 抽取时同样要用），起框容器及其祖先的排除从 `finish` 进 `marquee-selection.ts`——那段
逻辑属于提交语义，不属于 legacy。`interaction-controller.ts` 2053 → 2007 行。

`draw`(1000) ✅ 是内核里**唯一一个不该被并发文档变化打断**的手势。这条例外此前写死在
controller 的 `spatialGesture = gesture.type !== 'draw'` 上；绘制搬进插件、会话自己声明
「只比 tool、不接空间基线」之后，legacy 里只剩引用 Entity 的空间手势，这个按手势种类分类的
判定**整体消失**了。例外跟着它的手势一起走，正是插件化要达到的效果——判据回到唯一知道它的
那个会话手里。`interaction-controller.ts` 2007 → 1872 行。

这一刀还补了个教训：上一刀（marquee）的最终门槛漏跑了 `bun run typecheck`，测试文件里一个
`hit: Record<string, unknown>` 因此带着 6 个类型错误合进了 main。`bun run build` 不检查测试
文件，`test`/`e2e` 也不会失败，所以只有 typecheck 能拦住它。**五道门槛缺一不可，且必须在最后
一起跑一遍**——中途跑过不算数。

`move-axis`(900) 无法直接抽：它与 `entity-select-move`(700)、`resize`(600) 共用
`startTransform` 工厂，移动会话的推进（吸附 + 落点求解）与提交（reparent batch / 纯几何）
合计约 120 行。这是 rotate 那一轮走过的形状，因此同样拆成两步。

第一步 `refactor-stage-move-planning` ✅ 已落地：`planMovePreview` / `planMoveCommit` /
`resolveCommittableDropTarget` 三个纯函数进 `move-planning.ts`，`finish` 里原本的两条 move
分支合并成一个入口，controller 随之卸掉七个导入。**不引入插件、不改变行为**——legacy 照常
工作，只是把求解交出去。移动和 marquee 一样有多个入口，所以这些纯函数从第一天就要能被
legacy 与将来的插件同时调用，否则吸附与落点规则会分叉成两份。
`interaction-controller.ts` 1872 → 1783 行。

抽的过程里顺手把一个裸阈值 `< 2` 变成具名常量并写明它按**屏幕**像素判定（所以要乘 zoom）——
缩小视图下同样的世界位移在屏幕上更小，这一点原先只能从乘法里反推。

第二步 `refactor-stage-move-axis-plugin` ✅ 落地了共享 move 会话工厂与 900 入口，并解决了
上面预判的那个缺口——但解法比预判的更好。

预判是「内核改用 `activePluginId()` 判定」。真做的时候发现那等于让内核维护一份移动插件 id
列表：手势知识重新塞回内核，而且每新增一个移动入口就要改内核一次。改成**会话自报**：
`StageSession.consumesTemporaryPan` + `arbiter.activeSessionConsumesTemporaryPan()`。内核只问
「你接管 Space 吗」，不问「你是谁」。这是继 `isCompatibleWith` 之后第二次把判据从内核的枚举
搬回会话自己手里，形状完全一致。

缺口是**验证过**的，不是推演：临时去掉修复后 9 条用例里有 2 条当场失败（Space 切了
temporaryPan 标志、落点没被锁掉），复原后全绿。后果正是 AGENTS.md 点名要防的那类——动画模式
下拖拽失去父级锁定，对象被静默挂进激活场景、打点串进别块场景的动画。
`interaction-controller.ts` 1783 → 1776 行（删得少是因为 `startTransform` 还要留给 700 与 600）。

`marquee-converge`(800) ✅ 印证了上一轮那个决定的价值：因为共享会话工厂已经建好，这一刀
**只需搬接管条件**——`shouldConvergeToMarquee` 迁进 `marquee-plugin.ts` 与 1100 入口同住，
两个入口共用同一个 `claimStageMarquee`，差异仍然只是 `originEntityId` 一个参数。
`interaction-controller.ts` 1776 → 1718 行。

顺手删掉了 `isTopLevelEntity`。它只有一行 `rootIds.includes()`，独立存在时反而把「顶层判定
必须与标题标签的渲染范围一致」这条真正的约束推远了；内联之后约束就写在调用处。**一行函数的
名字不构成抽象**，只有约束才是。

写测试时踩了个夹具坑，值得记：`document()` 会把传入的 Entity 全包进一个根 Frame，所以
`document.rootIds` 永远是 `[frame-root]`。第一版夹具让 `box` 当顶层容器，实际它是嵌套的，
收敛判定正确地返回 false，用例落到 `move` 手势上。**v7 的「顶层容器」就是场景本身**——这不是
测试的技术细节，而是收敛这条规则的适用范围。修正后判定的防御性分支（Group、空容器、嵌套、
不存在）经 controller 已不可达，改用导出的纯函数直接单测。

`entity-select-move`(700) ✅ 复用 `claimStageMove`，接管条件本身是一棵决策树：先改选区，
再按工具与目标状态决定这次按下变成原地文字编辑、移动手势、还是仅仅改选区。三条出口一律
`consumed`——选区已经改过了，再交给后续插件会让同一次按下既改选区又起框。

它顺带**清空了 legacy 的整套移动机制**：`startTransform('move', …)` 至此再无调用者，于是
`Gesture` 的 move 变体、update / finish 的 move 分支、legacy 会话里 move 专属的 Space 处理、
并发中止里的 move 判定全部成为死代码。`startTransform` 收窄成只服务缩放的 `startResize`，
内核的 temporary-pan 分派也不必再问 legacy 的 `gesture`，只问会话的 `consumesTemporaryPan`。
**上一刀加的契约在这一刀才真正取代掉旧路径**——这是绞杀式重构的常态：新路先通，旧路等最后一个
调用者消失才拆。`interaction-controller.ts` 1718 → 1592 行。

### 一处被这一刀暴露的既有缺口：副按键

e2e 报「节点层级操作」失败——右键不再弹出上下文菜单。根因不在新代码，而在**抽取模型本身**：
`event.button > 1` 是 legacy `begin()` 顶部的一道总闸，而插件排在 legacy **之前**被询问，
**从第一个插件落地起就绕过了它**。此前没暴露，只因已抽取插件接管的命中类型恰好没被右键点过——
`entity` 是第一个。

修法是把判定放回唯一正确的位置：controller 询问插件之前。放进各插件既会漏、又要每个新插件
重复一遍；放进仲裁器则等于让内核认识鼠标按键语义。

**这类缺口有个共同形状**：legacy 单体在级联顶部设的"总闸"，抽取时不会自动跟着任何一个分支
走，因为它不属于任何分支。已知的总闸目前只剩 `!context || !index || !surface` 这一条，它由
`pluginContext` 的取值器抛错兜住。后续每刀都该先问一句：这个分支之上还有没有没搬走的总闸。

`resize`(600) ✅ 是 legacy 最后一个变换会话。抽完之后 `startTransform` 这一族工厂、`Gesture`
的全部变换变体、以及并发中止里的 `gestureIds` / `sameIds` 同时消失——判定退化成上下文三项恒等：
**所有引用具体 Entity 的手势都已插件化，各自用 `isCompatibleWith` 自报是否仍然成立**。
`interaction-controller.ts` 1592 → 1488 行。

legacy 至此只剩 marquee 的两个尾部入口与两个 guide 手势，全都不引用选区。

下一刀是 `legacy-rotate-hit`(500)、`guide-create`(400)、`guide-move`(300)、
`rotate-tool-fallback`(200)、`marquee-fallback`(100)。

### 步骤 4 · Overlay 拆分 — `refactor-stage-overlay-slots`

落地 Overlay Registry 与 OverlayContribution；`stage-overlay.tsx` 按 slot 拆分，
渲染结果逐像素对照黄金图。**门槛**：黄金图零差异。

### 步骤 5 · 删除 legacy · 收敛适配层 — `refactor-stage-adapter-slimming`

`compose-stage.tsx` 收敛到适配层（目标 < 600 行）；动画模式改为组装 policy + `motion-path`
插件，`lockGestureParent` prop 删除（**BREAKING**，随本步声明）。
**门槛**：lint / typecheck / test / build / e2e 全绿。

## 风险

- **引用稳定是性能生命线**。现有代码用两层 memo 保证隐藏集合、场景子树与 SceneIndex 的
  引用只在内容变化时更新；插件化的快照派生必须继承同样纪律，否则平移每帧重建整棵场景。
- **缠绕最深的两处放最后**。`resize` 的实时布局预览（预览 Snapshot 不进提交上下文）与
  `text-edit` 的 ref 会话（每键不重渲）都有注释明示的性能契约，搬迁时逐字保留。

## 明确不做

- 渲染层插件化、面向宿主的第三方插件市场。
- 任何「为 CAD 留口子」的设计。CAD 是命令解释器范式（多步命令状态机 + 对象捕捉 +
  坐标键入），另建内核；与本重构共享的只有视口数学与拆封后的事务内核。

## 与其它工作的关系

三条轨道相互正交，可并行推进：

1. **CAD 轨道**：`refactor-transaction-kernel`（把 `validateComposeDocument` 从
   `runtime.ts` 的 4 处硬调用改为注入，体量最小、风险最低）→ 文档类型注册 → CAD 文档协议
   与几何内核。是 CAD 的硬前置，与本路线图无依赖关系。
2. **本路线图**：Stage 交互层插件化。
3. **文件瘦身**：仅限「抽屉太满」型文件——`property-tree.tsx`（2210 行 / 44 个顶层定义，
   平均 50 行的独立小编辑器）、`compose-paint-picker.tsx`、`compose-asset-browser.tsx`。
   机械拆分即可，低风险，随时可做。

**不要先瘦身架构债文件**（`compose-stage.tsx`、`interaction-controller.ts`、
`stage-overlay.tsx`、`compose-editor.tsx`、`editor-controller/controller.tsx`）：机械瘦身
沿「哪些纯函数好抽出去」切，插件化沿「哪个手势是可替换单元」切，切割线不同，先切一次
等于同一块代码付两次钱，且中间态没有消费方。

**不要先动测试文件**：`interaction-controller.test.ts` 2225 行是本重构敢动手的唯一依据，
它会在步骤 3 中免费瘦身。行数从来不是问题本身——`editor-i18n.ts` 923 行是扁平文案目录，
5 个定义，完全正常；耦合才是判据。
