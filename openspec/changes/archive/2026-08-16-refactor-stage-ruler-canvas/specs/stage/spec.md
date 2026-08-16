## MODIFIED Requirements

### Requirement: 自适应网格标尺与世界原点

Stage MUST 在 24px 顶部和左侧 ruler 内显示随 viewport 与 canvas grid 更新的正负世界坐标，
并在 surface 显示细网格、主网格、红色 X 轴与绿色 Y 轴。画布网格投影间距达到 2 CSS px
时 MUST 显示每条配置网格线；更密时 MUST 只按二次幂 stride 抽稀为原网格子集。视觉抽稀
MUST NOT 改变实际 snap step，标尺仍可按独立可读性阈值抽稀。

标尺 MUST 由 Canvas 2D 绘制，画布网格 MUST 继续由 CSS 多层 gradient 绘制。两者 MUST 共用
同一个纯点阵函数与同一套设备像素取整规则：一条线覆盖以其世界坐标为左边界的那一个设备像素列。
标尺刻度 MUST 始终是画布网格线的子集。标尺 MUST 同时绘制细刻度与带数字的刻度：细刻度按不粘连阈值抽稀，数字按可读性阈值抽稀，
两者与画布网格出自同一点阵，因此细刻度必然落在网格线上、数字刻度必然落在细刻度上。
数字 MUST 在其所属刻度线上居中，两轴一致。

#### Scenario: 平移缩放标尺网格

- **WHEN** viewport 平移、缩放或 grid step/offset/primaryLineEvery 改变
- **THEN** ruler label、tick、细线与主线在相同世界位置对齐
- **AND** 默认 8 单位网格在 75% 与 25% 缩放时分别显示 6px 与 2px 细线
- **AND** 更低缩放只隐藏部分原始格线，节点仍吸附到原始配置刻度

#### Scenario: 刻度线与网格线落在同一位置

- **WHEN** 在 devicePixelRatio 为 1、2 或 3 且缩放为任意比例下渲染
- **THEN** 同一世界坐标的标尺刻度线与画布网格线覆盖同一条 1 CSS px 带
- **AND** 点阵首线按设备像素取整，因此屏幕间距为整数设备像素时每条线都不跨列模糊

#### Scenario: 分数间距下仍保持两者一致

- **WHEN** 缩放使网格屏幕间距不是整数设备像素
- **THEN** 标尺与网格仍落在同一位置，二者的抗锯齿表现一致
- **AND** 系统 MUST NOT 只对其中一方取整而使两者分离

#### Scenario: 刻度数字居中于刻度线

- **WHEN** 标尺绘制任意一条带数字的刻度
- **THEN** 数字的水平中心与该刻度线重合，垂直标尺旋转后仍以刻度线为中心

#### Scenario: 保留细刻度层级

- **WHEN** 标尺在任意缩放下渲染
- **THEN** 细刻度以更短的线绘制，带数字的刻度更长，落在主网格线上的刻度用更亮的颜色
- **AND** 三者的左边界规则一致，均与画布网格线重合

#### Scenario: 显示世界原点交叉

- **WHEN** 世界 `(0,0)` 位于或移入可视 surface
- **THEN** 红色水平 X 轴与绿色垂直 Y 轴在该点交叉
- **AND** 轴线随 viewport 变换且位于节点内容下方

#### Scenario: 标记选择尺寸

- **WHEN** 存在单选或多选并进行 move、resize 或 rotate 预览
- **THEN** 顶部和左侧 ruler 实时标记世界 AABB 起止位置
- **AND** 分别显示最多两位小数的宽度与高度

### Requirement: Stage 包导出边界
The Stage package MUST export `ComposeStage`, compose-prefixed supporting types and `ComposeComponentPalette` from
its root while keeping coordinate, snapping and command planning in stage-engine.

#### Scenario: Stage structure refactor
- **WHEN** the Stage implementation is reorganized
- **THEN** its user-visible grid, rulers, overlays, pointer behaviour, ARIA and stable container test IDs remain unchanged

#### Scenario: 标尺改用 Canvas 绘制
- **WHEN** 标尺渲染层从 SVG 迁移到 Canvas
- **THEN** `stage-ruler-x`、`stage-ruler-y` 与 `stage-ruler-corner` 容器的 test ID 与 ARIA 保持不变
- **AND** 逐刻度 DOM 节点不再存在，刻度位置改由纯点阵单测与视觉黄金图验证

### Requirement: 可拖拽全局辅助线

Stage MUST 允许从 ruler 创建、移动和删除全局世界辅助线。Pointermove MUST 只更新预览；
pointerup MUST 最多派发一个 canvas 命令或 batch，取消 MUST 不修改文档。

顶部（水平）ruler MUST 拖出水平 guide，左侧（垂直）ruler MUST 拖出垂直 guide；ruler 自身的
轴与 guide 的轴互为反向。手势停留在该 guide 所属 ruler 内时，Stage MUST 给出可识别的删除
光标提示，并在 pointerup 删除该 guide。

#### Scenario: 从标尺创建辅助线

- **WHEN** 用户从顶部 ruler 拖入 surface
- **THEN** Stage 预览并创建一条由世界 Y 定位的水平 guide
- **WHEN** 用户从左侧 ruler 拖入 surface
- **THEN** Stage 预览并创建一条由世界 X 定位的垂直 guide
- **AND** grid snap 开启时 guide position 量化到对应刻度

#### Scenario: 从交叉角创建双轴辅助线

- **WHEN** 用户从两个 ruler 的交叉角拖入 surface
- **THEN** 同时预览水平和垂直 guide
- **AND** pointerup 通过一个 batch 创建两条可共同撤销的 guide

#### Scenario: 移动删除或取消辅助线

- **WHEN** 用户移动已有 guide、拖回对应 ruler，或取消手势
- **THEN** pointerup 分别提交 move、delete，取消则恢复原位置且不创建事务
- **AND** guide 创建、移动和删除进入 History 与 Operation Log

#### Scenario: 拖回标尺时提示删除

- **WHEN** 辅助线手势的指针停留在该 guide 所属的 ruler 内
- **THEN** Stage 发出 `guide-delete` 语义光标，UI 显示带删除标记的指针
- **AND** 指针离开该 ruler 后光标恢复为手势的常规光标

## ADDED Requirements

### Requirement: 标尺指针游标线

Stage MUST 在顶部和左侧 ruler 上显示跟随指针世界位置的游标标记。该标记 MUST 是瞬时视图状态，
MUST NOT 写入 ComposeDocument、事务历史或触发文档变更。

#### Scenario: 指针移动时更新游标

- **WHEN** 指针在 surface 或 ruler 上移动
- **THEN** 两条 ruler 各显示一个对应当前指针世界坐标的游标标记

#### Scenario: 指针离开时隐藏游标

- **WHEN** 指针离开 Stage
- **THEN** 两条 ruler 的游标标记消失且不残留最后位置
