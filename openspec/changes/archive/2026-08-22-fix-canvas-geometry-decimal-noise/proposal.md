# 变更：绘制接上吸附，几何数值统一 2 位精度

## 原因

属性面板里一个刚画出来的容器读作 `位置 X = 82.96874999999991`、`尺寸宽度 = 373.3592610597958`，
而画布上的绘制浮标同时显示 `373 × 249`。同一个值两处不一致，且网格吸附明明是开着的。

排查出三件事，互相叠加：

1. **`draw` 是画布上唯一一条没接吸附的几何手势。** move 走 `snapTranslation`，resize 与两点
   端点走 `snapResizePoint`，辅助线走 `snapValueToGrid`——只有绘制把 `worldPoint()` 的原始
   结果直接送进 `constrainedDrawingPoints` 和 `drawing.commit`。
2. **缩放不是 1 时世界坐标必然带小数。** `world = (screen - viewport) / zoom`，屏幕像素是整数
   而 zoom 是 `0.4822…` 这类值，除法既产生真实小数，也留下 `…4999999991` 这种二进制浮点残渣。
   此前默认视口恒为 `zoom: 1`，屏幕像素与世界单位一一对应，未吸附也**看起来**是整数——问题
   一直在，只是被 100% 缩放盖住了。首次进入自动适配把默认缩放压到 48%，它就每次都现形。
3. **两处显示各自为政。** 画布浮标 `Math.round` 到整数，属性面板 `String(value)` 原样输出 14 位。

## 变更内容

- **绘制接上与 resize 完全相同的吸附**：智能候选优先、无候选回退网格、按住 Cmd 临时禁用。
  起点与终点**都**吸附——只吸终点的话起点仍带小数，宽高照样不是整数。
- **`toComposeTransform` 量化到 2 位小数**：它是 Stage 几何写进文档的唯一漏斗，move、resize、
  旋转与组件提取全部经过。掐掉浮点残渣，同时给真正无法避免小数的路径（父级缩放传导到子级、
  旋转后的 AABB）一个确定的精度上限。
- **所有数值显示统一保留最多 2 位小数**：整数不补零，小数不超过两位。覆盖属性面板的全部
  数值输入、物料 Inspector 的位置/尺寸/边距输入，以及场景标签的尺寸胶囊。
- 精度约定作为 `core` 的公开常量与纯函数导出，可依赖 core 的包共用同一份事实来源。

## 影响

- 受影响的规范：`stage-engine`(Headless 绘制会话)、`compose-document`(新增几何精度约定)、
  `property-panel`(数值显示精度)、`basic-materials`(Inspector 数值显示精度)
- 受影响的代码：
  - `packages/core/src/geometry-precision.ts`（新增）
  - `packages/stage-engine/src/interaction-controller.ts`（绘制吸附）
  - `packages/stage-engine/src/geometry.ts`（`toComposeTransform` 量化）
  - `packages/property-panel/src/semantic-editors/base-editors.tsx`（显示精度）
  - `packages/materials/src/material-inspector-kit/`（显示精度）
  - `packages/core/src/frame.ts`（`formatComposeSceneSize` 走同一精度）

## 非目标

- 不量化布局求解结果。Yoga 解出的 box、Hug 的文字测量宽度本就是真实小数，把它们四舍五入
  会和布局引擎对抗；显示层按 2 位呈现即可，文档里不存在这些值。
- 不改吸附的判定规则（阈值、候选来源、Cmd 禁用），只把绘制接进既有规则。
