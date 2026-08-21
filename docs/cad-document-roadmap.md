# CAD 文档类型路线图

## 文档定位

本文是 CAD 编辑能力的**纲领性路线图**，用于串联多个 OpenSpec 变更，不代表当前已经稳定的
公共 API。每一步都是一个独立可发布、可回退的 OpenSpec 提案。与 `overview.md`、
`stage-plugin-kernel-roadmap.md` 同为指导提案的架构文档，区别是本文只覆盖 CAD 文档类型。

**当前状态：步骤 1–3 已完成。** 本文写于 2026-08-21，记录的是动手前的判断与决策，
每完成一步回填实测结果与被推翻的预判。

## 产品意图

面向实施工程师画**示意图**：网络拓扑图、一次接线图、PCB 电路原理图。编辑体验参考
AutoCAD——命令行驱动、无限图纸、对象捕捉；产物以组件实例的形式进入页面。

**这不是机械 CAD。** 三个目标场景都是 schematic，因此以下**不做**：参数化约束求解器
（平行/相切/尺寸驱动）、图纸比例与单位换算、样条与填充图案、三维。这条边界是本路线图
最重要的一条——它把「一个求解器项目」缩小成「一套图元 + 一个命令引擎 + 一个 DXF 解析器」。

## 已定的决策

| # | 决策 | 后果 |
| --- | --- | --- |
| 1 | **CAD 是独立文档类型**，在资源浏览器中新建 | 需要第四种文档 panel；不复用页面编辑范式 |
| 2 | **产物以组件实例进入页面**，可作组件也可作变体 | 与 Component Asset v2 对接；与 DXF 的 BLOCK/INSERT 天然同构 |
| 3 | **单位 px**，无图纸比例 | 免去单位换算；但 DXF 导入仍需真实坐标 → px 的 fit 变换 |
| 4 | **左右面板存在，默认收起** | 不需要新布局骨架，复用现有 Dockview 边缘组 |
| 5 | **需要 DXF 导入** | 唯一把范围拉回真 CAD 的一条；独立可并行 |

决策 1 与决策 2 不矛盾：**编辑体验**是独立文档类型 + 独立范式，**消费方式**是组件实例。
起初曾把两者混为一谈而得出「CAD 不是新文档类型」的错误结论，此处记下以免重犯。

## 未定的决策

- **「CAD 可以是组件也可以是变体」的两种读法**，两者工作量不同，很可能都要：
  - **A** · 整份 CAD 图纸 = 一个组件（页面里放一张拓扑图，变体如「机房 A / 机房 B」）
  - **B** · CAD 内画的**块/符号** = 组件（断路器、交换机，变体如闭合/断开、单极/三极）

  B 才是 DXF `BLOCK`/`INSERT` 的直接对应，也是画接线图的高频动作；A 是把成品接回页面。
  B 要求 CAD 编辑器能消费现有组件库并插入实例，A 要求组件实例能渲染 CAD 文档。
  **这个问题不阻塞步骤 1–3。**
- **图层与特性的归属**：左右面板存在意味着可以放图层树与特性表，但 AutoCAD 的正统做法是
  命令行（`LAYER` / `PROPERTIES`）。两者取舍决定 CAD 面板内部骨架。

## 从现有代码继承到的东西

Stage 插件化重构（见 `stage-plugin-kernel-roadmap.md`）的红利在这里兑现。以下均为读代码
确认，不是推测：

- **多文档类型的机制已经在跑。** 编辑器是 Dockview，已有三种文档 panel：
  `assetDocument` / `pageDocument` / `componentDocument`（`workspace-layout.ts`）。
  CAD 是第四种，走的是验证过三遍的路子。
- **左右面板的三个组件白拿。** `property-panel`、`scene-tree`、`history` 按 AGENTS.md 的
  架构边界**不得依赖 `core`**，因此文档无关，一行不改即可承载 CAD 的特性表、图层树与历史。
  当初那条边界在此兑现。
- **交互内核的契约与 AutoCAD 命令同构**：`claim → update（只写预览）→ commit（至多一个事务）`。
  CAD 工具就是这个形状。
- **线图元已有雏形**：`materials/src/shape` 有 `line` / `arrow` / `circle`，带 stroke、
  dasharray 与端点箭头；`segment-resize` 插件已在做两点端点拖拽 + 吸附求解。
- **布局未持久化**（`workspace-layout` 无 `toJSON`/`fromJSON`），因此「默认收起」只是初始化
  代码的事，不必先解决持久化。

**不继承的**：`StageInteractionContext` 焊死 `ComposeDocument` 与 `ComposeLayoutSnapshot`
（`interaction-controller.ts:249`），CAD 不复用它，自建 context。

## 目标架构

```text
CadDocument v1        复用 ECS 底座（Entity/Component/Patch/事务），换 validator 与词汇
CAD 编辑器外壳        Dockview 第四种文档 panel，左右面板默认收起
命令引擎              @compose-ui/commands（注册/解析/键位）+ CAD 的多步提示循环
CAD 画布              自建 context，复用泛型化后的仲裁器与插件注册表
图元                  CadLine / CadArc / CadPolyline / CadBlockRef / CadLayer
捕捉                  端点 / 中点 / 圆心 / 交点 + 网格 + 正交(F8) + 极轴
DXF                   解析 → 映射；BLOCK ≙ Component，INSERT ≙ Instance
```

**CadDocument 复用 ECS 底座而不另起协议。** 换的只是 Component 种类和 validator，因此
Patch 代数、事务运行时、Undo/Redo、序列化与历史面板全部复用。另起一套独立协议看着更干净，
实际是把这些各复制一遍。

## 路线

### 步骤 1 · 泛型化交互内核 — `refactor-kernel-generics` ✅

`kernel-types.ts`(158) + `session-arbiter.ts`(164) + `plugin-registry.ts`(36) 共 **358 行**
改为对 context / snapshot / effect 三个类型参数泛型。这三个文件本来就不认识文档，只是
import 了 `StageInteractionContext` 这个具体类型，改动是机械的。

CAD 由此复用仲裁器、优先级表与「注册表逐项覆盖优先级表」不变量，而不必泛型化庞大的
`StageInteractionContext`，也不必复制那 164 行来之不易的仲裁逻辑。

**无行为变化。门槛**：五道 + 黄金图 41 张逐像素一致，`interaction-controller.test.ts` 不改。

**落地要点**：用**单个类型级 profile** 而不是六个类型参数——否则每个插件、会话工厂与测试夹具
的签名都要重复六个类型。`claimEvent` 是 profile 成员而非 `Extract<event, {type:'pointer.down'}>`
推导，内核因此不假设交互由指针发起（CAD 的 `L↵` 不成立）。三个泛型文件对 Stage 类型的
import 清零，Stage 绑定与七个既有公共名称移入新的 `stage-kernel-profile.ts`，边界由
`dependency-boundary.test.ts` 守住并做过 Red 验证。

**已知残留**：仲裁器仍按 `pointerId` 判定事件归属，这是泛型内核里唯一一处指针语义泄漏。
刻意不在本步抽象成中性的会话身份——CAD 命令由 `L↵` 启动时尚无指针，首次点击才产生一个，
「绑首次点击还是绑命令调用」要等步骤 5 有真实消费者才知道，现在设计等于猜。

### 步骤 2 · 事务运行时注入 validator — `refactor-transaction-validator` ✅

`core/runtime.ts` 第 104、211、326、456 行四处硬编码 `validateComposeDocument` 改为注入，
缺省保持现有行为。非 Compose 文档由此获得事务、Patch 与 Undo/Redo。

**无行为变化。门槛**：五道全绿。

**落地要点**：泛型入口 `createDocumentTransactionRuntime` 的 `validate` **必填**，
`createTransactionRuntime` 保持原签名成为 ComposeDocument 特化。若给泛型入口一个默认校验器，
`createDocumentTransactionRuntime<CadDocument>({ document })` 会通过类型检查却在运行时用
Compose 规则去校验——这条错误路径现在在类型层就不存在。

**顺带解耦**：`createBuiltinCommandHandlers()` 的注册随之移出泛型运行时——`entity.*` 是
ComposeDocument 的命令词汇，预置给其他文档类型既是一批必然失败的 handler 又会占住 type。
`transaction.batch` 例外，它是事务原语，仍由泛型运行时内联处理。

### 步骤 3 · 命令包 — `add-commands-package` ✅

**这一刀独立于 CAD，且在第一个消费者身上就已还本。** 仓库现状是三种键位类型互不相识：
`ComposeKeybinding`(components) / `ComposeStageKeybinding`(stage) / `ComposeEditorKeybinding`(editor)；
三张动作表同样各行其是。而命令面板的 TSDoc 白纸黑字写着 `shortcut` 是
「仅用于展示的键位；面板不注册对应监听」——**它是手抄本**，与 `DEFAULT_STAGE_SHORTCUTS`
是两份数据，漂移无人能发现。CAD 命令行会是第四张表。

新建 `@compose-ui/commands`：无 React、无 DOM、**连 `core` 都不依赖**（动作是 `run(ctx)`，
引擎不认识文档），按五层模型落在 Layer 1。承载：

- **Layer 1 · 命令注册 + 解析 + 键位匹配** —— 真共享，四个消费者（命令面板检索、键盘绑定、
  右键菜单可用性、CAD 命令行）。一张表同时喂，手抄本缺陷随之消失。
- **Layer 2 · 多步提示会话协议** —— 形状通用但当前只有 CAD 消费，放同一个包（与命令定义
  分家会把一个命令劈成两半），不强求页面编辑器采用。

**不进包**：坐标语法 `100,50` / `@10,20` / `100<45` 与动态输入浮层是 CAD 专有；正交与极轴
根本不是命令而是捕捉。`EditorCommand` 也不进——它是**文档变更载荷**，与「用户动作」是两个
概念（现有 TSDoc 已点明），混入会把 `core` 依赖拖进来。

**破坏性变更**：`ComposeKeybinding` 现住在 `components`(Layer 2)，需**下沉**到 `commands`，
`components` 反向导入。这是本刀唯一触及既有公共 API 的地方。

**门槛**：五道 + 页面编辑器快捷键与命令面板行为不变。✅ 全绿，editor 262 / stage 148 项
既有测试无回归，e2e 99/99。

**核对结果修正了提案里的一处判断**：两张默认表 30 项重叠、当前取值**逐项一致**，所以这一刀
消除的是「等待漂移的重复」而不是已发生的缺陷。展开 `DEFAULT_STAGE_SHORTCUTS` 之后重复在
结构上消失，不再依赖人工同步。

**另一处意外收获**：`isEditableTarget`(stage) 与 `isEditableKeyboardTarget`(editor) 实现
**逐字相同**（`diff` 确认）。它依赖 `Element`/`HTMLElement`，放进无 DOM 的 Layer 1 包会破坏
包定位，因此未纳入本刀，记为已知遗留。

### 步骤 4 · CAD 文档类型与外壳 — `add-cad-document-kind`

`CadDocument v1` 协议 + 资源浏览器新建入口 + 第四种文档 panel（`cadDocument`）。左右面板
默认收起。**此步不含任何绘制能力**，目标是一份空 CAD 文档能新建、打开、存盘、重开。

**一处会晚发现的设计点**：边缘组是工作区全局的，而文档标签在中央。在 CAD 里打开图层面板
后切回页面标签，场景树应当回来——这意味着**边缘面板的内容与可见性要变成「当前激活文档
类型」的函数**，而现在它是工作区级全局状态。

**顺带解决的矛盾**：`Frame.size` 是尺寸唯一事实来源，而 CAD 要无限图纸。独立文档类型正好
绕开——CadDocument 没有 Frame。这反过来印证决策 1 是对的，不只是 UI 偏好。

**门槛**：五道 + 新增 e2e（新建 → 打开 → 存盘 → 重开）。

### 步骤 5 · 命令引擎跑通一把工具 — `add-cad-command-engine`

第一条可运行的纵向流程：**敲 `L↵` → 点两下画出一条线 → Ctrl+Z 撤销 → 存盘重开还在**。

这里是唯一真正从零开始的部分，也是最需要提前设计的契约缺口：

> **AutoCAD 的命令由键盘启动，不由 `pointer.down` 启动。**

现有契约 `claim(event: StagePointerDownEvent, ctx)` 只在指针按下时被询问，表达不了 `L↵`。
需要补一条平行入口 `activate(command, args) → Session`。

更麻烦的是**多步提示循环**：`指定第一点` → `指定下一点或 [闭合(C)/放弃(U)]` → …，而
session 是 `update`/`commit` 两态。多步命令要在 session 内部跑状态机——可以，但提示文本、
选项关键字、Esc 逐级退出、Enter 接受默认需要一层协议。**这层不设计，每把工具都会自己
发明一遍。**

注意一个诱人的错觉：页面编辑器的绘制工具不也是多步吗？**不是同一个东西**——拖拽是连续的
（步骤由 pointer session 隐含表达），提示循环是离散的（每步等一次确定输入，且输入可能
来自键盘）。

**门槛**：五道 + 上述 e2e 全链路。

### 步骤 6 · 捕捉与作图范式 — `add-cad-osnap-and-ortho`

对象捕捉（端点/中点/圆心/交点）+ 捕捉标记 + 网格 + 正交(F8) + 极轴追踪 +
坐标语法 `100,50` / `@10,20` / `100<45` + 动态输入浮层。

这些是**范式而非功能**，后加会很痛：先选后执行与先执行后选并存的语义也在这一步定下。

### 步骤 7 · 块与组件对接 — `add-cad-blocks`

块定义与插入，与 Component Asset v2 对接。**A/B 读法必须在本步之前定下。**

### 步骤 8 · 连接语义 — `add-cad-ports-and-wires`

全仓搜索 `connector` / `port` / `anchor` / `ConnectionPoint` **零命中**，这是画示意图的
硬缺口，也是画图工具与示意图工具的分水岭：

> 拖动一台交换机，连着它的网线必须跟着走。

三样地基：符号声明端口（局部坐标，跟随实例变换）；连线端点存 `{entityId, portId}` 而非
绝对坐标；移动或切换变体时重解端点。**变体切换要求端口 id 稳定**，否则连线断——这条要立成
变体操作代数的不变量，而不是靠约定。

正交走线（曼哈顿路由）、避障、线段合并是打磨层，可后置。

### 步骤 9 · DXF 导入 — `add-dxf-import`

**独立工作流，随时可插队**：纯解析 + 映射，不碰交互内核，天然好测（喂文件、断言 Entity 树）。

`BLOCK ≙ Component Asset`、`INSERT ≙ Component Instance`——**DXF 的复用机制与决策 2 选的
组件模型是同一件事**。这不是巧合，两者解决同一个问题；它也是决策 2 选对了的旁证。

已知坑：

- **DXF 的 Y 轴朝上，屏幕 Y 朝下**，导入必须翻转。这是最容易在几天后才发现的一类 bug。
- `LWPOLYLINE` 的 bulge 是圆弧段，不是直线。
- `LAYER` + ByLayer 颜色继承在现有模型里没有对应物（Group 不是图层）。
- 虽然显示用 px，真实世界坐标 + `$INSUNITS` → px 的 fit 变换躲不掉。

## 验证要求

沿用 AGENTS.md 的五道门槛，且**必须在每步最后一起跑一遍**——中途跑过不算数（stage 重构
中吃过亏：漏跑 `typecheck` 导致 6 个类型错误合进 main，`build` 不检查测试文件，
`test`/`e2e` 也不会失败）。

涉及编辑器或画布的步骤额外要求 `bun run test:e2e`；改动目录结构或大量导入路径时全部带
`--force`（turbo 缓存漏报过真错误）。

## 关于步骤顺序

**1、2、3 互不依赖，可以并行**，且都不改变任何现有行为、都由现有黄金图与 e2e 全程护航。
三刀做完 CAD 才有地基，而步骤 3 即使 CAD 一行不写也已还本。

未定的 A/B 读法只阻塞步骤 7，不阻塞 1–6。
