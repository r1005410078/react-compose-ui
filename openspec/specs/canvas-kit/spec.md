# canvas-kit Specification

## Purpose
TBD - created by archiving change extract-canvas-kit. Update Purpose after archive.
## Requirements
### Requirement: 无限画布基础包边界

`@compose-ui/canvas-kit` MUST 只承载**与视口有关**的画布底座，MUST NOT 认识任何文档协议、
选择集或领域命令。它 MUST 只依赖 `@compose-ui/core` 与 `@compose-ui/ui-context`，React 为
peer dependency。

以下三类 MUST NOT 进入本包：命中测试、场景渲染、手势语义。准入判据是「它认识文档或选择集
吗」——认识就不进。该判据 MUST 由包依赖与边界用例承载，MUST NOT 只靠命名约定。

本包**目前只有一个消费者**（`stage`）。这 MUST NOT 被当作把它折回宿主包的理由：边界用例
仍然可执行、仍然在挡真实的越界，而消费者数量不是判据——判据是上一段那一条。

#### Scenario: 依赖边界

- **WHEN** 检查本包的依赖清单与源码
- **THEN** 不出现 `stage`、`stage-engine`、`editor` 中的任何一个
- **AND** 源码中不出现文档或选择集类型

### Requirement: 共享视口模型

系统 MUST 用同一份实现承载世界↔屏幕换算、按屏幕位移平移与绕锚点缩放，两个画布 MUST NOT 各
写一份。该实现 MUST 无 React、无 DOM 依赖。

绕锚点缩放 MUST 在**钳制之后**反算视口原点，使锚点在倍率被钳制时仍然精确不动。缩放范围
MUST 由调用方给出而不写死：页面画布有确定尺寸，无限图纸既要看总图也要看单个端子，两者的
合理范围不同。

#### Scenario: 锚点在钳制后仍不动

- **WHEN** 请求的倍率超出调用方给定的范围
- **THEN** 缩放被钳制到边界
- **AND** 锚点的屏幕位置保持不变

### Requirement: 网格与标尺共用同一点阵

画布网格与标尺刻度 MUST 由同一个纯点阵函数与同一套设备像素取整规则产出，使同一世界坐标落到
同一条 1 CSS px 带。标尺刻度 MUST 始终是画布网格线的子集。

投影间距不足以逐条显示时 MUST 按二次幂 stride 抽稀为原网格的子集，MUST NOT 整片隐藏网格。
视觉抽稀 MUST NOT 改变实际吸附步长。

#### Scenario: 刻度是网格线的子集

- **WHEN** 在任意缩放与设备像素比下渲染
- **THEN** 每一条标尺刻度都落在一条网格线上

#### Scenario: 抽稀不改变吸附

- **WHEN** 缩放使部分格线被抽稀隐藏
- **THEN** 图元仍吸附到原始配置的步长

### Requirement: 共享标尺组件

本包 MUST 提供受控的标尺组件：刻度、选择区间与交互回调全部由调用方给出，组件自身 MUST NOT
求解刻度，MUST NOT 产生辅助线、选择或任何文档变更。

标尺 MUST 由 Canvas 2D 绘制并处理设备像素比。跟随指针的游标标记 MUST 以命令式接口更新而不
触发 React 重渲染——指针移动是高频事件。

#### Scenario: 领域交互交还调用方

- **WHEN** 用户在标尺上按下
- **THEN** 组件把事件交给调用方，自身不产生任何副作用

#### Scenario: 游标不触发重渲染

- **WHEN** 指针连续移动
- **THEN** 游标标记跟随更新，标尺组件不因此重新渲染

### Requirement: 共享滚轮导航

本包 MUST 提供滚轮平移与缩放的 Hook。监听 MUST 手动装为**非 passive** 的原生监听——React 的
合成 wheel 是 passive 委托，在其上调用 `preventDefault` 只产生警告，拦不住页面滚动。

监听 MUST 只注册一次，最新的视口与回调 MUST 从内部 ref 读取：把它们放进依赖数组会让监听在
滚动过程中重装并丢帧。缩放 MUST 用指数换算，使放大与缩小对称。

#### Scenario: 滚轮不带动页面滚动

- **WHEN** 用户在画布上滚动滚轮
- **THEN** 画布平移或缩放
- **AND** 宿主页面不滚动

#### Scenario: 放大与缩小对称

- **WHEN** 用户滚动相同的距离先放大再缩小
- **THEN** 视口回到原始缩放

### Requirement: 共享十字光标组件

本包 MUST 提供受控的十字光标：一个只画自己的 SVG 组，加一个决定「是否在画」的纯解析函数。
两块画布 MUST NOT 各写一份——同一个组件的第二份实现必然与第一份漂移。

组件的输入 MUST 是**画线**与**画框**两个布尔，MUST NOT 是命令提示或它的 `accepts`：那属于
命令协议，而本包不依赖它。由提示推出这两个布尔的那一步 MUST 留在各自的画布包里——两块画布的
推导规则本来就不同，把它搬进来等于把差异变成包内的 `if`。

解析函数 MUST 是「是否在画」的**唯一**判据，调用方 MUST 用同一个返回值决定绘制与隐藏系统
光标。两处各判一次 MUST NOT 出现——那会产生「画了十字线但系统箭头还在」这种屏幕上有两个光标
的状态。

解析 MUST 在以下情形返回「不画」：宿主关闭、指针类型为 touch、指针不在图面上、两个形态布尔
都为假。触摸判定 MUST 在解析函数内，MUST NOT 由调用方各自实现：「不画」与「不隐藏系统光标」
必须同时成立。

十字线 MUST 按一对轴向量绘制，MUST NOT 写死到图面边界——以后引入 UCS 时改的是向量来源。
单侧长度 MUST 按视口**较短边**取百分比，与 AutoCAD 的 `CURSORSIZE` 同义，取 100 时贯穿整个
图面。

同时绘制十字线与拾取框时，十字线 MUST 在拾取框处断开，框内 MUST NOT 有线穿过。拾取框的
半边长 MUST 由调用方给出，MUST 随缩放保持屏幕尺寸不变。

组件 MUST 只提供画布元素自身的样式，MUST NOT 规定自己坐在哪里——摆位由各画布决定。
`data-testid` 前缀 MUST 由调用方给出。

#### Scenario: 两个形态布尔独立生效

- **WHEN** 只把画线置为真
- **THEN** 只绘制十字线，没有拾取框

#### Scenario: 线在拾取框处断开

- **WHEN** 画线与画框同时为真
- **THEN** 拾取框内部没有十字线穿过

#### Scenario: 长度按较短边取百分比

- **WHEN** 在 800×600 的图面上把长度百分比设为 10
- **THEN** 十字线单侧长度是 60

#### Scenario: 触摸不绘制

- **WHEN** 指针类型是 touch
- **THEN** 解析返回不画，调用方据此既不绘制也不隐藏系统光标

#### Scenario: 指针离开图面不残留

- **WHEN** 指针离开图面
- **THEN** 解析返回不画

