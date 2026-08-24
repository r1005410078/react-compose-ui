# 拆除旧世界

## Why

12a 之后 DXF 已经通向页面，`CadDocument` 那套壳里剩下的东西页面这边**各有对应物**：曲线
（8a/8b）、几何编辑（10）、端口（11a）、导线（11b）、命令行（7）、点输入管线与捕捉（9 与
既有 `core`）。壳本身现在只提供一件事——**第二个世界**：第二套文档协议、第二套选择语义、
第二个标签种类、第二块画布。决策 1 从一开始就说了要删。

留着的代价不是那 15000 行本身，是**每一条新判断都要问「CAD 那边怎么办」**：捕捉次序、
整圆的表示、矩形的表示、文字的命中、十字光标的形态推导，全部以「与 CAD 一字不差」的形式
写在规范与注释里。这条隐性税会一直收下去。

这一刀与 12a 的风险方向相反：那一半是新增一条可验证的路径，这一半是**删掉一万五千行而不许
有任何行为变化**。

## What Changes

- **BREAKING** 删除 `@compose-ui/cad`（7283 实现 + 4265 测试）与 `@compose-ui/cad-canvas`
  （2220 + 1453）两个包，以及 `CadDocument` 协议、`.cad.json` 持久化、CAD 标签页、CAD 命令集
  与 CAD 侧的 DXF 映射层。
- **BREAKING** 编辑器不再有第四种文档标签。`packages/editor/src/cad/` 整目录删除，
  `compose-editor.tsx`、`workspace-context.tsx`、`workspace-layout.ts`、`workspace-panels.tsx`、
  `use-edge-collapse.ts` 与 `editor-i18n.ts` 的 CAD 接线逐点摘除。
- **新增曲线的 `strokeDashoffset` Renderer prop**（决策 A）。这是路线图里唯一一项承诺「变形
  存活」而尚未落地的能力：`FLOW` 的页面对应物是「虚线偏移的外观轨道」，而曲线今天没有那个
  属性。轨道路径 `['Renderer','props','strokeDashoffset']` 白拿——采样器只按
  `[componentKey, ...rest]` 写值，动画引擎一行不改。
- **不移植 `FLOW` 命令**（决策 A 的另一半）：命令要算一个完整虚线周期，而页面这边的
  `strokeDasharray` 是由线宽推出的 picklist，正是「待修的缺陷」里那条**单位错配**。把周期
  算进一条命令的语义等于把已知缺陷固化。属性给到位，能力就是可表达的；命令等单位修好再说。
- **四个无消费者的几何函数与 CAD 文字度量随包一起删**（决策 B）：`segmentIntersection` /
  `segmentCrossesBounds` / `segmentWithinBounds` / `boundsFromPoints` 与
  `CAD_TEXT_*_RATIO` / `cadTextBounds` 系列。core 里没有对应物，页面这边一个消费者都没有。
- **规范收敛**：删除 `cad-document` 能力（62 条 Requirement）；`editor-workspace-layout`
  删除「CAD 文档标签」；把 5 条以 CAD 为**理由出处**的 Requirement 就地内化（决策 D）。
- **AGENTS.md 与路线图重写**：约 30 行以「与 CAD 一字不差」「与 `cad` 侧同一条判定」作为
  论证出处的规则，改成那条判断自己的论证。

## Non-Goals

- **不改页面世界的任何行为。**这一刀的验收标准是既有 129 条 e2e 与全部组件测试在删除前后
  逐条同结果。新增的 `strokeDashoffset` 默认 0，缺席即不偏移，因此既有文档逐像素不变。
- **不移植六条 CAD-only 命令**（决策 C）：`BLOCK`/`INSERT`、`PORT`、`COLOR`/`LWEIGHT`/`LTYPE`、
  `TEXT`。能力全都有页面对应物（组件库、端口 Inspector、外观 Inspector、`draw-text` 工具），
  缺的只是「能敲的那个词」。这是有意接受，不是漏删。
- **不合并变成单消费者的三处抽象**（决策 E）：`canvas-kit`、`interaction-kernel` 与
  `components` 的命令行 Pattern 在 CAD 走后各只剩一个消费者。它们留在原处，只重写论证。
- **不写迁移器**（既有判断，决策 6）：没有线上 `.cad.json` 资产。
- **不修虚线单位错配**。它在「待修的缺陷」里独立立项，改动会影响既有虚线曲线的外观。
- **不动 `applyComposeAnimationAtTime` 的泛型签名**。放宽的类型参数在单一消费者下依然正确，
  收窄它是纯 churn。

## Impact

- 包：删 `cad`、`cad-canvas`；改 `editor`、`materials`
- Specs：删 `cad-document`（REMOVED 62）；改 `editor-workspace-layout`（REMOVED 1 + MODIFIED 1）、
  `basic-materials`（ADDED 1）、`stage`（MODIFIED 1）、`stage-engine`（MODIFIED 1）、
  `commands`（MODIFIED 1）、`compose-document`（MODIFIED 1）、`canvas-kit`（MODIFIED 1）、
  `components`（MODIFIED 1）
- 测试：删 18 条 CAD e2e（`e2e/editor-workspace.spec.ts` 尾部 1147 行）。**无 CAD 黄金图**
- 破坏性：`@compose-ui/cad` 与 `@compose-ui/cad-canvas` 两个公开包消失，`.cad.json` 不再可打开
