# Tasks

## 1. 先立基线（删除类变更的「先验红」）

- [x] 1.1 在删除前跑一轮完整 `bun run test:e2e`，把 147 条的名称与结果存成基线文件。删完
      之后要能逐条比对到「129 条同结果 + 18 条消失」，而不是只看总数。
      **实测：146 passed + 1 flaky**（`drafting-chrome.spec.ts:47` 的 `boundingBox()` 在并行
      负载下返回 null；单跑绿）。基线因此是「146 绿 + 1 已知抖动」，不是全绿
- [x] 1.2 新增一条曲线用例断言**不写 `strokeDashoffset` 的曲线渲染输出与今天一致**（先跑确认
      绿，它是决策 A 的回归护栏，不是新能力的验证）

## 2. 决策 A：曲线的虚线偏移

- [x] 2.1 `CURVE_RENDERER_PROP_SCHEMAS` 加 `strokeDashoffset`（数值，默认 0），renderer 写
      `strokeDashoffset`；缺席即不偏移
- [x] 2.2 Inspector 与绑定 Contract 跟上既有三项描边属性的做法，不另开分组
- [x] 2.3 Vitest：默认值缺席时输出不含该属性；写入非零时输出跟随
- [x] 2.4 e2e：给一条虚线曲线的 `['Renderer','props','strokeDashoffset']` 打两个关键帧，
      播放时图案沿线移动。**这条是 `FLOW` 承诺的实际兑现**，必须在删除 CAD **之前**就绿

## 2b. 实现时才浮现

- [x] 2b.1 **属性到位不等于能力可达**：动画菱形的白名单 `ANIMATABLE_FIELDS` 只认 5 个几何/
      外观字段，而 Renderer 分组**根本没拿到** `renderFieldAdornment`——不补这两处，
      `strokeDashoffset` 是一个用户永远打不了点的属性，决策 A 的承诺就是空的。补法是既有机制
      各加一条：分组传装饰、白名单加条目
- [x] 2b.2 自动记录同样只认 `setTransform`/`updateComponent`/`setAppearance`。少了
      `setRendererProps`，动画模式下改虚线偏移会写成**静态值**——菱形在、改值却不进关键帧，
      这是白名单里唯一一个这样的字段。Renderer props 是**开放**记录，因此改写按白名单逐条
      放行，不能照抄 Appearance 的「除这几个之外都不许变」
- [x] 2b.3 时间线轨道名走 `animationPropertyLabel` 的路径→文案表，不加就显示成
      `Renderer.props.strokeDashoffset`

## 3. 摘除编辑器接线（类型先行）

- [x] 3.1 先从 `ComposeWorkspaceDocumentSession` 的 `kind` 联合去掉 `'cad'`，跑 `typecheck`
      收集全部落点——靠类型报错而不是 grep 找接线
- [x] 3.2 删 `packages/editor/src/cad/`（4 文件 387 行）
- [x] 3.3 摘 `compose-editor.tsx` 的 CAD 会话、`updateCadDocument`、`openCadDocument`、
      `cadNotice` 与 `resolvedHistory` 里的 CAD 分支
- [x] 3.4 摘 `workspace-layout.ts` 的 `cadDocument` panel 种类与 `compose-cad-document:` 前缀、
      `workspace-panels.tsx` 的映射项、`workspace-layout/index.ts` 的转导
- [x] 3.5 `use-edge-collapse.ts` 去掉 `cad` 初值。**机制留着**（决策 E 同一条判断）：删掉
      per-kind 记忆会让面板状态在标签种类之间串台，那是一次与 CAD 无关的行为变化
- [x] 3.6 `editor-i18n.ts` 删中英两处 `cad` 文案块与聚合
- [x] 3.7 `editor/package.json` 与 `editor/vite.config.ts` 去掉两条依赖与两条 external

## 4. 删包

- [x] 4.1 删 `packages/cad-canvas/`（先删它——它依赖 `cad`，反过来会让中间态编译不过）
- [x] 4.2 删 `packages/cad/`
- [x] 4.3 根 `package.json` 的 `pack:dry-run` 链去掉两项
- [x] 4.4 确认 `packages/dxf/` 自带的分词与诊断完整，`importDxfDocument` 随包消失后无人受影响

## 5. 删测试

- [x] 5.1 删 `e2e/editor-workspace.spec.ts` 尾部 18 条 CAD 用例（1116 行起至文件末）
- [x] 5.2 确认 `e2e/__screenshots__/` 无 CAD 黄金图需要清理（实测：无）
- [x] 5.3 `canvas-kit` 与 `interaction-kernel` 的边界用例去掉对 `cad` 的断言——断言一个不存在
      的包不会被依赖读不出意图

## 6. 决策 D：把论证内化

- [x] 6.1 规范：5 条以 CAD 为论证出处的 Requirement 改写（`stage` 十字光标与拾取框、
      `stage-engine` 端口捕捉优先级、`commands` 拒绝不结束会话、`compose-document` 共享点输入
      管线、`canvas-kit` 包边界）
- [x] 6.2 AGENTS.md：约 30 行改写。**判据是「删掉对照方之后这句话还成立吗」**——不成立的补上
      本来的理由，成立的只删对照
- [x] 6.3 AGENTS.md 删 `cad`、`cad-canvas` 两段架构边界；`canvas-kit`、`interaction-kernel`、
      `components` 命令行三段的论证按决策 E 改写，并写明消费者减少不追溯地让当初的抽取变成错误
- [x] 6.4 源码注释约 40 处同一判据处理。**不许保留指向已删包的「与 `cad` 侧一字不差」**
- [x] 6.5 README：确认无 CAD 段落需要改（实测：零命中）

## 7. 规范增量

- [x] 7.1 `cad-document` 能力整体删除，62 条逐条列出并各指向它的页面对应物。
      **归档时才发现工具没有这个出口**：把一个能力的全部 Requirement 都 REMOVED 之后，
      `openspec archive` 拒绝写出零 Requirement 的规范（「Spec must have at least one
      requirement」）并整刀中止。改为直接删除 `openspec/specs/cad-document/`，清单挪到
      `removed-cad-document.md` 保留——它是「删得干不干净」的检查表，不该随中止一起丢掉。
      另：那次中止**并非无副作用**，`basic-materials` 的 ADDED 已经落盘而输出仍打印
      「Aborted. No files were changed.」，重跑会撞上「already exists」
- [x] 7.2 `editor-workspace-layout`：REMOVED「CAD 文档标签」+ MODIFIED「边缘面板按文档类型
      记忆展开状态」
- [x] 7.3 `basic-materials`：ADDED 曲线虚线偏移
- [x] 7.4 路线图：步骤 12b 回填实测，删掉「下一步就是最后一步」那段，把四个已排除项写进
      「未定的决策」或「待修的缺陷」各自归属

## 7b. 实现时才浮现（删除侧）

- [x] 7b.1 `eslint-disable-next-line react-hooks/refs` 的位置会随邻居一起失效：CAD 那条
      `useMemo` 删掉后，同一条规则改报在 DXF 的 `useMemo` 上，而 DXF 那条的 disable 写在
      **函数体内**，覆盖不到。指令的作用域是**下一行**，删掉一个受它保护的兄弟节点足以让它
      同时变成「未使用」和「没盖住」
- [x] 7b.2 `StageSelectionMode` 的 `'accumulate'` 在 CAD 走后**没有第一方调用点**，只剩
      测试在用。它是宿主受控的公共 API 值，删它是另一次破坏性变更，**不在本刀范围**；
      注释改成「AutoCAD 语义，第一方不使用，留给宿主」并留待立项
- [x] 7b.3 `e2e/drafting-chrome.spec.ts` 有一处**先于本刀存在**的抖动：`toBeVisible()` 之后
      紧跟 `boundingBox()` 仍会读到 null（编辑器挂载后 Stage 还按量到的 surface 尺寸重排
      一次）。在**未改动的主干**上隔离运行六次抖两次，因此与删除 CAD 无关。顺手修掉——
      把读取放进 poll 里，否则这一刀的验收门永远是红的，「没有行为变化」就无从证明

## 8. 五道门

- [x] 8.1 `bun run lint`
- [x] 8.2 `bun run typecheck`
- [x] 8.3 `bun run test`
- [x] 8.4 `bun run build`
- [x] 8.5 `bun run test:e2e` —— 与 1.1 的基线逐条比对（`comm` 逐名核对）：既有 129 条同结果、
      18 条 CAD 用例消失、2.4 新增的 1 条通过，合计 130。**0 条从「通过」变成「通过但断言
      不同」**。修掉 7b.3 的既有抖动后连跑两轮 130/130 全绿
