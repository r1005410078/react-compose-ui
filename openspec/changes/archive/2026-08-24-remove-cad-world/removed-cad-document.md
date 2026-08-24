# 已删除的 `cad-document` 能力

`cad-document` 能力整体删除，`openspec/specs/cad-document/` 随本刀移除。

**本文不是规范增量，是删除清单。**它原本写成 `specs/cad-document/spec.md` 的 REMOVED 增量，
但 `openspec archive` 拒绝写出零 Requirement 的规范（「Spec must have at least one
requirement」）——把一个能力的**全部** Requirement 删掉，工具没有对应的出口。因此规范目录直接
删除，这份逐条清单挪到变更根目录保留：它是「删得干不干净」的检查表，每条指向它的页面对应物。

**共同原因**：路线图决策 1「没有第二个世界」。`CadDocument` 是第二套文档协议、第二套选择
语义、第二个标签种类与第二块画布；页面世界在步骤 8–11 之后对每一项都有对应物。

**共同迁移**：不写迁移器（决策 6，与删 Page Slot 同一条判断）——没有线上 `.cad.json` 资产，
为零份文档写迁移是纯粹的负债。残留的 `.cad.json` 在资源浏览器里退化为普通 JSON：可读、
可编辑、不能作为 CAD 标签打开。

下面每条的**原因**只写它自己那一份信息：它的页面对应物是什么，或者为什么没有对应物。

## REMOVED Requirements

### Requirement: CadDocument v1 协议

**原因**：ECS 底座本来就是 `ComposeDocument` 的，CAD 只是换了一套 Component 词汇与校验器。
几何词汇已由 `Curve` 承担（页面版是三元联合 `line`/`arc`/`polyline`，与 CAD 的两条判断一字
不差：整圆是扫掠 ±360 的弧、矩形是四顶点闭合多段线）。

**迁移**：图纸画在场景（Frame）里——决策 5「无限图纸消亡」，交付物本来就是固定尺寸大屏。

### Requirement: CAD 文件协议与 Store

**原因**：第二种文档文件类型随协议一起消失。页面文件（`ComposePageFile 3`）与组件文件
（`Component Asset v2`）是唯一的持久化形态。

### Requirement: CAD 直线图元

**原因**：对应物是带 `Curve` 的普通 Entity（`kind: 'line'`），且它**保留盒**——移动、位置
动画、场景树、Group 包围盒因此零改动可用（决策 2）。

### Requirement: CAD 直线命令

**原因**：页面命令行的 `LINE` 命令（`stage-engine/src/drafting/line-command.ts`），逐段落地、
产出 `Curve` Entity。

### Requirement: CAD 点输入管线

**原因**：管线在步骤 9 之前就住进 `core/point-input/`，两块画布共用同一份实现，CAD 侧只是
一组别名。删掉别名，管线原地不动。

### Requirement: CAD 坐标语法

**原因**：同上，`core` 的共享坐标语法（绝对 `x,y`、相对 `@dx,dy`、极坐标 `距离<角度`）。

### Requirement: 正交模式

**原因**：同上，住在共享点输入管线里，Stage 的取点一样经过它。

### Requirement: CAD 对象捕捉

**原因**：对应物是 `stage-engine` 的 `findStageFeaturePoint`，优先级
`port > endpoint > midpoint > center > quadrant` 与 `CAD_SNAP_MODES` 逐项相同——该次序的
论证随本刀内化进 `stage-engine` 规范（决策 D）。

### Requirement: CAD 捕捉标记

**原因**：对应物是 Stage 的捕捉标记，同样只在光标靠近时显出来、端口不画常驻标记。

### Requirement: CAD 图元命中

**原因**：对应物是 Stage 的两条曲线命中路径——DOM 侧的透明加宽 stroke 与 `StageSceneIndex`
的按距离判定，两者对「对角线包围盒的空角不命中」给出一致答案。

### Requirement: CAD 框选的窗口与交叉模式

**原因**：Stage 的框选判定模式（窗口/交叉/方向敏感）是**用户自己的设置**，在步骤 6 里从
模式手中收回。页面侧的判定单位是盒而不是点到几何的距离——这是一处已知的不对等，见下条。

**迁移**：曲线的距离式交叉框选没有页面对应物，本刀**不补**。所需的三个函数
（`segmentCrossesBounds` / `segmentWithinBounds` / `boundsFromPoints`）随包删除，理由见
design.md 决策 B：没有消费者的东西不进协议，真要做时重推比养一个死模块便宜。

### Requirement: CAD 选择集语义

**原因**：**刻意不移植**。「点中即加入、Shift 移出」的原始理由是「用户的肌肉记忆来自
AutoCAD」，该前提已于 2026-08-23 由用户推翻。选择语义只有一套：Figma 的替换 + Shift 累加。

### Requirement: CAD 指针手势仲裁

**原因**：仲裁器与注册表在步骤「extract-interaction-kernel」时就搬进
`@compose-ui/interaction-kernel`，CAD 侧只剩一个 profile 绑定。删掉 profile，内核原地不动
（决策 E：它从此只有一个消费者，仍留在原处）。

### Requirement: CAD ERASE 命令与先选后执行

**原因**：页面命令行的 `ERASE`（`stage-engine/src/drafting/erase-command.ts`），同样是先选后
执行、预选时 `prompt` 为 `null` 直接提交。

### Requirement: CAD 块定义表

**原因**：对应物是 Component Asset v2。块表是「一份定义多处实例」的弱化版——没有变体、没有
属性/结构覆盖、编辑期不能下钻。这与删 Page Slot 是同一条判断。

### Requirement: CAD 块实例

**原因**：对应物是组件实例 Entity。实例几何跟随组件根、尺寸的唯一事实来源是根本身，与
CAD「位移只改插入点」是同一条不变量的页面写法。

### Requirement: 块实例参与命中、框选与捕捉

**原因**：组件实例的端口从离线快照读出（`getComposeEntityPorts`），因此捕捉一侧不需要认识
组件协议；命中与框选走既有的 Entity 通道。

### Requirement: CAD BLOCK 与 INSERT 命令

**原因**：能力对应物是组件库的「从选区创建组件」与「插入实例」。**命令行入口不补**——见
design.md 决策 C：缺的只是能敲的那个词，补一批与既有入口重复的命令违反「一个动作一个入口」。

### Requirement: CAD 指针反馈

**原因**：对应物是 Stage 的橡皮筋预览、悬停高亮与坐标读数，会话状态住在 Stage 自己这里。

### Requirement: CAD 指示点

**原因**：随 CAD 画布删除。Stage 的十字光标钉在**解算后的落点**上，与橡皮筋终点、坐标读数、
捕捉标记同一个值，不需要第二个「指示点」概念。

### Requirement: CAD 十字光标

**原因**：组件在步骤 9 已下沉到 `@compose-ui/canvas-kit`，两边只保留各自的形态推导。删掉
CAD 侧的推导，共享组件原地不动。**Stage 空闲不画**这条从「与 CAD 刻意的不对称」改写成它
自己的理由（页面编辑器的静息光标是箭头），见决策 D。

### Requirement: CAD 画布网格与标尺

**原因**：轴点阵与标尺刻度住在 `core`、滚轮与标尺组件住在 `canvas-kit`，Stage 用的是同一份。
CAD 侧只是第二个调用点。

### Requirement: CAD 几何位移

**原因**：页面命令行的 `MOVE`，同样是「拖动与命令派发同一条命令」，插件只发效果、捕捉与
网格由宿主解算。

### Requirement: CAD COPY 连续放置

**原因**：页面命令行的 `COPY`，连续放置的 `prompt` 状态照抄。

### Requirement: CAD 拖动移动

**原因**：Stage 的 entity-select-move 插件，claim 条件同样是「命中的对象已经在选择集里」。

### Requirement: CAD 块端口

**原因**：对应物是 `Ports` Entity Component（步骤 11a）。差别是刻意的：`Ports` 可以挂在
**任意** Entity 上，不只组件根——与 `Interaction` 是同一条判断。

### Requirement: CAD 导线

**原因**：对应物是带 `Wire` 的普通曲线 Entity（步骤 11b）。「几何求解不存储」这条原则原样
继承，且页面版更省一步：`CadFreeEndpoint` 要存坐标是因为 CAD 的导线没有盒，而 `Curve` 就是
那个点。

### Requirement: CAD 导线端点引用完整性

**原因**：页面侧的对应物在校验器与 Inspector 之间分工不同：绑定**不完整**（缺字段）是文档
非法，**指向不存在的实体或端口**只是解算失败并在 Inspector 标为失效。「还没配」「配错了」
「配的东西没了」三者必须可区分。

### Requirement: CAD WIRE 命令

**原因**：页面命令行的 `WIRE`，同样「绑定来自取点时记下的来源而不是事后按坐标反查」，
`WIRE` 绑、`LINE` 不绑。

### Requirement: CAD PORT 命令

**原因**：能力对应物是端口 Inspector。**命令行入口不补**，见决策 C。

### Requirement: CAD 端口捕捉

**原因**：对应物是 `findStageFeaturePoint` 里 `port` 排在 `endpoint` 之前的那一档。这也是
「优先级严格先于距离」第一次真正生效的地方。

### Requirement: CAD 删除绑定目标时冻结导线端点

**原因**：**页面侧不需要这条规则**。它在 CAD 存在的唯一理由是校验器拒绝悬空引用；页面侧
悬空引用不让文档非法，因此删除绑定目标既不会让用户没选中的东西消失，也不会让整批删除被
校验打回。

### Requirement: CAD 拖动预览与提交同源

**原因**：Stage 的手势本来就是「预览与提交走同一条解算」，`previewCadTranslate` 那层包装是
CAD 特有的。

### Requirement: CAD 圆弧图元

**原因**：`Curve` 的 `kind: 'arc'`，带符号扫掠角、整圆是 `sweep` 绝对值 360，与 CAD 一字不差。
弧的紧包围盒同样把落在扫掠内的象限点算进去。

### Requirement: CAD 可见几何遍历

**原因**：页面侧的对应物是 `composeCurvePoints` 与 `projectComposeCurveToBox`——换算只有一个
入口，渲染由浏览器按 `viewBox` 完成。「不把弧拍扁」这条原则原样继承（等比精确、非等比拍扁）。

### Requirement: CAD 圆弧的命中与框选

**原因**：命中的对应物见「CAD 图元命中」。框选的不对等见「CAD 框选的窗口与交叉模式」。

### Requirement: CAD 圆心与象限点捕捉

**原因**：`findStageFeaturePoint` 的 `center` 与 `quadrant` 两档，次序相同。

### Requirement: CAD 块内圆弧的缩放

**原因**：对应物是曲线按 `viewBox` 的呈现——**等比仍是精确弧，非等比拍扁成多段线**，与 CAD
侧块内弧一字不差（该判断已写进 AGENTS.md 的曲线段）。

### Requirement: CAD CIRCLE 与 ARC 命令

**原因**：页面命令行的 `CIRCLE` 与 `ARC`。

### Requirement: CAD 文字图元

**原因**：对应物是既有的 Text 物料。步骤 4b 已判定：取消绘图模式之后「复用页面 Text」自动
成立，没有第二条路径要建。

### Requirement: CAD 可见几何是一把伞

**原因**：`CadGeometry` 这把伞是为了让文字与曲线共处一个遍历；页面侧文字与曲线是两种 Entity，
各走自己的渲染与命中，不需要伞。

### Requirement: CAD 文字按包围盒命中

**原因**：页面侧的文字本来就是盒物料，按矩形命中是默认而不是破例。

### Requirement: CAD 文字命中框与字形对齐

**原因**：**页面侧不需要这条不变量**。它在 CAD 存在的理由是「无 DOM，拿不到字体度量」，
因此靠等宽字体 + 三个固定比例算框；页面侧由布局求解量真实文字。

**迁移**：`CAD_TEXT_ADVANCE_RATIO` 等三个比例与 `cadTextBounds` 系列随包删除。DXF 导入用的
ascent / advance 两个比例住在 `@compose-ui/dxf` 里，且那里明确写着「只是导入那一刻的初值，
不是命中框契约」，不受影响。

### Requirement: CAD 插入点捕捉

**原因**：块实例的插入点在页面侧是组件实例的 `LayoutItem.offset` 与 `Transform.pivot`，
捕捉走既有的端口与特征点通道。

### Requirement: CAD TEXT 命令

**原因**：对应物是 `draw-text` 工具，步骤 4b 已判定作废。

### Requirement: CAD 多段线图元

**原因**：`Curve` 的 `kind: 'polyline'`，`closed` 同样是布尔而不是「首尾顶点重复」，矩形同样
是四顶点的闭合多段线。

### Requirement: CAD 多段线在遍历中展开为线段

**原因**：页面侧**不展开**——一条多段线在 DOM 里就是一个 `<polyline>` / `<polygon>`，
`cad` 那句「一条多段线在 DOM 里是 N 个 `<line>`」的代价在这边不存在。

### Requirement: CAD PLINE 与 RECTANG 命令

**原因**：页面命令行的 `PLINE` 与 `RECTANGLE`。`PLINE` 同样攒到结束才提交一个 Entity，因此
同样需要「放弃上一点」关键字而 `LINE` 不需要。

### Requirement: DXF 导入器

**原因**：12a 已交付 `@compose-ui/dxf`，产出页面导入计划而不是 `CadDocument`。分词层与记录层
一个字符没改地搬了过去，`pairs` 仍是数组。

**迁移**：`importDxfDocument` 在 12a 之后只剩它自己的测试在调用（实测确认），随包删除。

### Requirement: DXF 导入的坐标翻转

**原因**：坐标恒等式 `F p = F I + R(−θ)·S·(F b)`（位置翻转、旋转取反、比例不变）原样搬进
`@compose-ui/dxf`。

### Requirement: DXF 导入诊断

**原因**：诊断带稳定机器码并按类型聚合计数，原样搬进 `@compose-ui/dxf`。

### Requirement: DXF 图层与块的映射

**原因**：页面侧的答案更进一步——图层在导入期被**求值掉**，不进文档：byLayer 颜色求值进
描边、`visible`/`locked` 落成各自 Component、图层名落成 Entity 名。块映射为 Component Asset
v2，块基点写进实例的 `Transform.pivot`。

### Requirement: CAD 画布打开时按内容取景

**原因**：随 CAD 画布删除。页面侧的对应物是 Stage 的两个视口适配时机（首次量到 surface 尺寸
后适配激活场景、场景尺寸提交后按新尺寸再适配一次），几何共用
`stage/stage-surface/viewport-fit.ts` 的纯函数。DXF 导入的场景按内容紧包围盒开，因此「一次
看不见的导入」在页面侧不会发生。

### Requirement: CAD 图元外观覆盖

**原因**：对应物是曲线的描边 Renderer props（`stroke` / `strokeWidth` / `strokeLinecap` /
`strokeDasharray` / marker），走 props 因此白拿绑定与外观轨道。

**迁移**：`CadStroke` 的「三个字段各自可选、缺席即回退、三项全清整个删掉」这条判断在页面侧
由曲线外观的同一条规则承担。byLayer 回退没有对应物——图层已在导入期求值掉。

### Requirement: CAD 线宽与虚线的单位

**原因**：页面侧同样是「线宽反向除掉画布缩放（屏幕像素）、虚线间隔不除（世界单位）」。

**迁移**：页面侧的 `strokeDasharray` 是由线宽推出的 picklist，这是一处**已知的单位错配**，
在路线图「待修的缺陷」里独立立项，不在本刀范围。

### Requirement: CAD 块实例的外观由实例决定

**原因**：组件实例的外观覆盖走 `instanceOverrides` 的 `set-field`，严格更强。

### Requirement: CAD COLOR、LWEIGHT 与 LTYPE 命令

**原因**：能力对应物是曲线描边 Inspector。**命令行入口不补**，见决策 C。

### Requirement: CAD 动画清单落在文档级

**原因**：页面侧清单挂在所属 Frame 上——CAD 没有 Frame，一份图纸就是一个时间线作用域，那是
它自己的形状。图画进场景之后，场景就是那个边界。

### Requirement: CAD 复用同一份动画采样

**原因**：`applyComposeAnimationAtTime` 的泛型签名在单一消费者下依然正确，**不收窄**（提案
非目标）。这条 Requirement 声明的是「CAD 也用它」，随 CAD 删除。

### Requirement: CAD 动画采样只作用于渲染

**原因**：这条原则在页面侧原样成立并已写进 AGENTS.md（组件实例的采样顺序、拖动预览）。
声明它的那个文档类型消失。

### Requirement: CAD 虚线偏移与 FLOW 命令

**原因**：能力对应物由本刀新增——曲线的 `strokeDashoffset` Renderer prop 加上既有的外观
关键帧轨道（`['Renderer','props','strokeDashoffset']`）。

**迁移**：**`FLOW` 命令本身不移植**，见 design.md 决策 A：命令要算一个完整虚线周期，而页面
侧的 dash pattern 由线宽推出、正是「待修的缺陷」里那条单位错配；把周期算进命令语义等于把
已知缺陷固化。属性到位后能力可表达，命令等单位修好再说。

### Requirement: CAD 画布播放动画

**原因**：随 CAD 画布删除。页面侧的播放头是既有的动画模式与预览采样；「播放头是会话状态、
不写进文档」这条原则原样成立。
