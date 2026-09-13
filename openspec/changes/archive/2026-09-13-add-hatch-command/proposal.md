# 变更：HATCH 命令——点一下，填满围出来的那块面

## 原因

今天的填充属于**对象**：一个矩形的底色是它自己 `Appearance.backgroundPaint` 上的一个字段。
但用户指着的常常是一**块面**——矩形的三条边加上圆弧的一段围出来的那块，或者四条互相穿过的
直线围出来的那块。**没有任何一个 Entity 的几何是那块面**，因此今天做不到：只能手动描一个多段线
盖上去，而它与真正的边界没有任何关系，边界一动就错位。

接线图上这件事很常做——按电压等级给一片分区着色、给一块柜体内部打底、把一条母线段所辖的范围涂出来。

最容易想到的解法是「让对象自己的填充按周围的线裁切」，**这条错了**：一条导线穿过设备外框时，
外框的底色会被切成两块，而接线图上导线天天穿过外框；它还让 `backgroundPaint` 的含义取决于图上
**别的**对象，而这个字段要参与命中、数据绑定与动画采样。

设计稿：`docs/mockups/drafting-hatch.html`（九格，含竞品对照与两处换色入口）。

## 变更内容

- **新增 `HATCH` 命令**（别名 `H`，绘图分组，不给单键——七个绘图裸字母已占满，与 `TRIM` 同一条）。
  在一块面内点一下：从落点向外射线进面、沿边绕行、回到起点即闭合，落成填充。
  图上所有可见曲线自动是边界，**不用先选**；悬停即预览，点下即落地一个事务，会话留着继续填下一块。
- **边界恰好是某一个 Entity 的完整几何时，改它的 `backgroundPaint`，不新建**；否则落成一个新的
  曲线 Entity，插在最靠后的那条边界之下。判据是「**完整**几何」——被任何交点切开过就不算，
  否则自交折线会把两个环一起填上。两支由悬停预览与命令行提示分别说明。
- **`core` 新增 `Hatch` Component 与区域求解**：`Hatch` 只有一个 `seed`（Entity 局部坐标），
  用于显式的「重新生成」；求面的绕行算法住 `core/curve-region.ts`，复用既有的三个求交函数。
  岛复用既有的 `path.subpaths` + `fillRule: 'evenodd'`，**协议其余部分一个字节不改**。
- **`commands` 的 `pick` 输入补一个 `point`**：填充的落点在**空处**，没有 target 可言；
  宿主手上本来就有这个点（`drafting.pick` 效果带着它），只是没往下传。`badge` 联合加 `'bucket'`。
- **不封闭就拒绝，并把断口画出来**：v1 **没有间隙容差**（Affinity Designer 的同款取舍）。
  走不下去的那个节点画一对琥珀记号——复用失效端点那个 token，因为缺口就是图上的一处失效。
- **新增 `hatch` Preset**（有填充、**无描边**，`paletteHidden: 'toolbar'`），与工具栏上的一格。
  图标是本套图标里**第一枚带参数的**：桶身轮廓走 `currentColor`，只有漆面填当前色。
- **当前填充色记在编辑会话**（宿主的一个 ref，不写文档、不写偏好），合法性与 `POLYGON` 的边数同源
  ——它被**印出来**了（就印在桶身上）。两条入口：工具栏 split button 的色板弹出层，与命令进行中的
  `C` 关键字；色板列的是**这一页已经用过的颜色**，不内置色表、不加文档字段。
- **重算是显式的**：v1 不自动跟随边界。Inspector 上一个「重新生成」按当前边界重跑同一次求解，
  失败则保留原几何并标为失效——与悬空的导线绑定同一套「还没配 / 配错了 / 配的东西没了」。

## 影响

- 受影响的规范：`commands`（`pick` 带落点、`bucket` 徽标）、`compose-document`（`Hatch` Component、
  区域求解）、`stage-engine`（`HATCH` 命令、两支解算与规划）、`stage`（悬停预览、断口记号、
  光标徽标、命令行两句提示）、`basic-materials`（`hatch` Preset 与 Inspector 的重新生成）、
  `editor-workspace-layout`（绘图货架一格、目录项、带参数的图标）
- 受影响的代码：
  - `packages/commands/src/command/command-types.ts`（`pick` 的 `point`、`badge` 联合）
  - `packages/core/src/hatch.ts`（新：`Hatch` Component 与校验）
  - `packages/core/src/curve-region.ts`（新：射线进面、绕行找环、岛、收成最窄 kind）
  - `packages/core/src/document-types.ts`（`COMPOSE_BUILTIN_COMPONENT_KEYS` 加一项）
  - `packages/stage-engine/src/drafting/hatch-command.ts`（新：会话与定义）
  - `packages/stage-engine/src/commands/curve-hatch.ts`（新：区域解算与规划）
  - `packages/stage-engine/src/commands/world-shapes.ts`（新：从 `curve-trim.ts` 提出的共享换算）
  - `packages/stage/src/drafting/use-stage-drafting.ts`（`pick` 落点、悬停预览、当前色）
  - `packages/stage/src/drafting/stage-drafting-overlay.tsx`（候选面、断口、桶徽标）
  - `packages/materials/src/curve/definition.tsx`（`hatch` Preset）
  - `packages/editor/src/stage-toolbar/{stage-toolbar-icons.tsx,toolbar-shelf.ts,default-stage-toolbar.tsx}`
- 不受影响：`Curve` / `Wire` / `Ports` 协议与版本号，`entity.curve.set` 的载荷语义，导线求解，
  手势插件与仲裁器，十字光标的既有各档。
- 与在途变更 `add-crosshair-style-preference` **不冲突**：那条管十字线的**样式**（`fade` / `halo`）
  且明写「样式 MUST NOT 参与形态推导」，本条管 `pick` 这一档画什么**形态**（拾取框加桶徽标、
  不画十字线）。两者都动 `stage`，但落在互不相同的 Requirement 上。
