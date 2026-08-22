# CAD 文档类型路线图

## 文档定位

本文是 CAD 编辑能力的**纲领性路线图**，用于串联多个 OpenSpec 变更，不代表当前已经稳定的
公共 API。每一步都是一个独立可发布、可回退的 OpenSpec 提案。与 `overview.md`、
`stage-plugin-kernel-roadmap.md` 同为指导提案的架构文档，区别是本文只覆盖 CAD 文档类型。

**当前状态：步骤 1–5、6a、6b、6c、7 已完成。** 本文写于 2026-08-21，记录的是动手前的判断与决策，
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
| 6 | **整份图纸与图纸里的块都可以是组件** | 两条方向都要做：组件实例能渲染 CAD 文档，CAD 编辑器也能消费组件库并插入实例 |

决策 1 与决策 2 不矛盾：**编辑体验**是独立文档类型 + 独立范式，**消费方式**是组件实例。
起初曾把两者混为一谈而得出「CAD 不是新文档类型」的错误结论，此处记下以免重犯。

## 未定的决策

- ~~「CAD 可以是组件也可以是变体」的两种读法~~ **已定（2026-08-22）：两种都是。**
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

### 步骤 4 · CAD 文档类型与外壳 — `add-cad-document-kind` ✅

`CadDocument v1` 协议 + 资源浏览器新建入口 + 第四种文档 panel（`cadDocument`）。左右面板
默认收起。**此步不含任何绘制能力**，目标是一份空 CAD 文档能新建、打开、存盘、重开。

**一处会晚发现的设计点**：边缘组是工作区全局的，而文档标签在中央。在 CAD 里打开图层面板
后切回页面标签，场景树应当回来——这意味着**边缘面板的内容与可见性要变成「当前激活文档
类型」的函数**，而现在它是工作区级全局状态。

**顺带解决的矛盾**：`Frame.size` 是尺寸唯一事实来源，而 CAD 要无限图纸。独立文档类型正好
绕开——CadDocument 没有 Frame。这反过来印证决策 1 是对的，不只是 UI 偏好。

**门槛**：五道 + 新增 e2e（新建 → 打开 → 存盘 → 重开）。✅ 全绿，e2e 99 → 100/100。

**落地要点**：`CadDocument` 直接复用 `ComposeEntity`——它本身只要求 `{ id, name, components }`，
Composition、Hierarchy 之类的约束住在 ComposeDocument 的**校验器**里而不是类型里。这一点是
「复用 ECS 底座」能成立的前提，读代码才确认得了。

边缘面板的做法是**按文档类型记忆**而不是简单的「CAD 就收起」：初值 CAD 收起、其余展开，
用户手动展开或收起记入当前类型，切走再切回恢复用户的选择。Dockview 7 的边缘组自带
`collapse()` / `expand()` / `onDidCollapsedChange`，不必自己造收起状态。

**步骤 2 的泛型化漏了一层**：`DocumentValidationResultOf<TDocument>` 仍把问题类型写死成
ComposeDocument 的 `DocumentValidationIssue`，CAD 的机器码塞不进去。本刀补上
`DocumentValidationIssueShape` 与第二个类型参数（默认不变），贯穿 `TransactionRuntime`、
`TransactionRuntimeOptions` 与 `TransactionResetResult`。**泛型化要一路贯到叶子类型**，
只换主类型会在第二个消费者出现时才暴露。

**一处必须跟着扩展的临时实现**：孤儿判定当前等价于「未被 `rootIds` 引用」，因为本步尚无
图元词汇、也就没有层级。第一个图元落地时它必须改成按层级遍历，否则子级会被误判成孤儿。
已在实现处注明。

### 步骤 5 · 命令引擎跑通一把工具 — `add-cad-command-engine` ✅

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

**门槛**：五道 + 上述 e2e 全链路。✅ 全绿，e2e 100 → 101/101。

**契约定形**：会话推进返回**四态**——`prompt` / `commit` / `cancelled` / `rejected`。关键在
`rejected` **不结束会话**：输入不合法在 CAD 里是常态（点错、打错关键字），结束命令会让用户
从头再来。`Esc` 是中止整条命令而不是退一步，退一步由命令自己的「放弃(U)」关键字表达——
这一点此前记成了「Esc 逐级退出」，与 AutoCAD 不符，已按实际行为改正。

**本刀没有使用交互内核仲裁器，这是刻意的。** CAD 目前只有平移、缩放与命令驱动的取点三种
输入，彼此不竞争，用仲裁器是纯粹的仪式；而 `activate(command)` 该长什么样，要等步骤 6 有了
选择与对象捕捉、出现真正竞争的手势才知道。因此**步骤 1 对 CAD 的收益推迟到步骤 6 兑现**，
它当时的另一半价值（清理三个自称文档无关却 import 了 Stage 类型的文件并加守卫）不受影响。

**两处只有 e2e 能抓到的接线漏洞**：`useCadWorkspace` 建运行时时漏注入
`createCadCommandHandlers()`（单测显式传了 handlers，因此照常通过）；CAD 面板原本渲染
`session.runtime.document`，而会话只在 `dirty` 翻转时换身份，第一次修改之后画布就停住——
改为 `useSyncExternalStore` 订阅运行时。

**撤销历史改为跟随活动文档标签**：`TransactionRuntime` 与 `ComposeHistoryNavigationController`
在 entries / canUndo / undo / redo / navigate 上结构兼容，CAD 标签激活时直接接上去即可，
历史面板随之显示 CAD 的撤销栈。这条兼容性是既有 TSDoc 写明的，不是巧合。

**一处 CSS 陷阱值得记**：SVG 在 flex 容器里不会可靠地撑满——它有 intrinsic 尺寸（300×150），
既可能不够高也可能溢出到命令行之上，表现是画布上的点击被命令行拦截。用 relative 包裹层 +
绝对定位，图面的盒子才与可见区域严格一致。

### 步骤 6 · 捕捉与作图范式 — 拆成两刀

原本写成一整块（对象捕捉、捕捉标记、网格、正交、极轴、坐标语法、动态输入，外加「先选后执行 /
先执行后选」），实际是两到三刀的量。里面有一条清晰的接缝：**要不要查询既有几何**。

#### 6a · 点输入管线 — `add-cad-point-input` ✅

不需要查询既有几何的部分：坐标语法、正交、网格。

**核心不是这三个功能，而是把点的求解建成一条有序管线**——`显式坐标 > 正交 > 网格`，对象捕捉
下一刀作为**最高优先级的一级**插在前面而不必改动任何调用方。绞杀式重构里「新路先通」的同一形状。

优先级里最要紧的一条：**显式键入的坐标不被任何吸附改写**。用户打了 `100,50` 却落在 `96,48`，
是这类工具里最难排查的缺陷——它看起来像浮点误差，实际是流程错误。

两处实现约束值得记：

- **极坐标的 y 分量取负**。角度按数学惯例逆时针为正，而屏幕 Y 轴向下，因此 `100<90` 必须指向
  屏幕上方。少了这个负号，所有极坐标都会上下翻转，而画水平线时完全看不出来。
- **参照点必须由会话给出**。「放弃(U)」会退回上一个顶点，宿主自行记住「最后送进去的点」会与
  会话失步，随后的正交与相对坐标全部以错误的基准求解。因此 `CadCommandEffect` 带 `reference`。

**门槛**：五道 ✅，e2e 101 → 102/102。

#### 6b · 对象捕捉 — `add-cad-osnap` ✅

端点 / 中点 / 交点捕捉与捕捉标记。**对象捕捉是 CAD 与画图工具的分水岭**：画接线图时线必须
精确接在符号端点上，差一个像素在图上看不出来，导出与后续连接语义却是断的。

6a 留出的那一级在这里插了进去——`resolveCadPoint` 的上下文加一个 `snapped` 字段，函数体加
一行，**调用方一处未改**。管线这个形状因此兑现了它的承诺。

- **优先级**：端点 > 中点 > 交点，同级按距离。AutoCAD 的惯例，也是可预期性的一部分——同等
  距离下总是命中端点，用户才敢直接点过去而不必先放大确认。
- **捕捉半径按屏幕像素给出、除以缩放换成世界单位**：捕捉本质是屏幕概念，视图缩小时同样的
  屏幕半径必须覆盖更大的世界范围，否则放远了就再也捕不到。
- **交点是唯一 O(n²) 的一项**，先用捕捉半径的包围盒过滤候选线段（O(n)，通常剩不到五条）再
  两两求交。**不建空间索引**：候选过滤已经把常数压得很低，索引要处理增量维护与失效，属于
  当前没有证据支持的复杂度；真需要时 `findCadSnap` 的签名不必变。
- 标记形状沿用 AutoCAD 约定（端点方框、中点三角、交点叉号）：用形状而不是颜色区分，扫视中
  也分得清。F3 切换。

**门槛**：五道 ✅，e2e 102 → 103/103。e2e 直接断言两条线在屏幕上严格共点。

**这一刀改了上一轮的计划**：原说「6b 把选择集一起做」，实际拆开了。两者风险来源互相独立——
捕捉是几何与渲染，选择是手势竞争与契约扩展，捆在一起会让任何一处出问题都拖住另一处。

#### 6c · 选择集与手势仲裁 — `add-cad-selection` ✅

分成两刀落地：先 `extract-interaction-kernel` 把内核抽成独立包，再 `add-cad-selection` 接线。

##### 为什么先抽包

依赖方向走不通：AGENTS.md 规定 `@compose-ui/cad` 只能依赖 `core` 与 `assets`，而内核当时住在
`stage-engine` 里。让 CAD 去依赖 `stage-engine` 不是省事而是错位——那个包整包绑在
`ComposeLayoutSnapshot` 与盒模型上。

步骤 1 泛型化时**刻意没抽包**，理由是「只有一个消费者，AGENTS.md 禁止提前抽象」。到这一刀有
第二个了，正好是 AGENTS.md 给出的准入线。抽包还把边界从**正则守卫**换成了**包依赖**：
`@compose-ui/interaction-kernel` 的 `dependencies` 为空，想引用文档类型必须先加一条依赖。
正则拦得住 `StageSceneIndex`，拦不住一个改名成 `SceneIndex` 的类型被 import 进来。

##### 命中：距离，不是包围盒

| 层 | 复用了吗 | 结果 |
| --- | --- | --- |
| 交互内核（仲裁器 / 注册表 / 插件契约） | **复用** | CAD 声明自己的 profile，内核一行不改 |
| 指针会话（Stage 那 519 行三类竞态） | **没有抽出来** | 见下 |
| 场景渲染 / SceneIndex / 吸附 | **没复用** | 命中判据根本不同 |

`StageSceneIndex.getWorldBounds(entityId): StageRect`——**命中的单位是矩形**。而 CAD 的直线没有
盒模型：一条对角线的包围盒里绝大部分是空的，按矩形命中会让两条交叉线互相「挡住」对方。CAD
的判据是**点到线段的距离**，`findCadHit` 就是这一条。

##### 指针会话：预判被推翻

上一轮写的是「框选是第一个真正需要那三类竞态防护的手势，6c 再决定抽不抽」。**实际写完发现框选
不需要**：没有 rAF（因此没有迟到帧）、指针捕获落在图面自己的 SVG 上（因此没有跨会话 window
监听）、`pointercancel` 与 `lostpointercapture` 各自有归宿。Stage 那 519 行防的是它自己那套
controller/surface 分离带来的竞态，搬过来是把别人的问题一起搬过来。等 CAD 出现真正需要预览
节流的手势（夹点拖动、MOVE）再说。

##### 落地的东西

- 三个插件一张优先级表：`cad.command-point`(30) > `cad.select`(20) > `cad.marquee`(10)。
  插件是纯状态机，不认识命令会话——发效果，宿主过点求解管线再喂给会话。
- **左→右是窗口（实线框，全包含），右→左是交叉（虚线框，碰到就选）**。方向由起终点决定而不是
  归一化后的框——归一化之后方向信息就没了。
- 选择集语义**按 AutoCAD 而不是页面编辑器**：点中即加入（不需要修饰键），Shift 是移出，单击
  空白清空，Esc 分两级（有命令则取消命令，否则清选择）。这在两边是相反的，是刻意的。
- 中键平移仍留在图面上（视口是 React state 不是内核状态），但**指针归属单线**：所有按下先问
  仲裁器，被拒绝才走平移。
- `ERASE`（`E`）打通「先选后执行 / 先执行后选」，一次删除是一个 batch。

##### 协议上多出的一档：`prompt` 可空

原以为「先选后执行」能在 ERASE 内部用一个标志绕过去，写出来才发现那是在骗协议：会话协议要求
宿主先读一次 prompt，于是宿主会显示「选择对象」再等一次回车，而 AutoCAD 里 `E↵` 是**当场就删**。
`ComposeCommandSession.prompt === null` 表示「没有要等的输入」，宿主立刻以 accept 推进。这一档
是通用的，不是给 ERASE 开的后门——没有它，这类命令只能靠宿主认识命令 id 来特判。

极轴追踪（正交的推广，带追踪线 UI）与动态输入浮层留到之后。

### 步骤 7 · 块与组件对接 — `add-cad-blocks` ✅

块定义与插入，与 Component Asset v2 对接。决策已定：**两个方向都要**。

- **图纸即组件**：整份 CAD 文档可被组件实例引用并渲染进页面，可有变体
  （「机房 A 布局 / 机房 B 布局」）。
- **块即组件**：CAD 内插入的符号就是组件实例，可有变体（断路器闭合/断开、单极/三极）。
  这是 DXF `BLOCK`/`INSERT` 的直接对应，也是画接线图的高频动作。

两个方向共用同一套 Component Asset v2 机制，差别只在谁引用谁。**块的插入点必须能捕捉**，
因此本步排在步骤 6 之后——反过来做会让插入流程返工。

#### CAD 不引入容器与自动布局（2026-08-22 定）

Auto Layout 是**从盒模型求解位置**，而 CAD 的位置是作者写死的坐标——一条线的两个端点就是
事实本身，没有未知数可解。CAD 又是无限图纸、没有画布尺寸，`fill`/`hug` 连参照系都没有。
Container 拆开看就是 `Hierarchy + Layout`，所以「不要容器」与「不要自动布局」是同一句话。

**Compose 的 `Group` 也不能直接复用**：`createComposeGroupEntitySeed` 里它同样带
`LayoutItem`（fixed 宽高），因为 Stage 的命中与渲染是盒模型的。复用它等于把 6c 刚论证过
不能用的那套东西引回来——CAD 的命中判据是点到线段的距离，不是矩形。

#### 「块」与「编组」是两件事，不要合并

AutoCAD 里这两个概念长得像，语义完全不同：

| | 是什么 | 是层级吗 |
| --- | --- | --- |
| **BLOCK / INSERT** | 定义 + 实例，带插入点、旋转、比例 | 是，一层变换 |
| **GROUP** | 命名的**选择集** | **不是**——一个对象可以同时属于多个组 |

「一个对象同时在多个组里」在树里根本表达不了（一个 Entity 只有一个父）。AutoCAD 的组解决的
是「选中一个就选中一伙」，是选择集的便利，不是层级。

因此本步只做 **BLOCK/INSERT**：实例自己的那一层变换，与 Component Asset v2 对接。编组是
扁平成员集合，另算，不进 `rootIds` 树。

**`CadDocument.rootIds` 保持平坦。** 今天就是平坦的（`cad-document.ts` 里「可达等价于被
`rootIds` 引用」）。平坦意味着命中、框选与 DXF 导入都不必处理递归，这是白赚的。

#### 「块即组件」不能按字面实现（实施时才发现）

```ts
export interface ComposeBaseComponentAsset {
  readonly document: ComposeDocument   // ← 页面文档协议
}
```

`validateComposeDocument` 要求 `rootIds` 每个根**带 Frame**、每个 Entity **带 `LayoutItem`**。
CAD 图元两样都没有——正是上面那条「CAD 没有盒模型」。Variant 的操作代数也只对得上一半：
`move-entity` 带 `parentId`/`beforeEntityId`，假设内容是一棵树，而 CAD 是平坦的。

因此本步按 **DXF 的原始形状**落地：块表 `CadDocument.blocks` 与 `entities` 平级，块内图元是
**块局部坐标**。理由不只是简单——步骤 9 的 DXF 导入读出来的就是这个结构。跨文档复用、
`.cadblock` 资源与真正的变体继承留给后续。

变体在本步就是**两个块定义**（「断路器闭合 / 断开」），与 DXF 一致——DXF 本来也没有变体继承。

#### 落地的东西

- `CadInsert`：`blockId` / `position` / `rotation` / `scale{x,y}`。**比例分轴**，接线图要
  镜像符号，负比例是常规用法。
- 实例几何**求解不复制**：块局部依次经比例 → 旋转 → 平移。改一次定义，全部实例跟着变。
  顺序写反会绕世界原点转，符号甩到图纸另一头——有一条用例专门拦它。
- `BLOCK`/`B`（选择集 → 块 + 原地实例，一个事务）与 `INSERT`/`I`（按名插入，插入点走捕捉）。
- **可见性遍历从四份收敛成一份**：命中、框选、捕捉与渲染原先各写一遍「哪些图元可见」，加上
  块展开之后四份会立刻分叉。统一成 `collectCadVisibleSegments`，返回值带 `ownerId`——命中与
  框选的结果因此是**实例**而不是块内图元。既有 79 条用例一条没改就全绿。
- 框选按 owner 聚合再判定：窗口要求实例每段都在框内，交叉只要一段碰到。

#### 本步刻意不做

嵌套块（显式拒绝并给可定位错误，免得后来者以为它碰巧能用）、属性块（要等文字图元）、
块资源化，以及**图纸即组件**——那是另一个方向（CAD 被页面消费），风险来源独立，单开一刀
`add-cad-as-component`。

### 步骤 8 · 连接语义 — `add-cad-ports-and-wires`

全仓搜索 `connector` / `port` / `anchor` / `ConnectionPoint` **零命中**，这是画示意图的
硬缺口，也是画图工具与示意图工具的分水岭：

> 拖动一台交换机，连着它的网线必须跟着走。

三样地基：符号声明端口（局部坐标，跟随实例变换）；连线端点存 `{entityId, portId}` 而非
绝对坐标；移动或切换变体时重解端点。**变体切换要求端口 id 稳定**，否则连线断——这条要立成
变体操作代数的不变量，而不是靠约定。

正交走线（曼哈顿路由）、避障、线段合并是打磨层，可后置。

### 步骤 8.5 · CAD 动画 — `add-cad-animation`（未开始）

**图纸也要能刻动画**：电流流向、告警闪烁、拓扑图上的数据包流动。读代码之后结论比预期乐观。

**协议与采样白拿。** `ComposeAnimationTrack.path` 是**相对 Entity 的属性路径**——今天是
`['LayoutItem','offset']` / `['Appearance','opacity']`，明天可以是 `['CadStroke','dashOffset']`，
类型层完全通用。`@compose-ui/animation` 的 9 个源文件里只有 3 个提到 Frame
（`animation-file.ts`、`animation-commands.ts`、`index.ts`）；类型、采样、插值、运动路径与
校验**一处都没有**。

**要改的只有清单归属。** 清单现在挂在 Frame 的 `Animations` Component 上、文件按根 Frame 分区，
而 CadDocument 没有 Frame。但它也**不需要分区**：AGENTS.md 说 Frame 是六重隔离边界、其中一重
是动画时间线，而**一份 CAD 文档就是一个时间线作用域**。因此清单落在文档级即可——比页面那套
更简单，不是更难。

**前置依赖：图元得先有可动画的外观。** CAD 图元目前只有 `CadPlacement` 与 `CadLine`，颜色
一律 ByLayer，没有任何 per-entity 外观。而 CAD 动画的主要对象**恰恰不是几何而是外观与状态**：

| 想做的 | 动的是什么 |
| --- | --- |
| 电流流向 | 线的 `strokeDashoffset` |
| 告警闪烁 | 颜色 / 可见性 |
| 数据包流动 | 沿线运动的一个点（运动路径） |
| 断路器合闸 | **变体切换**，不是关键帧 |

因此本步排在步骤 7（块与组件）之后：per-entity 描边覆盖要先有，**「变体切换」这类离散状态
能不能表达成轨道**也要等组件实例进了 CAD 才谈得上——它是结构变更而不是数值插值，可能需要
一种 step 轨道，这是本步唯一的未决问题。

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

A/B 读法已于 2026-08-22 定为「两者都要」，步骤 7 不再有前置未决问题。
