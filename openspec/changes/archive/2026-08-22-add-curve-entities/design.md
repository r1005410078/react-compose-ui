# 设计决策

## D1 · 曲线保留盒：`LayoutItem` + 盒局部几何，而不是「无盒 Entity」

口头讨论阶段的方案是 v8 + 去掉 `LayoutItem`。读代码推翻了它：

- 位置的事实来源在 `LayoutItem.offset`。`Transform` 只有 `rotation`（`document-types.ts`），
  动画位置轨道的路径就是 `['LayoutItem','offset']`（`animation-types.ts` 的示例即它），
  Stage 的 move 插件写的也是它。
- 去掉盒意味着位置需要新宿主，移动、位置动画、场景树定位、Group 包围盒、裁剪判定每条轨道
  都要一条曲线专用分支——这正是「第二份实现」，而且每条分支都是一处等着漏的钩子。

保留盒之后，**移动、旋转、位置/旋转关键帧、树、预览当天可用，零新代码**。旋转尤其关键：
命中在 Entity 局部坐标做距离判定（D4），矩阵求逆已由既有代码完成，旋转后的线命中自动正确
——刀闸分/合的原语不需要本刀之外的任何东西。

盒与几何的分工：**盒的 offset 是位置事实来源，几何点（盒局部坐标）是形状事实来源**，盒的
尺寸是几何的派生（紧包围盒）。派生数据入档的风险在「多写入口」，这里只有一个写入口（D3 的
漏斗），与 `Frame.size` 由 `entity.frame.size.set` 同步是同一个模式。

退化轴：水平线的紧包围盒高为 0，而 `LayoutItem` 尺寸校验要求**有限正数**（`layout.ts` 的
`finitePositive`）。退化轴钳到 1，几何点不动——渲染与命中都读几何，1px 的盒余量在屏幕上
不存在。不放宽校验去允许 0：那会波及所有盒模型消费者，为一根线改整个盒协议不值。

## D2 · 几何住 `Curve` Component，描边住 Renderer props

分界线是**谁要读它**：

- 几何的读者横跨多个无 React 包——本刀的窄相位（stage-engine），后续刀的捕捉候选、导线
  端点求解、DXF 导入。它们需要一个 core 级类型契约，Renderer props 是各物料的 Valibot
  私产，core 与 stage-engine 看不见。先例：`Interaction` 就是 core 的可选 Entity Component。
- 描边（颜色、线宽、线型）只有渲染与 Inspector 读。走 Renderer props 白拿三样既有机制：
  Inspector 编辑、数据绑定、未来 `FLOW` 的外观轨道（轨道路径 `['Renderer','props',…]`，
  采样器的路径写入是泛型的）。

CAD 包的 `CadStroke`（byLayer 回退、清除即删键）**不迁**：页面世界没有图层继承，硬造一个
byLayer 语义没有事实来源。等图层问题在后续刀有了答案再谈。

## D3 · 协议版本不变；写入漏斗是 core 内建命令

实测 `validateComposeDocument` 对 Entity 的 components 映射**不做未知 key 白名单**
（`document.ts` 只逐个校验已知 key 与组合规则；`Animation` Component 已经这样住在 Entity 上，
core 的注释明说对它不校验）。曲线 Entity 五个必备 Component 齐全，是合法 v7 Entity。因此：

- `schemaVersion` 保持 7。新增的是**当 `Curve` 出现时**的校验：几何字段合法、必须与
  Renderer 组合、不得与 Hierarchy 组合。
- 一条测试钉住「不含 Curve 的既有文档校验结果逐字不变」。

端点编辑命令进 core 内建命令表（core 认识 Curve，与其他内建几何命令一致），不走
`TransactionRuntimeOptions.handlers`——那是 core 不认识的领域词汇（动画、CAD）的注入口。
命令一次事务写 `Curve` + 重算 `LayoutItem` 尺寸/offset，量化走 `roundComposeGeometry`。

## D4 · 窄相位有两处，实施阶段才发现它们不是同一处（已修正）

提案阶段以为 Stage 的点选走 `StageSceneIndex.entityAtPoint`。**读代码推翻了它**：Stage 的
点选是 **DOM 驱动**的——Entity 的 DOM 节点上挂 `onPointerDown`
（`stage-scene-layer.tsx`），命中由浏览器自己决定；`entityAtPoint` 只有取色吸管
（`paint-sample-plugin`）一个消费者。因此两处都要改，各自的理由不同：

**其一，DOM 与 CSS（用户可见的那条）。** 仓库里已有现成机制：`.is-segment` 给节点
`pointer-events: none`，物料内部用一条**透明的加宽 stroke** 配 `pointer-events: stroke`
承担命中。曲线复用它，但判定改成**按 Component**——`Boolean(getComposeCurve(entity))`，
而不是再加一条 `renderer.type === 'shape' && kind === 'line'` 的分支：「这个 Entity 是不是
线状的」是几何问题，不是某个物料的私事。命中宽度取 `max(12, strokeWidth * 2)` 屏幕像素，
2px 的线按视觉宽度取命中会让用户反复点空。

**其二，`entityAtPoint`（吸管那条）。** 仍按原设计在 `contains` 里追加距离判定：该函数已经
算出 Entity 局部坐标（`applyMatrix(invertMatrix(matrix), point)`），窄相位接在那一步之后，
因此旋转后自动正确。容差从屏幕像素按 zoom 换算由调用方传入。少了它，点击对角线包围盒的
空角会吸到这条曲线而不是它下面那块真正有底色的图层。

宽相位（`bounds` 映射）不动：框选候选、Group 包围盒、裁剪 `isExposed` 继续按盒。判别性
断言：点击盒内空角（对角线盒的空白区）**不得**选中——这是「距离而不是盒」的可观察差异；
`world = (屏幕 − 视口) / zoom`，zoom 恒 1 时漏乘看不出来，**必须在非 100% 缩放下断言**。

## D5 · `shape` 物料不动，`curve` 另立

`shape` 是「盒 + 方向」：端点表达为盒角百分比，resize 盒就是改线。它服务设计场景（自适应
的分隔线、箭头），语义自洽。曲线是「坐标」：端点是数值，捕捉、导线、DXF 都以坐标为契约。
把 shape 改造成坐标语义会破坏它既有的自适应能力；两个物料各管一头，将来若 shape 的使用
全部收敛到 curve 再谈合并——现在合并是提前抽象。

## D6 · 创建路径只有点击添加

点击添加没有落点意图，落进激活场景，与既有根层分流规则一致（点击添加不走升格）。真正的
两点绘制手势属于绘图模式那一刀——它需要捕捉与正交才对，本刀先给一条默认斜线。默认斜线
（而不是水平线）是刻意的：让退化盒不是首次体验，同时让「点空角不选中」在手动验证时立刻
可感。

## D7 · 本刀不动框选与多选语义

页面模式的框选、Shift 多选保持现状，曲线按盒参与框选。CAD 的窗口/交叉语义是**绘图模式的
会话行为**，不是曲线 Entity 的属性——同一根线在页面模式与绘图模式下框选语义不同，语义跟
模式走。放进本刀会把模式切换的一半提前实现一遍。

## D8 · 创建入口落在 Palette，不落在 Stage 工具栏（实施时定形）

Stage 工具栏上的 line/arrow/circle 是**拖拽绘制**工具，而本刀只做点击添加——真正的两点
绘制手势属于绘图模式那一刀，它需要捕捉与正交才对。Palette 的 `external.add` 恰好就是
「没有落点意图的点击添加」这条既有路径，因此曲线是 Palette 可见的 Preset，零新代码。

顺带发现并修掉一处**测试脆弱性**：`pointerDrop` 直接用 `boundingBox()` 作为按下点，而
Palette 是可滚动的——新增一个 Preset 就把靠后的物料挤出视口，此时 `boundingBox()` 仍然返回
坐标（CSS 上可见），按下位置却落在面板之外。helper 补 `scrollIntoViewIfNeeded()`，下一次
新增物料不会再以同样的方式碰倒别人的用例。
