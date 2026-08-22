# canvas-kit

## ADDED Requirements

### Requirement: 无限画布基础包边界

`@compose-ui/canvas-kit` MUST 只承载**与视口有关**的画布底座，MUST NOT 认识任何文档协议、
选择集或领域命令。它 MUST 只依赖 `@compose-ui/core` 与 `@compose-ui/ui-context`，React 为
peer dependency。

以下三类 MUST NOT 进入本包，因为它们正是两个画布**不能**互相复用的原因：命中测试
（一个按矩形、一个按点到几何的距离）、场景渲染、手势语义（一个点击替换选择、一个点击累加）。
准入判据是「它认识文档或选择集吗」——认识就不进。

#### Scenario: 依赖边界

- **WHEN** 检查本包的依赖清单与源码
- **THEN** 不出现 `stage`、`stage-engine`、`cad`、`editor` 中的任何一个
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
