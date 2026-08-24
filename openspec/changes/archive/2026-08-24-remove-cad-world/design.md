## 上下文

`docs/drafting-unification-roadmap.md` 的步骤 12b，也是这条路线的最后一步。决策 1（没有第二个
世界）在 2026-08-23 定下，前置条件是步骤 8（词汇齐）与 11（端口导线有页面对应物），两者都已
交付。

删除范围实测（源码级，非估计）：

| 目标 | 量 | 外部消费者 |
| --- | --- | --- |
| `packages/cad/` | 7283 实现 + 4265 测试 | 只有 `cad-canvas` 与 `editor` |
| `packages/cad-canvas/` | 2220 实现 + 1453 测试 | 只有 `editor` |
| `packages/editor/src/cad/` | 387 行 / 4 文件 | — |
| CAD e2e | 18 条 / 1147 行，正好是 `editor-workspace.spec.ts` 尾部 | 无黄金图 |
| `cad-document` 规范 | 1592 行 / 62 条 Requirement | — |

`importDxfDocument` 现在**只有它自己的测试在调用**（12a 的预判成立），`packages/dxf/` 已自带
一份分词与诊断，因此删掉 `cad/src/dxf/` 之后那份重复自动消解。

## 目标/非目标

- 目标：删掉第二个世界，且页面世界**逐条行为不变**。
- 目标：把以 CAD 为论证出处的规则**就地内化**，而不是简单删掉引用。
- 非目标：不改进页面世界（除了决策 A 那一个属性）、不修虚线单位、不合并单消费者抽象。

## 决策

### A. `FLOW` 的页面对应物：给属性，不给命令

路线图把 `FLOW → 曲线外观轨道` 记为「变形存活」，但曲线的 Renderer props 只有
`strokeDasharray`（`packages/materials/src/curve/props.ts:19`），**没有 `strokeDashoffset`**。
删除 CAD 时若不补，这条承诺就变成静默的能力丢失——而「让导线看起来在流动」是接线图里
用户会去找的东西。

- **加**一个 `strokeDashoffset` 数值 prop。采样器按 `[componentKey, ...rest]` 写值
  （`packages/animation/src/animation-sampler.ts:154`），`['Renderer','props','strokeDashoffset']`
  因此白拿关键帧、绑定与 Inspector，动画引擎与协议一行不改。默认 0、缺席即不偏移，既有文档
  逐像素不变。
- **不加** `FLOW` 命令。它一次做两件事——补线型、按**一个完整虚线周期**建轨道，而周期要从
  dash pattern 求和得到。页面这边的 `strokeDasharray` 是 picklist、实际写成 `线宽*4 线宽*2`，
  正是「待修的缺陷」里那条单位错配（线宽已是屏幕像素，虚线间隔是世界量）。把这个周期算进
  命令语义，等于让一条新命令的正确性依赖一个已知错的推导。
- 考虑过的替代：一并移植 `FLOW`、顺手修单位。否决——单位修复会改变**既有**虚线曲线的外观，
  而这一刀的验收标准是「没有行为变化」。两件事放进同一刀，任何一条 e2e 变红都分不清是哪半边。

### B. 无消费者的几何函数随包一起删

`cad-segment-geometry.ts` 里有四个 core 没有对应物的真实现——`segmentIntersection`、
`segmentCrossesBounds`、`segmentWithinBounds`、`boundsFromPoints`；`cad-text-geometry.ts` 里
是整套 CAD 文字度量（`CAD_TEXT_ADVANCE_RATIO` 等三个比例与包围盒/命中）。路线图那句「全部
几何数学原样存活」在这几个上**不成立**。

- **删**，不下沉。判据沿用端口那条既有判断：没有消费者的东西不进协议。页面的框选走盒
  （`marquee-selection.ts` 的判定单位是 `StageRect`），文字度量由 DOM 真量。
- 真要做曲线的距离式交叉框选时，重推这三十行比养一个没人调用的模块便宜，git 里也还在。
- 弧、多段线、点到线段距离、紧包围盒、拍扁这些**有**页面消费者的，早在步骤 8 就住进
  `core/curve-geometry.ts` 了，本刀不动。

### C. 六条 CAD-only 命令不移植

| CAD 命令 | 页面对应物 | 缺的是什么 |
| --- | --- | --- |
| `BLOCK` / `INSERT` | 组件库：从选区创建组件 / 插入实例 | 只缺「能敲的那个词」 |
| `PORT` | `Ports` Component 与端口 Inspector | 同上 |
| `COLOR` / `LWEIGHT` / `LTYPE` | 曲线描边 Inspector | 同上 |
| `TEXT` | `draw-text` 工具（步骤 4b 已判定作废） | 无 |

能力全在，缺的只是命令行入口。**有意接受**并写进提案，否则以后会被当成漏删而有人去补一批
与既有入口重复的命令——决策 8「一套物料一个概念」的推论正是「一个动作一个入口」。真要补
时那是「给既有动作加 descriptor」，不是这一刀的事。

### D. 以 CAD 为论证出处的规则要内化，不能只删引用

规范里有 5 条 Requirement、AGENTS.md 里约 30 行、源码注释里约 40 处，把「CAD 那边也这样」
当作**论证本身**：捕捉次序 `port > endpoint > midpoint > center > quadrant`、整圆是扫掠 ±360
的弧、矩形是四顶点闭合多段线、文字按盒命中、十字光标空闲不画。

这些判断**仍然正确**，但论证的出处即将不存在。只删引用会让它们退化成「不知为何如此」的
规则，下一个人有正当理由去改。因此每一处都改写成**那条判断自己的论证**：

- 捕捉次序 → 端口几乎总画在符号线段的端点上，端点若在同等距离胜出，用户会画出一条像素级
  正确但**没有绑定**的导线，而这个错误在屏幕上完全不可见。（理由本来就在，只是挂在 CAD 上）
- 整圆 / 矩形不另立类型 → 归一化、平移、距离、特征点、渲染、校验六条路径各少一支逐字相同的
  实现。
- 十字光标空闲不画 → 页面编辑器的静息光标是箭头。（原文写成「与 CAD 刻意的不对称」，删掉
  对照方之后这句就是全部理由）
- Stage 拾取框不参与命中 → Stage 的点选是 DOM 驱动的，容差散在各物料的 stroke 宽度里，没有
  全局的那个数。规范写明这一条，避免后来者去找一个不存在的容差。

### E. 三处「为两块画布而共享」的抽象在 CAD 走后只剩一个消费者——留着

| 抽象 | 抽取时的理由 | CAD 走后 |
| --- | --- | --- |
| `@compose-ui/canvas-kit` | 两块画布共用视口底座 | 只有 `stage` |
| `@compose-ui/interaction-kernel` | 两套手势共用仲裁器 | 只有 `stage-engine` |
| `components` 的命令行 Pattern | 两块画布共用命令行 | 只有 `stage` |

三者**都留在原处**，只重写论证：从「两块画布共用」改成「无文档语义的分层」——它们的边界
用例（不认识文档、不认识选择集）仍然可执行、仍然有价值，而折回去是一次没有任何用户可见
收益的大重构，还会直接违反本刀「没有行为变化」的验收标准。

`components` 那条准入规则「已经被至少两个第一方包复用」需要一句显式说明：它挡的是**提前
抽象**，而命令行 Pattern 抽取时确有两个消费者，不是提前。消费者减少不追溯地让当初的抽取
变成错误。写下来，避免以后有人按字面把它搬回 `stage`。

`@compose-ui/commands` 不在此列：`command-panel`、`components`、`editor`、`stage`、
`stage-engine` 五个消费者与 CAD 无关。

## 风险/权衡

- **风险：删漏一处接线，编辑器在某条路径上崩。** 缓解：`editor` 的 CAD 接线是**类型驱动**的
  ——`ComposeWorkspaceDocumentSession` 的 `kind` 联合去掉 `'cad'` 之后，
  `DEFAULT_COLLAPSED`、`updateCadDocument`、`workspace-panels` 的映射表全部变成类型错误。
  先删类型，让 `typecheck` 报出全部落点，而不是靠 grep。
- **风险：以为「没有行为变化」，实际改了。** 缓解：先跑一轮完整 e2e 存基线（147 条），删完
  再跑一轮，逐条比对到 129 条通过 + 18 条消失，**不接受任何一条从通过变成通过但断言不同**。
- **风险：`strokeDashoffset` 让既有曲线动起来。** 缓解：默认 0，Inspector 默认值走既有的
  「缺席即默认」通道；用一条断言「不写该 prop 的曲线渲染输出与今天一致」钉住。
- **权衡：规范删 62 条是一次大 diff。** 接受。`openspec archive` 按 Requirement 标题匹配，
  要让 `cad-document` 能力整体消失就必须逐条列出；每条给一行「原因」并指向它的页面对应物，
  这份清单本身就是「删得干不干净」的检查表。

## 迁移计划

不写迁移器（决策 6，与删 Page Slot 同一条判断）：没有线上 `.cad.json` 资产。残留的
`.cad.json` 在资源浏览器里退化为普通 JSON 文件——可读、可编辑、不能作为 CAD 标签打开。

回滚：整刀是一次删除，`git revert` 即可。没有数据迁移，因此没有单向门。

## 待解决问题

- 无。四个待定项（虚线单位、命令行入口、单消费者抽象、顶点增删）全部已在提案里显式排除并
  各有归属。
