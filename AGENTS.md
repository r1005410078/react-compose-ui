<!-- OPENSPEC:START -->
# OpenSpec 使用说明

这些说明面向在本项目中工作的 AI 助手。

当请求符合以下情况时，始终打开 `@/openspec/AGENTS.md`：
- 提到规划或提案（例如 proposal、spec、change、plan）
- 引入新功能、破坏性变更、架构调整，或大型性能/安全工作
- 请求含义不明确，需要在编码前查阅权威规范

通过 `@/openspec/AGENTS.md` 了解：
- 如何创建和应用变更提案
- 规范文档的格式与约定
- 项目结构与开发指南

请保留这个托管区块，以便 `openspec update` 能够自动更新这些说明。

<!-- OPENSPEC:END -->

# React Compose UI 项目协作说明

## 项目背景

开始设计、编码或评审前，先阅读根目录的 [`README.md`](./README.md)。README
是项目定位、目标用户、要解决的问题、当前完成度和开发命令的主要入口。

React Compose UI 是一个可嵌入现有 React 项目的低代码 UI 编辑器组件体系，主要服务于
需要在客户现场快速搭建定制化大屏的实施工程师。项目希望把重复的页面编码工作转化为
可视化编排、属性配置、数据绑定、预览和保存发布流程。

## 当前阶段

- 当前仓库已经完成 Bun monorepo、包构建、测试、CI 和发布基座。
- `app/` 提供集成示例和最小 E2E 操作演示，不是正式编辑器产品。
- 当前正式文档协议只支持 `ComposeDocument v7`：显式 Frame 根（`rootIds` 只接受 Frame，
  隐式 Canvas 根与 `document.output` 已删除）、统一 ECS Entity/Component 组合、`LayoutItem`、
  `Hierarchy + Layout` Auto Layout 容器、`Renderer` 内容与结构化 `Appearance.backgroundPaint`、
  first-class Group 与关联组件实例；项目组件/变体使用独立 `Component Asset v2`，
  页面文件为 `ComposePageFile 3`；v5、v6 与 PageFile 2 只能显式单向迁移，
  数据源协议和持久化接口仍未确定。
- **界面上把 Frame 称作「场景」**：协议、命令、类型与 testid 一律保持 `Frame`，只有用户可见
  文案是「场景 / Scene」。无限工作区上摆着多个场景，其中恰好一个是**激活场景**
  （`ComposePageFile.activeFrameId`）——预览默认目标与生成真实页面用的都是它。激活写在
  页面文件里，因此切换激活是资源写入、**不进撤销历史**；新建场景改文档、可撤销，且不自动激活。
  选中场景打开的是普通容器 Inspector（场景专有属性由 Registry 的 `Frame` Component
  Definition 提供）；点空白工作区打开页面配置面板（激活场景 + 页面脚本 + 动画，无尺寸）。
- **Frame 是一个 Component，不是新的 Entity 类型**：给任意容器加上 `Frame` 就完成「升格」，
  Entity ID、子级与动画轨道全部原地保留。Frame 是六重隔离边界——坐标原点、独立 Yoga 布局
  Runtime、裁剪、动画时间线、脚本作用域、预览/导出单位。不变量：`Frame ⇒ Hierarchy`，
  Frame 不接受 Hug，尺寸的事实来源是 `Frame.size`（`LayoutItem` 固定尺寸只是求解回退，
  由 `entity.frame.size.set` 同步）。`fit`/`alignment` 是宿主呈现参数，不写进文档。
  **升格只做一件事——加上 `Frame`**：`promoteComposeEntityToFrame` 是唯一入口，Appearance、
  Clip、Renderer 与动画轨道一律原地保留，不做任何规范化；所有隐含升格必须复用它。
- **场景就是放在顶层的容器**，因此在画布上与容器共用同一条呈现管线：背景、边框、圆角全部
  来自 Entity 自身的 `Appearance`，Stage 不为 Frame 补画任何描边，场景树里两者也是同一个
  图标（`frame` Preset 复用 Container 的图标与背景）。唯一的视觉区分是标题标签。
  场景默认外观与 Container 同底色但**边框宽度为 0**：布局求解把边框计入内容盒，而场景是
  绝对坐标的原点，默认边框会让按网格吸附的子级在属性面板里读成 7、15、23。
  场景标题标签是一行 flex：`[播放按钮?] [名称] [激活标记] [尺寸胶囊]`。尺寸胶囊常驻显示
  `Frame.size`，双击打开尺寸弹框（常见分辨率预设 + 自定义宽高）。它是改尺寸的**第二个入口
  而不是第二份事实来源**：与 Inspector 几何分组派发同一条 `entity.frame.size.set`，撤销一步
  即回到原尺寸；常见分辨率预设住在 `core`（`COMPOSE_SCENE_SIZE_PRESETS`），因为 `stage` 与
  `materials` 之间没有依赖关系，各写一份必然漂移。
  **锁定场景仍然显示播放、激活标记与尺寸**：锁保护的是场景的内容与几何，而「它是谁、多大、
  是不是发布目标」正是用户用来判断要不要解锁的信息。锁定只收走改这块场景的入口——名称不再是
  选中/重命名入口，尺寸胶囊退成只读。场景默认不锁定，锁定始终是用户的显式选择。
- **视口适配有两个时机，都是会话状态**：Stage 首次量到真实 surface 尺寸后对**激活场景**适配
  一次（宿主可用 `autoFitActiveFrame` 关掉，controller 同名选项透传，示例应用用
  `?no-auto-fit` 演示）；场景尺寸提交成功后立刻按**刚提交的新尺寸**再适配一次——本帧的
  `layoutSnapshot` 还是旧尺寸，等它会先给用户一帧错误的取景。适配几何是
  `stage/stage-surface/viewport-fit.ts` 的纯函数，键盘的「适配选择/适配容器」共用它。
  依赖确定性取景的端到端与视觉回归用例必须显式关掉自动适配，而不是把留白比例硬编码进断言。
- **两块画布共用同一个底座**：视口代数、轴点阵与标尺刻度住在 `core`，滚轮/尺寸 Hook 与标尺
  组件住在 `canvas-kit`。网格与标尺**必须出自同一个点阵与同一套设备像素取整规则**，否则同一
  世界坐标会在标尺与图面上差半个像素，而这种偏差只在特定缩放下出现、极难复现。投影间距不足
  时按二次幂 stride **抽稀**而不是整片隐藏——缩小正是画总图最常用的区间，此时失去网格等于
  失去全部空间参照；视觉抽稀不改变实际吸附步长。网格设置是**会话级视图状态**，不写进文档：
  它是「怎么看」而不是「画了什么」。
- **画布上每一条产出几何的手势都必须接吸附**，包括绘制。move 走 `snapTranslation`，resize、
  两点端点与**绘制**走 `snapResizePoint`，辅助线走 `snapValueToGrid`。绘制的起点与终点各吸一次，
  且排在 Shift 等长宽约束之前；吸附生效时终点角落在网格线/智能候选上而不是光标裸坐标上，
  与 resize 一致。**判据是缩放**：`world = (屏幕 - 视口) / zoom`，zoom 恒为 1 时未吸附也看起来
  是整数，因此新手势必须在非 100% 缩放下验证，否则漏掉吸附要到很久以后才暴露。
- **旋转基点缺席即盒中心。** `Transform.pivot` 是可选的**归一化盒坐标**（`{x:0,y:0.5}` 是左边
  中点），读取一律走 `getComposeTransformPivot`。缺席即中心这条回退让「没设过基点的文档渲染
  逐像素不变」自动成立，因此本字段**不需要迁移**、协议版本不变。**不钳制到 `[0,1]`**：基点
  落在盒外表达「绕外部支点摆动」，是正当用法。归一化而不是像素，是因为 `decomposeMatrix` 里的
  `width / 2` 本来就是 `width * 0.5`，改成 `width * pivot.x` 是这条数学上最小的一处编辑，
  且 CSS `transform-origin` 原生吃百分比。
  **`matrixFromTransform` 与 `decomposeMatrix` 是一对互逆函数，必须拿到同一个基点**：手势每帧
  都要走一个来回，任何一处漏传的症状是**提交后对象跳一下、位移量恰好等于基点偏移，且只在
  非中心基点的对象上出现**。因此 `decomposeMatrix` 的基点参数**必填**——给默认值等于把这个
  错误变成静默的；新建容器与新建组件实例那两处显式传中心，是可复查的决定。
  **变换原点只有一个入口**：`composeEntitySceneStyle` 被 Stage Scene、Preview 与组件实例三条
  渲染路径共用，基点相关的渲染改动只改这一处，不得在各路径分别实现。
  UI 上 v1 只给九个锚点（`v.picklist`，零新 editor），但**文档字段是自由二维点**——UI 的取值
  约束不上升为协议的约束。基点走 `entity.component.update` 写入，不塞进 `entity.transform.set`：
  后者的载荷是 position/size/rotation 的合成值，本来就没有基点的位置。
- **几何数值统一 2 位精度**，事实来源是 core 的 `COMPOSE_GEOMETRY_PRECISION` /
  `roundComposeGeometry` / `formatComposeNumber`。`toComposeTransform` 是 Stage 几何写回文档的
  唯一漏斗，量化放在那里，掐掉非整数 zoom 留下的 `82.96874999999991` 这类浮点残渣；量化
  **不能替代吸附**，该落在网格上的值由各手势自己吸附。显示层（属性面板、物料 Inspector、
  场景尺寸胶囊）一律最多两位小数、整数不补零。量化不作用于布局求解结果——Yoga 的 box 与
  Hug 的文字测量宽度本就是真实小数，且不进文档。property-panel 按包边界不得依赖 core，
  因此包内自带一份等价格式化，这个重复是边界造成的，不是疏忽。
- **动画按场景独立，脚本按页面共享。** 每块场景有自己的动画：清单挂在各自 Frame 上，动画
  文件按 Frame 分区且默认一场景一份；页面配置面板按 `rootIds` 逐场景列出绑定行并标注
  激活/编辑中场景。动画作用域跟随**选中对象所属的场景**，没有选择时回退激活场景，因此
  「哪一块会被发布」与「正在编辑哪一块的动画」可以不同。**动画模式下画布拖拽锁定原父级**
  （Editor 向 Stage 传 `lockGestureParent`）：拖动只表达姿态编辑（自动记录写关键帧），
  不产生跨父级挂载——否则对象会被静默挂进激活场景、打点串进别块场景的动画。页面 setup 脚本相反，保持
  `ComposePageFile` 上的页面级单值：绑定是页面级平坦命名空间，动画自身的播放绑定也解析页面
  作用域，按场景切分脚本会制造一类跨场景移动即失效的悬空引用。这个不对称是设计，不是遗漏。
  **动画绑定是文档写入**：`Animations.source` 住在文档里，因此关联/解除走可撤销的
  `animation.source.set` 命令而不是页面文件写入——走页面文件的话 Store 校验的是上次保存的
  那份文档，刚画出来、尚未保存的场景会被判成「不是 Frame」而绑不上。判据是**看字段住在哪里**：
  `setupScript`、`activeFrameId` 在页面文件上，所以是资源写入且不进撤销历史。
- **根层落点按类型分流。** 在所有场景之外新建时，容器类 Entity 升格为一块新场景（新场景
  的 Clip 归一为不裁剪，与「新建场景」命令一致）；其余 Entity 落进**激活场景**并**保留世界
  落点**——换算成局部坐标后越界也不钳制，场景默认不裁剪因此仍可见。任何新建路径都不得回退到
  `rootIds[0]`——那既选错场景，又会跳过世界→局部换算。点击添加（没有落点意图）不走升格。
- **曲线是带盒的普通 Entity。** 线、弧与多段线由可选的 `Curve` Component 承载几何，
  但**保留 `LayoutItem`**：位置的事实来源仍是 `LayoutItem.offset`（动画位置轨道的路径就是它、
  move 插件写的也是它，`Transform` 只有 `rotation`），形状的事实来源是 `Curve`。去掉盒等于把
  移动、位置动画、场景树、Group 包围盒每条既有轨道各 fork 一份，而每条分支都是一处等着漏的
  钩子。因此曲线一落地就自动拥有场景树节点、属性面板、关键帧与预览。
  **不变量是「`viewBox` 恒等于几何的紧包围盒，盒自由」**，不是「盒尺寸是几何的派生」：盒由
  `LayoutItem` 与布局求解决定，几何按盒与取景框的比例呈现，因此 resize 手柄与 Auto Layout
  都能改它。创建与绘制路径在写几何的同一个事务里把盒设成紧包围盒，那是**初值**而不是不变量。
  几何点是**几何空间坐标**，且归一化后紧包围盒左上角恒为原点；水平线的退化轴钳到
  `COMPOSE_CURVE_MIN_EXTENT`（同时是渲染与命中的分母，两处取不同值会让水平线被拉伸一个说不
  清的比例）。
  **换算只有一个入口**（`projectComposeCurveToBox`）：渲染由浏览器按 `viewBox` 完成，命中与
  捕捉调用它，之后下游一行不改——各自算一遍的话，下一个改盒语义的人只会改到其中一处，而漏掉
  的那处症状是「某些缩放下点不中」。判定留在世界空间（把**几何**变换过去），**不要**把光标点
  变换进几何空间：非等比缩放会把圆形容差变成椭圆，距离比较不再是标量，而这只在扁盒上现形。
  **弧按缩放是否等比分流**——等比仍是精确弧，非等比拍扁成多段线；按某一轴的比例硬算成圆会
  画出一个用户从未画过的形状。
  **几何参与 `viewBox` 变换，描边不参与**（`vector-effect: non-scaling-stroke`）。这与「线宽
  反向除掉画布缩放」不重复，两者各中和一段：前者管 `viewBox` → 盒，后者管 Stage Scene 外层
  HTML 的整体缩放；物料注释里「`non-scaling-stroke` 在这里不管用」说的是**外层**那一段。
  SVG 没有只中和线宽不中和虚线的开关，因此虚线也不参与——规则收成一句没有例外，比逐项列举
  更不容易被后来者改坏。
  `entity.curve.set` 是几何写入的**唯一漏斗**：载荷是 parent 局部坐标，命令在同一事务里写
  `Curve` 与 `LayoutItem`，拆成两条会产生可观察的不一致中间态且撤销变两步。
  几何住 core 的 Component（跨包契约：命中、捕捉、未来的导线求解都读它），描边与端点 marker
  住 Renderer props（只有渲染与 Inspector 读，因此白拿绑定与外观轨道）。
  **填充是唯一的例外，它复用 `Appearance.backgroundPaint`**：填过色的面积要参与命中，而按上面
  那条判据，命中路径读的字段必须是文档级契约。复用还让外观 Inspector、数据绑定与外观动画轨道
  一样都不用做。读取只走 `getComposeCurveFill`，渲染与命中共用它；v1 只画 `solid`，宿主盒与
  共享 Paint 层**不为曲线画任何背景**——盒是矩形而形状不是，画出来是一块矩形色块。
  **marker 是几何**，因此跟着 `viewBox` 变形：整个图形被非等比盒拉扁时箭头没跟着扁才是错的，
  SVG 也没有 `non-scaling-marker`。
  **「让导线看起来在流动」只有一个机制：`strokeDashoffset` 加外观关键帧轨道**，缺席与 0 都不
  写这个属性。**不为它加命令或预设动画**——自动算一个完整虚线周期要 dash pattern 的世界长度，
  而 `strokeDasharray` 眼下是由线宽推出的 picklist，正处在已立项的单位错配里；把周期算进命令
  语义等于把那个缺陷固化。轨道路径是 `['Renderer','props','strokeDashoffset']`，采样器按
  `[componentKey, ...rest]` 写值，因此协议与动画引擎都不需要配合；能打点则要**两处**跟上——
  Inspector 的 Renderer 分组要拿到 `renderFieldAdornment`，自动记录要认 `setRendererProps`。
  少任一处，属性在而用户打不了点。
  **没有第二个画线的物料。**曾经有过一个 `shape`（盒 + `direction ∈ {-1,0,1}²` 编码方向），
  它比曲线只多端点 marker 与椭圆两样——而**椭圆根本不用做**：非正方盒里的整圆经 `viewBox`
  画出来就是椭圆。这是「整圆是扫掠 ±360 的弧」「矩形是四顶点的闭合多段线」同一条判断的第三次
  应用。绘制落地写的是真实几何（两个端点或圆心半径），方向由坐标的差表达。
  **`kind` 是三元联合，两条判断照抄 AutoCAD 的既有解法**：整圆是 `sweep` 绝对值 360 的 `arc`（不另立
  circle）、矩形是四顶点的闭合 `polyline`（不另立 rect）——另立类型会让归一化、平移、距离、
  特征点、渲染与校验六条路径各多一支逐字相同的实现。`closed` 是布尔而不是「首尾顶点重复」。
  **弧的紧包围盒必须把落在扫掠内的象限点算进去**：只用两个端点算，90° 到 270° 的弧鼓出来的
  那一侧会被自己的盒裁掉，而这只在跨象限的弧上出现。
  `composeCurvePoints` 返回的是**决定紧包围盒的那组点**（弧含象限点），**不是端点集合**——
  拿它当端点用会让象限点以端点优先级参与捕捉，还会凭空造出一批相邻点的中点。特征点必须
  自己按 kind 分派。
  **捕捉次序是 `endpoint > midpoint > center > quadrant`**（AutoCAD 的对象捕捉次序）；圆心
  不是任何线段的端点，却是画同心圆、把符号钉在轴上时用户真正要对齐的点。
  **多段线在页面里渲染成一个 `<polyline>` / `<polygon>`**，命中仍由透明加宽 stroke 承担，
  因此拆成 N 个 `<line>` 换不来任何东西。整圆走 `<circle>`——
  SVG 的 `A` 命令在起终点重合时画不出东西，这是六条路径里**唯一**需要为整圆分支的地方。
  平面形状运算（弧、多段线、点到线段距离）住 `core/curve-geometry.ts`。**整个模块放在一起
  而不按消费者拆**——把其中几个函数挪到用得最多的那个包，会让弧的数学横跨两个包，而那正是
  「一半改了另一半没改」的温床；判据是模块内聚性，不是逐函数的消费者计数。
  **`PLINE` 与 `LINE` 的差别是设计**：`LINE` 逐段落地（每段一个 Entity），`PLINE` 攒到结束才
  提交一个 Entity。推论是 `PLINE` 需要「放弃上一点」关键字而 `LINE` 不需要——`LINE` 的放弃等于
  一次文档撤销，`PLINE` 的还在会话里，此刻文档上什么都还没有。
- **曲线的命中判据是点到几何的距离，而这条判据落在两处。** Stage 的**点选是 DOM 驱动**的——
  Entity 节点上挂 `onPointerDown`，命中由浏览器决定，因此线状节点靠 `.is-segment`
  （`pointer-events: none`）加物料内部**透明加宽 stroke**（`pointer-events: stroke`）承担；
  `StageSceneIndex.entityAtPoint` 是另一条路径（取色采样），在 Entity 局部坐标按距离判定。
  两处必须给出一致语义：对角线包围盒的空角在任何一条路径上都不得命中曲线。线状判定按
  `Curve` Component 而不是 Renderer 类型——按物料类型枚举，每加一种线状物料都会漏掉一处。
  `world = (屏幕 − 视口) / zoom`，因此命中相关用例**必须在非 100% 缩放下断言**。
  **填过色的内部同样命中**，两条路径都要跟上（DOM 侧靠指针事件规则覆盖填充区，索引侧靠
  `isPointInsideComposeCurve`）：填色区域是用户看见的墨，而「按距离而不是按包围盒」挡的是
  空白、不是墨。**空心时不做这一步**——那正是「盒里绝大部分是空的」覆盖
  的情形。内部判定**不检查 `closed`**：开放几何按隐式闭合，与 SVG 填充开放几何的规则相同，
  渲染与命中因此自动一致。
  **曲线没有第二套端点选区 UI。**两点直线的端点就在紧包围盒的对角，`viewBox` 落地之后拖盒角
  手柄与拖那个端点落点逐像素相同；`shape` 时代那套端点 UI 存在，只因为它的线没有可用的盒语义。
- **几何编辑是一个对象作用域的模式，复用运动路径那条既有通道。**双击一条曲线进入：夹点显形、
  **盒手柄与选区盒一并让位**、画十字光标、拖动经与绘图命令**同一条**落点解算之后派发
  `entity.curve.set`。`Escape`、点空白、换工具、选中别的对象都退出。
  **让位有三条各自独立的理由**：角手柄与角顶点几乎压在同一个像素上；**盒不是曲线的轮廓**
  （一条对角线的包围盒里绝大部分是空的——这正是命中不按包围盒判的那条理由的视觉版本）；
  **拖夹点时那个盒是过期的**（选区盒由手势的预览变换推出，而夹点拖动走本地几何预览、不产生
  预览变换，因此整个拖动过程里它停在拖动之前的位置）。文字编辑态只去掉填充而留下边框，是
  同一条判断的**另一个结论**而不是不一致：文字占满自己的盒，那个矩形就是对象的轮廓。
  **不为它造第二套顶点机制**：`StageEditablePath` 与 `path` 插件本来就没有动画语义（顶点 id
  对引擎是不透明字符串），复用之后「顶点优先级排在点选之上」「并发中止」「覆盖层压在手柄之上」
  三条白拿。**覆盖层至多渲染一条路径，宿主传入的运动路径优先**，此时不进几何编辑——两条路径
  指向不同的事实。写入方向相反也是设计：宿主传入的那条只上报（它的事实是关键帧，Stage 不认识），
  而曲线几何**就是文档本身**，Stage 为它派发命令，与 resize、move、绘制一致。
  **夹点不是特征点**：特征点是捕捉目标（含弧的象限点与各段中点），夹点是可拖的把手，两者共用
  `projectComposeCurveToBox` 但**不合并**——象限点不是弧的自由度。**弧的每个夹点只改一个自由度，
  另一端一动不动**（圆心平移、起点改起始角并同步扫掠角、终点只改扫掠角、中点只改半径）；
  整圆只出圆心与中点，因为它的起点与终点落在同一个像素上。**正在编辑的对象不参与捕捉**，
  否则夹点会被自己的端点吸回原处；悬停标记与落点解算读同一份排除表。
  **直线的中点夹点是平移**（id 叫 `move` 而不是 `mid`——后者在弧上表示改半径，而按 id 查表的
  调用方手上没有 kind）：两端同加一个位移，长度与方向不变。它**不是拖线身的第二个入口**，
  因为两者吸的东西不是一回事——拖线身走对齐吸附（`{axis, value}` 参考线，来自其他 Entity 的
  包围盒，两轴各自独立），拖夹点走特征点捕捉（二维点，带 `port > endpoint > midpoint >
  center > quadrant` 的优先级与捕捉标记）。直线的包围盒中心恰好等于它的几何中点，因此拖线身
  **可能**靠两轴各自命中而碰巧落对，但没有标记、没有优先级，也够不着任何不是盒角的目标。
  **多段线不因此获得段中点夹点**：段中点是顶点增删的天然位置，用它表示平移会把那条路堵死；
  弧的平移仍是圆心（AutoCAD 没有弧圆心夹点，这是有意的偏离）。
  **双击落在盒手柄上也算**：水平线的包围盒高度接近零，上下两条边缘命中区把整条线盖住，双击
  永远打不到实体本身——而轴对齐的线正是最需要几何编辑的那一类。
  **画完曲线直接进几何编辑**，与「画完文字直接进文字编辑」是同一条规则的第二个实例；绘图
  **命令**产出的对象不进——命令还握着光标与提示，两个「正在取点」的东西叠在一起会让 `Escape`
  的含义说不清。
- **绘图是能力，不是模式。**曾经有过一个绘图模式，它提供命令行、点输入管线、捕捉与八条绘图
  命令——**没有一样需要模式承载**，而模式本身带来三样代价：与动画互斥（`setDrafting(mode ===
  'drafting')` 是三选一切换器的直接后果）、把同一件事拆成两套（矩形在一边是工具栏按钮、在
  另一边是 `RECTANGLE` 命令）、以及让能力不可发现（不进模式就看不见命令行）。因此**命令行
  常驻**，绘图与编辑命令随时可启动，**光标按「当前是否在取点」切换**而不是按模式。
  唯一保留的全局开关是**动画**：它改的是「拖动的结果落在哪里」（写关键帧而不是写
  `LayoutItem`），那是一条真正的语义分叉。判据见路线图决策 10——**模式必须是对象作用域且有
  明确的进出**。
  **选择语义只有一套**：Figma 的替换 + Shift 累加。绘图模式那套「点中即加入、Shift 移出」
  随模式一起删除，原先的理由（「肌肉记忆来自 AutoCAD」）已被推翻——用户不熟 AutoCAD，判据是
  「任务需要什么」。推论：`MOVE` / `ERASE` 的多选走 Shift。方向敏感框选不再被模式偷偷打开，
  判定模式回到**用户自己的设置**——模式不该偷改用户的设置。
  **工具集只保留没有别的入口的动作**：`marquee`、`move`、`pan`、`draw-line` 四个工具值已删除，
  各自都与既有手势完全重复（`select` 空白拖拽即框选、`MOVE` 命令能键入精确位移、空格与中键
  是随时可用的临时覆盖、`LINE` 命令产出 `Curve`）。框选**判定模式菜单改挂 `select`**——
  `select` 在空白处拖拽本来就是框选，判定正是这个动作的参数。
  命令会话状态住在 **Stage 自己**（命令行由 Stage 渲染）：提示文本、橡皮筋预览与捕捉标记是
  同一份状态的三种呈现，交给宿主渲染会凭空造出一个逐帧回传的跨包协议。
  取点插件的优先级排在 **`pan` 之下**——这是对「命令取点最高」那条 CAD 惯例的有意偏离：`pan` 在 Stage
  里是按住空格/中键的临时覆盖，命令进行中仍要能平移画布去看远处那个点。它在**任何命中类型上
  都接管**：命令等着取点时点到已有 Entity，意图是「在那里取一个点」而不是「选中它」。
  **绘制工具与绘图命令是同一能力的两个入口**（拖一下是快、敲命令名是精确），暂时不合并成
  一个按钮：`drafting-point`（1650）高于 `draw`（1000），两者同时武装时点取插件在
  `pointerdown` 就把手势吃掉，拖动永远起不来；而 `pointerdown` 那一刻分不出点还是拖。
  真做要改仲裁器的认领时机。

- **点输入管线与坐标语法住在 `core`，指针取点与键入坐标共用。** 优先级是**键入坐标 > 对象捕捉 > 正交 >
  网格**，其中「键入的坐标不被任何吸附改写」是一条不变量：用户打了 `100,50` 却落在 `96,48`
  看起来像浮点误差、实际是流程错误。捕捉命中后直接短路，不再过正交与网格——捕捉到端点又被
  网格挪走等于捕捉没发生。指针取点与键入坐标**必须走同一条管线**，分叉的症状是「键盘画的和
  鼠标画的落点不一样」，而用户无法判断哪个才对。网格设置两轴独立（`stepX`/`stepY`）——写成
  单一步长会在两轴不等时把一个轴吸到错误的位置；等步的网格填同一个值即可。
- **特征点捕捉与对齐吸附是姐妹查询，不是一个。** `snapCandidates` 返回 `{ axis, value }` 的
  参考**线**（Figma 式对齐），`findStageFeaturePoint` 返回一个二维**点**（落在端点上）。v1 的
  候选只来自带 `Curve` 的 Entity 的端点与中点，**刻意不出盒的角点**——那正是对齐吸附覆盖的
  语义，两套同时生效会在同一次取点里给出互相拉扯的答案。优先级**严格先于距离**（端点压过
  中点，即使中点更近）：同一优先级之内才按距离取最近。
- **端口是 Entity 的能力，不是组件库的能力。**`Ports` 是可选 Entity Component，可以挂在任意
  Entity 上（矩形、图片、组件实例都能有接线点），与 `Interaction` 是同一条判断。`position` 是
  **Entity 局部坐标**，与 `Curve` 的盒局部几何同一个空间，因此换算复用同一个世界矩阵。
  只有 id 与位置：id 稳定是导线绑定不断的前提，而面向用户的名称与方向眼下没有任何消费者。
  空 `items` 非法——不带任何端口的端口声明读不出意图，不再需要时删掉整个 Component，与曲线
  外观「三项全清就整个删掉」是同一条判断。
  **组件实例的端口从离线快照读出，不复制**：组件根 Frame 上声明一次全部实例都有，读取只有
  `getComposeEntityPorts` 一个入口且住在 `core`，因此捕捉一侧不需要认识组件协议——「命中与
  捕捉路径读的字段必须是文档级契约」这条边界由**入口的归属**满足。复制要在创建与每一次刷新
  快照（走 `setRendererProps`）的地方各写一遍，漏一处的症状是「端口停在符号搬走之前的位置」，
  看起来像捕捉坏了而不是同步坏了。实例自己声明的端口压过组件根的。
  **端口捕捉排在端点之前**（`port > endpoint > midpoint > center > quadrant`）：端口几乎总是
  画在符号线段的端点上，端点若在同等距离下胜出，
  用户会画出一条像素级正确但**没有绑定**的导线，而这个错误在屏幕上完全不可见。这也是「优先级
  严格先于距离」第一次真正生效——既有四种候选里端点与中点几乎不会落在同一个点上。
  端口**不画标记**，靠捕捉标记在光标靠近时显出来——常驻标记会让一张接线图上多出几十个与几何
  无关的点；Inspector 是确认「这个符号有哪些接线点」的入口。
- **导线是带 `Wire` 的普通曲线 Entity，几何求解不存储。**`Wire` 只回答「这一端绑到了哪个端口」，
  两端各自可缺席，**缺席即自由端且不存坐标**——`Curve` 就是那个点。没有盒的导线才需要另存一份
  端点坐标；这里存第二份等于给同一个端点造两个事实来源。v1 只支持
  `kind: 'line'`，没有拐点：折线导线的价值几乎全部来自自动路由，而路由还没有。
  **求解住在布局 Runtime**：它需要绑定实例的**盒**（算旋转基点要用真实尺寸，而实例的
  `LayoutItem` 是 Hug、`value` 只是兜底），而求解**会改导线自己的盒**——文档与快照因此必须成对
  产出，分头取会让命中读到的盒与渲染画出的几何差一帧。Runtime 的 `ready` 状态里 `document` 是
  **已解算**的那份、`sourceDocument` 才是输入（身份判定读它）；编辑器与预览都把这一对整对交给
  渲染。**逐条路径回写几何是禁止的**：移动、方向键、Inspector、撤销、粘贴、导入与组件刷新都会
  改端口位置，漏一条的症状是「线错位」，看起来像渲染缺陷而不是数据缺陷。
  **导线与它绑定的实体必须同父级**（`wire.parent-mismatch`）：跨层级要合成整条祖先链的变换，
  限制在同一父级把「嵌套时静默错位」变成一条读得出来的问题。
  **绑定来自取点时记下的来源，不是事后按坐标反查**：反查会让一条恰好路过端口的普通线莫名其妙
  地绑上，而那个绑定在屏幕上完全不可见。因此 `WIRE` 绑、`LINE` 不绑（意图必须显式），键入的
  坐标永远不绑（它没有来源）。**拖动导线端点即改接线**——落在端口上就绑、落在别处就解绑，
  `Wire` 与 `Curve` 写在同一条 `entity.curve.set` 里：分成两条会产生一个可观察的不一致中间态，
  撤销也变两步。
  **悬空引用不让文档非法**：绑定**不完整**（缺字段）是文档非法，**指向不存在的实体或端口**只是
  解算失败——该端保留作者几何并在 Inspector 标为失效。因此**不需要「删除绑定目标时把端点冻结成
  自由端」那套补偿**：那种规则只在校验器拒绝悬空引用时才有存在理由。「还没配」「配错了」
  「配的东西没了」三者必须可区分，与实例动画同一条判断。
- **页面之间只有跳转关系，没有嵌套关系。** Page Slot 已删除：它是「弱化版组件实例」——没有
  属性/结构覆盖、没有变体、编辑期不能下钻、不能离线渲染。复用一块 UI 一律用 Component
  Asset v2 与 Variant。**没有为它写迁移器**：删除时尚无线上资产使用 Page Slot，为零份文档
  写迁移是纯粹的负债。万一残留的 `page-slot` Entity 落到 Registry 既有的「未知 Renderer」
  占位上——几何与外观保留，占位带 `role="status"` 与可访问名称，不会静默丢失内容。
- **跳转是 Entity 的能力，不是某个物料的能力。** `Interaction` 是可选 Entity Component，
  可以挂在任意 Entity 上（矩形、图片、容器都能成为跳转源），v1 只有 `click` trigger 与
  `navigate` / `navigate-back` 两种 action。同一事件在一个 Entity 上只能声明一次，因此
  Inspector 的 trigger 列表上限等于支持的事件数量——没有这条上限，面板能加出第二行 click
  而文档校验会拒绝，用户只看到「点了没反应」。`navigate.target` **允许为 null**：属性面板
  的「添加项」先造默认项、用户才能在那一行挑页面，不允许 null 会让新建交互与选目标互为
  前提；但**不完整**的引用仍然非法——「配错了」与「还没配」必须可区分。运行期 null 目标是 no-op。
- **导航会话没有 `dispose`，这是刻意的。** 它不持有需要显式释放的资源：迟到的加载结果由
  内部令牌挡掉，订阅由订阅方卸载时自己移除。曾经有过一个 `dispose`，而「`useState` 创建 +
  effect cleanup 释放」是宿主最自然的写法——React StrictMode 的**挂载→清理→再挂载**会让
  会话在首次渲染后就永久失效，此后所有跳转静默早退。同类「会话对象」在设计 API 时都要过
  这一关：**端到端跑的是生产构建，StrictMode 双调用在那里不会发生，103 条全绿也挡不住这类
  回归**，只能靠把组件放进 `<StrictMode>` 的组件测试。
- **导航的类型在 `core`、实现在 `pages`、消费在 `preview`**，与 `ComposePageDocumentLoader`
  是同一条既有分层，因此 `preview` 不依赖 `pages`。声明式 `Interaction` 与页面脚本的
  `ctx.navigate` 必须委托**同一个** `ComposeNavigationPort` 实例，否则两条路径各自维护一份
  当前页面与返回栈。会话在提交切换**之前**用 loader 验证目标可读，因此当前页面变化时目标
  一定已可用；目标不存在与读取失败是两个可判别 issue，失败一律停在当前页。
- **编辑期不跳转。** Stage 是布局态：点击带 `Interaction` 的 Entity 只选中它，命中测试与手势
  完全不受该 Component 影响，也不为它引入新的编辑模式。跳转只在预览里生效——`ComposePageHost`
  跟随导航端口决定当前页，渲染该页 `activeFrameId` 指向的场景，切页时给 `ComposePreview` 换
  `key` 整棵重挂载。换 key 不是保险起见：setup 作用域按**脚本引用**去重，两个页面引用同一个
  setup 时不换 key 就会共享 State。交互处理器挂在 Entity 自己的容器上且**不** `stopPropagation`——
  容器是物料的祖先，点击先到达物料再冒泡到容器，两者都要执行。
- **页面预览必须包含未保存的改动。** 宿主把正在编辑的那一页与它的 live 文档一起传给
  `ComposePageHost`（`livePage`）：该页与当前页一致时宿主直接渲染它、**不经过 loader**；
  跳到别的页面才走 loader，跳回来又回到 live 文档。少了这一步，「配好跳转→预览」会呈现
  上次保存的内容，用户只会认为交互没生效——这是页面预览最容易踩的坑。
  同理，打开预览时必须把导航会话 `reset` 到正在编辑的页面：从首页起步会让用户看到的不是
  自己刚改的那一页。**会话还没有起点时宿主直接渲染 live 页并顺带补上起点**——正在编辑的
  那一页就在手上，让用户看见「未设置首页」是无谓的失败态；而没有起点的跳转记不进返回栈，
  返回会变成死键。没有打开任何页面时不进入页面预览——画布上的文档不属于任何页面。
  示例应用的 `?page-preview` 只控制**示例页面上预置的跳转入口**，不再控制页面预览本身——
  首页是编辑器启动时打开的页面，默认往它的内容里加东西会污染所有以空白首页为起点的
  端到端用例。
- 组件实例的覆盖是 `instanceOverrides`，复用 Variant 的稳定操作代数——**七种操作,值与结构各一半**：
  `set-field` / `remove-field` / `add-component` / `remove-component` 改值，
  `add-entity` / `remove-entity` / `move-entity` 改结构。因此在场景里下钻选中实例内部的任意
  Entity、改它任意 Component 的任意字段，都是合法覆盖，**不需要组件预先声明什么可改**。
  「暴露属性已删除」删掉的是那层**声明**（`ComposeComponentPropertyDefinition`），能力本身被
  严格更强的 `set-field` 接管了——旧的暴露属性正是被迁移成 `set-field` 覆盖的
  （`migrateLegacyComposeInstanceOverrides`）。把这条读成「实例只能改结构」会得出「每实例状态
  无处安放」的错误结论。
  一处已知粒度限制：**数组只作为字段整体写入，绝不生成数组下标路径**，因此覆盖清单
  （`Animations.items`）里的一项等于替换整份数组，之后定义端对该数组的改动会被实例遮住；
  这由 Apply/Revert chrome 兜底。
  组件文档只要求单根，且根必须是 Frame。实例内部层级在编辑期用 `实例ID/内部ID` 复合地址
  寻址，只存在于表示层：持久化文档中实例仍是单个 Entity，Undo/Redo 作用在宿主实例的 Patch 上。
  实例的几何与容器属性跟随组件根，尺寸的唯一事实来源是根本身。
- 不要把示例应用中的临时状态或演示交互当成稳定公共 API。

## 架构边界

- `@compose-ui/ui-context` 是跨包共享的 React 主题与国际化 Context，只依赖 React peer；
  第一方 React chrome 包可以依赖它，但必须在构建中外置，避免产生多份 Context 实例。
- `@compose-ui/core` 必须保持与 React 和 DOM 无关，承载 v7 Entity/Component 文档模型、布局快照协议、命令及
  通用逻辑。
- `@compose-ui/assets` 是无 React、无 DOM 的资源 Provider、稳定引用与运行时 Resolver 协议包；
  不得依赖资源浏览 UI、编辑器、文档历史或组件注册表。
- `@compose-ui/script-runtime` 是无 React、无 DOM 的页面 setup Signal、作用域与受信任 JavaScript
  Loader 包，只能依赖 `core` 与 `assets`；不得依赖 Registry、Stage、Preview、Editor 或 UI 包。
  `ctx.navigate` / `ctx.navigateBack` 是宿主注入端口的**转发**，本包不实现导航；未注入时调用
  只产生 diagnostic 而不抛出，setup 同步执行期间的调用同样被忽略。
- `@compose-ui/editor` 是可嵌入的 React 编辑器入口，可以依赖 `core`、`assets`、`pages`、
  `script-runtime` 与既有领域组件，通过公开协议组合页面脚本工作流。
- `@compose-ui/components` 是跨第一方包复用的 React 交互组件层，可依赖 `ui-context`，
  不包含场景、资源 Provider、文档命令或持久化语义。
- `@compose-ui/commands` 是无 React、无 DOM、**零运行时依赖**的命令与键位包，连 `core` 都不
  依赖——动作只是 `run(ctx)`，本包不认识任何文档协议。它是 `ComposeKeybinding` 的唯一定义处，
  同时承载归一化、序列化、事件匹配与平台格式化，以及动作 id 到键位列表的泛型映射；
  `components`、`stage`、`editor` 的键位类型都是它的别名。平台格式化的 `platform` 必填，
  本包不读取 `navigator`。
- **「能敲什么」只有一种形状。**一次性动作（`id/title/run()`）是命令会话（`id/aliases/title/
  `start()`）的**退化情形**——`prompt` 为 `null`、收到确认就提交，而这一档本来就在跑：`ERASE`
  预选时 `prompt` 就是 `null`。因此 `createComposeImmediateCommand` 把动作包成定义，
  `runComposeCommandImmediately` 是跑退化会话的**唯一**实现；各消费者内联「`prompt` 为 null
  就 accept」会让同一条命令在不同入口给出不同结果。合并方向是单向的：会话表达得了一步，
  动作表达不了多步。
  命令的**可呈现半边**独立成 `ComposeCommandDescriptor`（id/别名/标题/分组/检索词/键位/
  不可用原因）且**不带泛型**——只需要列出与检索命令的消费者（命令面板）不该被 `TContext` /
  `TEffect` 传染，「谁能列出」与「谁能跑」因此是两个门槛。可用性是描述符**自己的字段**而不是
  注册表上的查询：列出命令的一方拿到的是一份列表而不是注册表，做成查询会让两处各自判断而漂移；
  它是**已本地化的文案**，本包不认识 locale。
  **别名不本地化。**`title` 随语言变，`id` 与 `aliases` 不变——它们是用户键入的标识，本地化会让
  同一条命令在中英文界面下敲法不同，而肌肉记忆、文档与截图全部失效（AutoCAD 靠 `_LINE` 的下划线
  前缀保住英文名）。别名**只给用户真会去敲的那些**，其余仍可用 `id` 键入；已经有等价画布命令的
  动作**不再造第二个词**（工具切换让给 `RECTANGLE` 这类命令，`edit.delete` 让给严格更强的
  `ERASE`），剪贴板借 AutoCAD 的 `COPYCLIP`/`CUTCLIP`/`PASTECLIP` 避开几何 `COPY`。
  **重名抛错，不兜底**：丢弃后来的会让宿主命令静默消失，覆盖先前的会让内建命令被意外改写，
  两者都要等用户敲下那个词才暴露；重名的含义是「这个词该执行哪条命令无法从注册处读出」，
  运行期没有正确答案。这条由构建期的用例挡在前面。
- `@compose-ui/scene-tree` 是独立受控 React 树组件，可依赖 `components` 和 `ui-context`，
  不得依赖 `core` 或 `editor`；`editor` 可以通过公共入口依赖并默认集成它。
- `@compose-ui/asset-browser` 是独立文件浏览预览和 Monaco 编辑包，可依赖 `assets`、
  `components` 与 `ui-context`，不得依赖 `core`、`editor`、`scene-tree` 或文档历史；
  Provider 类型只从 `assets` 兼容转导。
- `@compose-ui/property-panel` 是由同步 Valibot Schema 驱动的独立受控 React 组件，内建无文档语义的
  Vector2、Size、Color 等基础属性 editor，可依赖 `components` 与 `ui-context`，不得依赖 `core`、`editor` 或
  `scene-tree`；`editor` 只通过 `inspectorPanel` 插槽集成它。
- `@compose-ui/history` 是独立的 React 会话快照历史与受控面板，可依赖 `components` 和 `ui-context`，不得依赖
  `core`、`editor`、`scene-tree` 或 `property-panel`；`editor` 可以通过公共入口依赖并默认集成它。
- `@compose-ui/animation-panel` 是与文档协议解耦的独立动画时间线与关键帧属性组件，可依赖
  `ui-context`，不得依赖 `core`、`editor`、`stage`、`preview` 或任何文档历史；所有操作只改变
  组件自身的 React 会话，`editor` 只把它当作纯 UI 依赖挂载。
- `@compose-ui/component-registry` 是实例级宿主组件注册、Renderer measurement adapter 与页面
  setup 作用域加载 Hook，可以依赖 `core`、`assets` 和 `script-runtime`，以 React 为 peer dependency，
  不得依赖 `editor` 或 `property-panel`；adapter 只能测量隔离内容，禁止读取 Stage/Preview Scene
  Entity DOM。页面渲染入口不得各自复制脚本作用域的加载、热重载与 dispose 竞态逻辑。
- `@compose-ui/component-library` 是项目 Component Asset v2 的 Store、继承/Apply/Revert 领域操作与
  混合组件目录，可依赖 `core`、`assets`、`component-registry`、`components` 和 `ui-context`，
  不得依赖 `editor`、`stage`、`scene-tree` 或 `asset-browser`；Registry Preset 仍是代码物料，
  Project Component/Variant 才是 Provider 资源。
- `@compose-ui/pages` 是无 React、无 DOM 的页面清单、页面目录、页面聚合 Store 与**页面导航
  会话**包，只能依赖 `core` 和 `assets`；不得依赖任何 React chrome、`asset-browser`、
  `editor`、`preview` 或 `stage`。导航会话只决定「当前应该是哪一页」，不渲染、不执行脚本、
  不持有文档。
- `@compose-ui/dxf` 是无 React、无 DOM 的 DXF 导入包，只依赖 `core`。三层纯函数
  （分词 → 记录 → 映射）中**只有映射层认识产物**：分词与记录认的是 DXF 的组码结构，因此
  换目标时一个字符不改。Entity 的 Preset seed 由**调用方注入**，本包因此不认识 Registry、
  物料或任何 UI；记录保留组码/值的**数组**而不是收成映射——`LWPOLYLINE` 的顶点正是重复
  出现的 `10`/`20`，收成映射会只剩最后一个顶点，而这个错误在三角形上看不出来。
  产出是**导入计划**而不是文档：一次导入落两类资源（页面文件与组件文件），分属不同 Store，
  而组件实例需要资源引用与 revision——那些要等组件文件写完才存在，因此计划里**不含**实例
  Entity，宿主建好之后交给 `assembleDxfDocument`。
  **DXF 的块基点就是 `Transform.pivot`**：INSERT 绕块基点旋转，而基点常落在块几何包围盒
  之外（接线端子的基点就在图形外侧的接线点上）——`pivot` 是归一化盒坐标且**不钳制到
  `[0,1]`**，正好接得住。判据是**一段不对称的图形加一个非 90 度的旋转**：基点写成盒中心
  （也就是缺席）时对称图形转出来逐像素相同，这个错误要等到有人导入真实图纸才暴露。
  **图层在导入期被求值掉，不进文档**：byLayer 颜色求值进描边、`visible`/`locked` 落成各自
  Component、图层名落成 Entity 名。不退化成 Group——Group 是空间容器（有盒、参与 Auto
  Layout、拖动会搬走全部成员），而图层是分类，把分类做成空间容器会让用户拖一下就搬走半张图；
  也不新造 Component，沿用端口那条判断（没有消费者的字段不进协议）。
  **文字分两半**：盒走 Hug（盒是会被看见的东西，由布局求解量真实文字），落点用 ascent /
  advance 两个比例估算。它**不构成「字体栈与比例是一对不变量」那类承诺**——那类承诺的理由是
  命中框必须与字形对齐，而这里估算只是导入那一刻的初值。
  **非 1 缩放的 INSERT 按 1 导入并报告**：实例尺寸的唯一事实来源是组件根，`Transform` 里
  也没有 scale，缩放在页面世界无处可放。静默导入与整份拒绝分别是这个功能已经拒绝过的两种
  做法。
- `@compose-ui/interaction-kernel` 是**零运行时依赖**的交互内核包：插件契约、按优先级排序的
  注册表、同时至多一个会话的仲裁器。连 `core` 都不依赖——内核逻辑不认识文档，只有类型签名
  通过 `InteractionKernelProfile` 认识。「内核不认识文档」这条边界由**包依赖**承载而不是命名
  约定：想引用文档类型必须先加依赖，而那条依赖会被本包的边界用例挡下。新文档类型声明自己的
  profile 即可复用同一套仲裁规则，内核一行不改。**本包目前只有 `stage-engine` 一个消费者**，
  与 `canvas-kit` 同一条判断：消费者数量不是判据，零依赖与「不认识文档」才是。
- `@compose-ui/canvas-kit` 是无限画布的 React 底座：滚轮导航 Hook、图面尺寸 Hook、标尺与十字光标，
  只能依赖 `core` 与 `ui-context`，React 为 peer。**无 React 的部分住在 `core`**（视口代数、
  轴点阵、标尺刻度）——headless 的 `stage-engine` 也要用点阵，若点阵搬进以 React 为 peer 的包
  就会造成倒置。三类内容**不得进入本包**：命中测试、场景渲染、手势语义——它们各自认识文档或
  选择集。准入判据是**它认识文档或选择集吗**，认识就不进；这条边界由包依赖与边界用例承载，
  不靠命名约定。
  **本包目前只有 `stage` 一个消费者**，这不是把它折回宿主包的理由：边界用例仍然可执行、仍然在
  挡真实的越界，而消费者数量不是判据——判据是上一句那一条。曾经它服务两块画布，其中一块随
  `CadDocument` 一起删除；消费者减少**不追溯地**让当初的抽取变成错误。
  标尺**只提供画布元素自身的样式，不规定自己坐在哪里**：摆位由各画布的样式表决定，页面画布
  还要给自定义滚动条让位，两处留白不同。`data-testid` 前缀由调用方给出。
  **十字光标同理**：组件是一个 `<g>`，落在调用方自己的 SVG 里；本包给笔，不给位置。它的形态
  输入是**两个布尔**（画线、画框）而不是命令提示——`accepts` 属于命令协议，本包不依赖它；由
  提示推出这两个布尔的那一步留在调用方（**Stage 空闲什么都不画**，页面编辑器的静息光标是
  箭头）。
  `resolveComposeCanvasCrosshair` 是「是否在画」的**唯一**判据（含触摸豁免），调用方拿同一个
  返回值决定绘制与隐藏系统光标：两处各判一次的症状是**画了十字线但系统箭头还在**，屏幕上两个
  光标——那正是 Stage 曾经的样子。十字光标 MUST 钉在**解算后的落点**上而不是裸指针，与橡皮筋
  终点、坐标读数、捕捉标记同一个值；读裸指针的话，开着栅格吸附时十字线就停在用户不会落笔的
  地方。拾取框半边长由调用方给出：**Stage 的只表达靶区、不参与任何命中判定**——Stage 的点选是
  DOM 驱动的，容差散在各物料的 stroke 宽度里，没有全局的那个数（别处的拾取框往往等于点选容差，
  因此「框压住了就点得中」在那些地方成立）。隐藏系统光标的作用域由调用方决定，Stage **只能罩
  到图面**——命令行由 Stage 自己渲染且就在 Stage 里，连它一起收走会让文本光标消失。
- `@compose-ui/stage-engine` 是无 React、无 DOM 的坐标、场景索引、吸附、手势状态机与空间命令
  包，只能依赖 `core`、`interaction-kernel` 与 `commands`，不得依赖任何 React chrome、registry
  或 UI Context 包。仲裁器与注册表来自 `interaction-kernel`，Stage 侧只保留 `StageKernelProfile`
  这一处绑定与既有名称别名，不得再实现第二份仲裁。绘图命令复用 `commands` 的定义与四态推进，
  **本包不实现第二套命令会话**——那个包对 `TContext`/`TEffect` 泛型且零运行时依赖，因此这条
  依赖不引入任何文档知识。
- `@compose-ui/layout-engine` 是无 React、无 DOM 的 Yoga 布局求解包，只能依赖 `core` 与
  `yoga-layout`；Yoga 类型、Node 与 WASM 指针不得进入公共 API。
- `@compose-ui/animation` 是无 React、无 DOM 的场景动画领域包，只能依赖 `core`，不得依赖
  `editor`、`stage`、`preview`、`animation-panel` 或任何 UI Context。关键帧轨道存放在被动画
  Entity 的 `Animation` Component 上，动画清单挂在**所属 Frame** 的 `Animations` Component
  上（`items` 是会话镜像，`source` 是指向动画文件的稳定引用）；core 不认识这两个 Component，
  轨道级校验需要宿主主动调用本包的校验入口。清单级命令（create/delete/configure）必须显式
  传 `frameId`，handler 不接受回退到「第一个根 Frame」。跨 Frame 拖拽用
  `animation.tracks.relocate` 在同一次事务里搬迁轨道，且该命令 MUST 排在结构变更之前——
  源 Frame 由 Entity 当前层级反查，结构先动就会退化成 noop。命令 handler 通过
  `TransactionRuntimeOptions.handlers` 注入，不进入 core 的内建命令表。本包还定义动画文件
  协议（`.animation.json`，只存清单与变量绑定，不存轨道）：文件**按所属根 Frame 分区**，
  编辑器默认一场景一份文件（按「页面名-场景名」命名，身份在 assetKey 上、文件名只是显示名），
  一份文件承载多块场景分区的既有共享文件同样合法；文件是静态权威，编辑器打开页面时按
  assetKey 去重读取并把各分区水合进对应 Frame 的镜像、保存时把各镜像的变化按其绑定的文件
  聚合回写（同一份文件只写一次，单份失败不阻塞其余）；解除引用不删除文件
  资源。`Animations` 整体写入，清单命令与 `animation.source.set` 共用同一个写入口各自带上
  另一半——只写 `items` 会抹掉绑定，只写 `source` 会抹掉清单。
- **命令行只认一份词汇表。**Stage 把宿主注入的命令定义（`ComposeStageProps.commands`）与内建的
  八条合成**一个**注册表，因此不存在「面板里有、命令行敲不出来」的动作。注入的是**定义**不是
  会话——会话仍住 Stage，搬走意味着提示、预览与捕捉标记要逐帧回传。宿主命令的依赖在**注册时
  闭包捕获**，启动上下文保持窄（文案 + 选择集），硬合并会让每加一条命令就往上下文塞一个绝大
  多数命令用不到的字段。启动前先看 `disabledReason`：命令行的三种拒绝必须互相可分——词不在表里
  （未知命令）、词在表里但此刻不可用（缺什么）、会话进行中的非法输入。少了中间这种，敲 `GROUP`
  而没选够对象会什么都不发生，与敲错字在屏幕上无法区分。
  **命令历史分两处**：`ComposeCommandLine` 用上下方向键召回**提交过的文本行**（组件会话状态，
  终端通用行为），Stage 在空闲时把空 Enter 解释成**重复上一条命令**（宿主状态）。两者记的不是
  同一个序列——文本行里混着坐标与关键字，共用会让空确认把上一次键入的坐标拿去当命令解析。
  它们与 `operation-log` 的事务日志也是两件事：一个记「我敲了什么」，一个记「文档变了什么」，
  一条命令可能产生零条或多条事务。
- `@compose-ui/stage` 是 DOM Scene 与 SVG Overlay 组合的无限编辑舞台适配层，可以依赖 `core`、
  `assets`、`canvas-kit`、`script-runtime`、`stage-engine`、`component-registry`、`components` 和 `ui-context`，不得依赖 `editor`、`property-panel`
  或 `operation-log`。
- `@compose-ui/preview` 是可独立嵌入的 React 渲染入口，可以依赖 `core`、`assets`、
  `component-registry`、`script-runtime`、`layout-engine` 和 `animation`（预览对话框的动画
  播放采样），不得依赖 `editor`、`stage` 或 `pages`。`ComposePageHost` 只消费 `core` 的
  `ComposeNavigationPort` 与 `ComposePageLoader` 两个协议类型，实现由宿主注入。
- `@compose-ui/materials` 是 Group、Container、Rectangle、Text、Image、SVG 与 Component Instance Entity Presets、
  Renderer、Component Definitions 与 Capabilities 的独立基础物料包，可以依赖 `core`、
  `animation`、`assets`、`component-registry`、`components`、`layout-engine`、`property-panel`、
  `script-runtime`、`ui-context`、DOMPurify 和 Valibot，不得依赖 `stage`、`editor` 或
  `asset-browser`；`layout-engine` 与 `animation` 都只用于组件实例的独立嵌套文档 Runtime——
  前者求解它的布局，后者按实例播放头采样它。
- **组件实例的播放头是宿主侧的两条 Renderer Prop**（`animation` 与 `animationTime`），走既有的
  `Bindings.rendererProps` 绑定。绑定住在**宿主页面上那个实例 Entity** 自己的 `Bindings` 上，
  因此「每个实例一个值」是构造上成立的：八个刀闸就是八个 Entity，各自绑到页面脚本的八个导出。
  把绑定放进组件文档的 `Animations.bindings` 会撞上「数组只作为字段整体写入」——每个实例都要
  攒一份完整的 `items` 副本，组件作者以后改时长要改八处；而且嵌套文档**根本没有脚本作用域**
  （实例渲染器不向内传 `scriptScope`），那份声明在实例里永远解析不出东西。
  实例内**不持有时钟**：清单条目的 `autoplay` 与 `playbackMode` 被忽略，采样是
  `(document, id, timeMs) → document` 的纯函数，需要连续播放时由页面脚本驱动那个数值。
  养一个每实例的 rAF 会重演「导航会话没有 `dispose`」那条坑——StrictMode 的挂载→清理→再挂载
  会让它在首次渲染后就失效，而端到端跑生产构建，全绿也挡不住。
  采样顺序是**快照 → 实例覆盖 → 采样 → 嵌套 Yoga**：覆盖表达作者意图，采样表达此刻的呈现，
  反过来会让同一份覆盖在不同时刻算出不同结果。`animation` 缺席不采样且**不回退到清单第一条**，
  指向不存在的 id 时保留原值并在 Inspector 标为失效——「还没配」与「配错了」必须可区分。
  **组件的动画内嵌在资产里，没有 `.animation.json`**：实例渲染的是 `resolvedSnapshot.document`，
  它把整份组件文档原样嵌进宿主 Entity，清单就在其中；再配一份文件会出现两份清单，而快照里
  那份才是实例真正播的，文件那份谁也读不到。因此组件文档的空态创建**不落文件**、
  `Animations.source` 恒缺席，组件保存也不需要「把镜像聚合回文件」那段回写——清单在文档里。
  推论：组件保持是一份可移植的文件，拖到别的项目里就能用。
  **创建组件时清单跟着走**：轨道住 Entity 上会被子树复制带过来，清单住 Frame 上不会，
  分家的结果是一份有轨道没清单的文档。`createComponentExtractionPlan` 复制**至少有一条轨道
  落在被提取实体上**的条目，**id 逐字保留**——轨道按动画 id 分组，换 id 会让刚提取出来的
  轨道全部变成悬空分组，而这不被任何校验拒绝，只表现为时间线上什么都不动。是**复制不是搬运**：
  选区可能只是这条动画的一部分，删掉源条目会让没被选中的对象的轨道悬空。复制时丢掉 `bindings`
  （指向页面导出，嵌套文档没有作用域）。这一步**不得塞进 `promoteComposeEntityToFrame`**——
  升格只做一件事，它还有别的调用方。轨道 Component 属于 `animation` 的词汇而 `stage-engine`
  不依赖它，因此「一个 Entity 参与了哪几条动画」由调用方注入。
- `@compose-ui/components` 的命令行是**共享 Pattern**：它只消费 `ComposeCommandPrompt` 与一组
  注入的文案与状态标记，不认识文档、选择集或任何具体命令——正交/捕捉/选择集计数这类各不相同的
  东西以 `status` 标记传入，`data-testid` 前缀由调用方给出。二态标记两种状态都要渲染：只在
  开启时出现会让用户无法确认它现在是关的。
  它**目前只有一个消费者**。`components` 那条准入规则「已经被至少两个第一方包复用」挡的是
  **提前抽象**，而本 Pattern 抽取时确有两个消费者；消费者减少不追溯地让当初的抽取变成错误，
  也不是把它搬回 `stage` 的理由。
- `editor` 与 `preview` 必须通过公开协议共享文档状态，禁止彼此引用内部源码。
- 跨包导入必须使用 `@compose-ui/*` 公开入口，禁止使用 `../../packages/.../src`。
- React、ReactDOM 和 JSX runtime 必须保持为 peer dependency/外置依赖，避免宿主加载多份 React。

## React 组件架构与目录规范

### 分层与依赖方向

第一方代码按职责分为以下五层；依赖只能从较高层指向较低层，现有“架构边界”中的包级约束
比本节的通用分类优先：

1. **Headless Domain / Protocol**：`core`、`assets`、`commands`、`interaction-kernel`、`pages`、`script-runtime`、`layout-engine`、`stage-engine`、`animation`，不得依赖 React 或 DOM。
2. **Shared UI Foundation**：`ui-context`、`component-registry`、`components`、`canvas-kit`，
   提供跨包协议、Context、无业务语义的交互组件与无限画布底座。
3. **Domain Components / Widgets**：`stage`、`scene-tree`、`asset-browser`、`history`、
   `property-panel`、`operation-log`、`command-panel`、`materials`、`animation-panel`，拥有明确领域职责。
4. **Composition / Entry**：`editor`、`preview`，负责组合 Provider、领域组件和宿主协议。
5. **Application**：`app`，只承担集成示例与端到端演示。

不得为了复用方便让低层包反向依赖高层包。需要跨层共享时，先判断应下沉的是无框架协议、
无业务 UI primitive，还是由上层通过 prop、slot、adapter 注入；不得通过深层源码导入、
循环依赖或在低层复制领域类型绕过边界。

### 组件分类

新增或评审 React 组件时必须先确认其类别与归属：

- **Primitive**：Button、Input 等无业务语义基础 UI。
- **Pattern**：Tree、Dialog、SplitPane、VirtualList 等完整但无业务语义的交互模式。
- **Domain Component**：ComposeSceneTree、AssetPreview、HistoryList 等包含领域词汇的组件。
- **Widget**：Stage、ComposeAssetBrowser、ComposePropertyPanel 等可独立完成一块用户任务的组件。
- **Shell**：Editor、Preview 等负责跨域组合、Provider 和宿主接线的入口。

`@compose-ui/components` 只接收 Primitive 和 Pattern。包含 ComposeDocument、资源 Provider、
事务历史、场景命令、物料或编辑器工作流语义的组件必须留在对应领域包。ComposeSceneTree 和
AssetTree 应组合共享 Tree，而不能把业务分支塞回 Tree。

`@compose-ui/components` 的新增共享 Primitive/Pattern 默认以包内 Shadcn CLI 生成的源码为基础；
Shadcn 是源码分发工具而非运行时 UI 黑盒，生成代码必须继续遵守 Compose 命名、Feature-first、
TSDoc、共置测试/Story 与公开入口边界。只有 Shadcn 无法表达所需语义时才可手写，并在实现
注释或 OpenSpec 中说明原因。不得把领域 Widget 迁入该包只为使用 Shadcn，也不得从公共入口
转导原始 Shadcn 名称。Shadcn 语义色必须映射 Compose Theme token，禁止引入 Preflight、默认
`:root`/`.dark` 主题或第二套全局主题状态。

### Feature-first 目录

- 包内默认按功能或公共组件组织目录，不按 `components/`、`hooks/`、`types/`、`utils/`
  等技术类型横向堆放。
- `@compose-ui/components` 中每个公共组件必须拥有独立目录，例如 `src/tree/`、
  `src/dialog/`；目录内共同放置实现、类型、纯模型、样式、测试和可选 Story。
- 复杂领域包按用户能力拆分，例如 Asset Browser 可拆为 `asset-tree/`、`asset-grid/`、
  `asset-preview/`、`script-editor/` 和 `operations/`，而不是建立一个包级大 `components/`。
- 与单一功能绑定的 Hook、类型、常量和辅助函数必须与该功能同目录。只有具有稳定、单一、
  可说明的跨功能职责时才能上移；禁止创建含义模糊的 `common`、`shared`、`helpers` 或
  万能 `utils` 大杂烩。
- 包根 `src/index.ts`/`src/index.tsx` 只定义公共入口；功能目录使用自己的 `index.ts`
  控制导出。其他包不得绕过公共入口导入内部文件。
- 不要求为简单私有 JSX 片段机械创建目录；当它形成独立公共 API、拥有自己的状态机/样式/
  测试，或包含三个及以上协同实现文件时，再提升为独立功能目录。

复杂公共组件建议采用以下结构，并按实际职责删减，不得为凑结构创建空文件：

```text
src/tree/
├── index.ts
├── tree.tsx
├── tree-types.ts
├── tree-model.ts
├── tree-keyboard.ts
├── tree-parts.tsx
├── styles.css
├── tree.test.tsx
└── tree.stories.tsx
```

### React、状态与 Headless 边界

- React 组件负责渲染、Context 消费、DOM 测量、浏览器事件归一化和 Effect 应用；可确定性
  业务规则、几何、状态转换和命令规划优先放入纯函数、reducer、model 或 headless controller。
- 复杂拖拽、虚拟化、异步操作或多阶段交互不得全部堆在一个 TSX 文件中；至少分离状态模型/
  session、React 适配和渲染部分。简单展示组件不应为了形式强制引入 controller。
- 只保存最小且不可派生的状态，避免重复、矛盾和深层嵌套状态。局部瞬时状态留在最近组件；
  Theme/I18n 等横切配置使用共享 Context；文档、事务和资源事实来源遵守各自公开协议。
- Context 不得作为普通 prop 透传或局部状态管理的默认替代。优先使用 props、children、slot
  和组合；只有跨越多个层级且语义稳定的配置才进入 Context。
- Headless 包和协议不得暴露 React Event、HTMLElement 或浏览器对象。React 公共回调优先
  返回规范化的业务数据；确需暴露原生事件时必须在 TSDoc 中说明用途和生命周期限制。

### 公共组件准入与 API

组件进入 `@compose-ui/components` 或成为其他包的公共导出前，必须满足：

- 职责、非目标、受控/非受控模式、默认值和状态归属明确。
- 事件回调表达用户动作或规范化结果，不能要求消费者读取内部 DOM 才能理解结果。
- loading、empty、error、disabled、readonly 等适用状态具有确定行为。
- Theme/I18n 通过 `ui-context` 消费；不得硬编码第一方 chrome 颜色或可翻译文案。
- 样式使用包内语义 token 并与功能同目录；显式 `className`/`style` 的覆盖能力和优先级保持稳定。
- 异步组件定义取消、迟到结果、并发冲突和卸载清理；Blob URL、订阅、observer、model 和
  全局监听必须可释放。
- 公共入口、组件、Hook、函数和类型遵守本文件的 TSDoc 规则；内部实现默认不导出。

只有已经被至少两个第一方包复用，或明确作为经过评审的公共 Pattern/Primitive 发布时，
才能将领域包内组件上移到 `@compose-ui/components`。不得以“未来可能复用”为理由提前抽象。

### 可访问性与测试

- 交互组件必须选择并完整实现对应的 WAI-ARIA Pattern，包括 role、accessible name、状态、
  键盘、焦点进入/退出和焦点恢复；不能只添加 ARIA 属性而缺少交互语义。
- selection、focus、active、expanded 和 checked 是不同状态，不得用一个布尔值或同一视觉
  样式含混表示。虚拟化组件还必须维护正确的集合位置和焦点可达性。
- 纯 model/reducer/算法使用 Vitest；React 契约、键盘、焦点、ARIA、异步清理使用 Testing
  Library；真实布局、Pointer capture、跨包流程使用 Playwright。
- 测试断言用户可观察行为，不以私有 state、内部方法或脆弱 DOM 层级为主要契约。
- 仓库引入 Storybook 前，可复用视觉状态由组件测试与既有黄金图承载；引入后 Story 应与
  功能同目录，并覆盖正常、空、加载、错误、禁用、长文本和大数据量等适用状态。

## 变更规则

- 新能力、公共 API、文档 Schema、架构调整或破坏性变更必须先遵循上方 OpenSpec 流程。
- Bug 修复、文档、测试及非破坏性配置变更可以直接实施，但仍须保持范围最小。
- 新增能力时优先完成一条可运行的纵向流程，再扩展抽象和组件种类。
- 不要提前实现尚未由规范确定的编辑器领域模型。

## Worktree 工作目录

需要在独立分支上工作时，一律使用 git worktree，并且只放在仓库根目录的 `.worktree/` 下，
不得在主检出内直接切换分支，也不得把 worktree 建在仓库之外的同级目录：

```bash
git worktree add .worktree/<change-id> -b <branch>
```

- 目录名使用对应的 OpenSpec change ID（例如 `.worktree/add-page-system`），一个变更一个目录。
- `.worktree/` 已被 `.gitignore` 忽略，因此嵌套在仓库内不会污染主检出的工作区状态。
- 主检出保留给 `main` 与正在进行的未提交改动。禁止把其他分支的改动提交进主检出，也禁止把主
  检出里与当前任务无关的改动一并提交。
- worktree 只包含 Git 跟踪的文件，**不含 `node_modules`**。执行构建、测试或类型检查前必须先在
  该目录运行 `bun install`。
- 用完通过 `git worktree remove .worktree/<change-id>` 清理，禁止直接 `rm -rf`；确有残留时再运行
  `git worktree prune`。

## 验证要求

提交前至少运行：

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

涉及编辑器交互、示例应用或预览行为时，还必须运行：

```bash
bun run test:e2e
```

需要人工查看浏览器操作流程时，运行：

```bash
bun run test:e2e:ui
```

## 文档同步

- 产品定位、目标用户、解决的问题或当前完成度发生变化时，同步更新 `README.md`。
- 面向 AI/开发代理的架构约束或工作流发生变化时，同步更新本文件。
- 项目约定、技术栈、测试策略或外部依赖发生变化时，同步更新 `openspec/project.md`。
- OpenSpec 托管标记内的内容可能被 `openspec update` 重写；项目专属说明应保留在托管块之外。

## 注释规范

### 公共 API

- 所有从包公共入口导出的组件、Hook、函数、类型和接口必须使用 TSDoc；公共接口的属性和
  方法也应说明业务语义、默认行为或能力限制。
- TSDoc 应根据实际需要使用 `@remarks`、`@param`、`@returns`、`@example`、`@throws`、
  `@defaultValue`、`@public` 或 `@internal`，不得机械重复 TypeScript 已表达的类型信息。
- 每个包的公共入口应使用 `@packageDocumentation` 说明包用途和架构边界。

### 实现注释

- 注释优先解释“为什么”、业务约束、算法不变量、状态转换、性能边界、浏览器兼容性和
  看似可以简化但实际不能简化的处理，不得逐句翻译显而易见的代码。
- 复杂状态机、非直观索引换算、批量操作规范化、虚拟化假设和魔法数来源必须在靠近实现的
  位置说明。代码变化导致约束失效时，必须在同一变更中更新注释。
- 源码注释以中文为主，标识符、API 名称和标准术语保留英文；同一条注释中避免无必要地
  混用语言。
- 禁止保留被注释掉的旧代码、修改历史或作者日期；这些信息由 Git 保存。

### 维护标记与抑制

- 维护标记仅使用 `TODO`、`FIXME`、`WORKAROUND`、`PERF`、`SECURITY` 和
  `ACCESSIBILITY`。`TODO`/`FIXME` 必须关联 Issue、OpenSpec change 或负责人，并说明完成或
  删除条件。
- `eslint-disable` 和 TypeScript 抑制必须限制到最小作用域并在同一行说明原因；优先使用
  `eslint-disable-next-line` 和 `@ts-expect-error`，禁止无原因的文件级禁用与 `@ts-ignore`。
- 不使用注释掩盖应通过命名、类型拆分或函数提取解决的可读性问题。

### 测试注释

- 测试名称负责描述行为并追溯到 OpenSpec Requirement/Scenario；测试内注释只解释不明显的
  夹具、边界条件或失败原因。
- Red → Green → Refactor 的命令、结果和失败原因记录在 OpenSpec `tasks.md`，不要复制成
  源码中的长期注释。
