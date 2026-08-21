# animation-panel Specification

## Purpose
TBD - created by archiving change add-animation-panel-prototype. Update Purpose after archive.
## Requirements
### Requirement: 独立动画编辑器组件

系统 MUST 提供不依赖 `editor`、`core`、`stage`、`preview` 或 DOM 文档协议的
`@compose-ui/animation-panel` 包。包 MUST 从公共入口导出能由同一个 Provider 协调的底部时间线和
右侧关键帧属性组件，并支持受控与非受控会话值。

#### Scenario: 分置嵌入动画区域

- **WHEN** 宿主把 `ComposeAnimationTimeline` 与 `ComposeAnimationInspector` 放在同一
  `ComposeAnimationPanelProvider` 的不同布局区域
- **THEN** 两个区域显示同一播放头、选中关键帧和演示数据
- **AND** 不要求宿主提供 ComposeDocument、Stage 或 editor controller

### Requirement: 本地时间线与关键帧交互

系统 MUST 让播放/暂停、播放模式、自动记录开关、播放头拖动或键盘调整、关键帧选择和关键帧字段编辑
只修改 Provider 会话状态；这些操作 MUST NOT 由包自身写入画布、页面文档或撤销历史。包对宿主的
唯一输出是 `onValueChange` 快照与 `onAction` 语义动作，由宿主决定是否把它们翻译成文档命令。

#### Scenario: 选择并编辑关键帧

- **WHEN** 用户选择任意关键帧并修改其时间、插值或值
- **THEN** 时间线选中态和右侧字段立即反映该关键帧自己的时间、值和插值会话值
- **AND** 包自身不触碰任何外部文档

#### Scenario: 头部、物体与属性分行对齐

- **WHEN** 时间线渲染一份含对象轨道与属性轨道的会话
- **THEN** 左侧操作栏（播放、当前时间、尾帧时长、播放模式）与右侧时间标尺同一行
- **AND** 每个对象轨道与其动画片段同一行
- **AND** 每个属性轨道与其关键帧轨道同一行

#### Scenario: 选择属性轨道

- **WHEN** 用户点击左侧某个属性名称或右侧对应关键帧轨道
- **THEN** 名称行与关键帧轨道同时显示选中态，且播放头保持不变
- **AND** 其所属对象轨道与动画片段取消选中

#### Scenario: 调整关键帧时间

- **WHEN** 用户在时间线上水平拖动一个关键帧，或聚焦关键帧并按 ArrowLeft/ArrowRight
- **THEN** 关键帧时间在 0～duration 内以 10 ms 吸附调整，右侧时间字段同步到该关键帧
- **AND** 关键帧保持选中，且不得越过边界或与同一属性轨道已有关键帧重叠
- **AND** 预览播放头保持在调整前的当前播放时间

### Requirement: 关键帧间的插值曲线段

系统 MUST 在同一属性轨道的相邻关键帧之间渲染可交互的插值曲线段。曲线段的中点曲线标识 MUST 在
悬停、键盘聚焦或选中时显示。插值挂在关键帧的**出向段**，因此选择曲线段 MUST 选中该段的**起点**
关键帧，并在右侧属性面板显示该段的时间范围与该起点关键帧的插值；该操作不得移动预览播放头。

#### Scenario: 选择关键帧间的曲线段

- **WHEN** 用户悬停或选择 200 ms 与 300 ms 关键帧之间的曲线段，并点击该段或中点曲线标识
- **THEN** 该段显示曲线标识，右侧属性面板选中 200 ms 关键帧并显示 `200 ms → 300 ms` 曲线区间
- **AND** 缓动编辑区显示 200 ms 关键帧的插值，且播放头保持在点击前的时间

### Requirement: 可编辑尾帧时长

系统 MUST 将时间线控制栏中的尾帧时长作为可编辑数值。修改时长时，标尺、播放范围和位于原尾帧的
关键帧 MUST 同步移动到新时长；时长不得缩短到任一非尾帧之后，避免产生重叠关键帧。

#### Scenario: 延长尾帧

- **WHEN** 用户把默认的 300 ms 尾帧时长修改为 500 ms
- **THEN** 标尺和播放范围扩展到 500 ms
- **AND** 原 300 ms 尾帧移动为 500 ms，其他关键帧保持原位置

#### Scenario: 延长后显示中间主刻度

- **WHEN** 用户把尾帧时长修改为 600 ms
- **THEN** 标尺显示 0、100、200、300、400、500、600 ms 的主刻度标注

### Requirement: 可选择和调整的动画片段

系统 MUST 在片段行渲染可选择的动画片段。用户 MUST 能拖动片段主体平移其时间范围，并能通过起止手柄
调整范围；片段必须保持在时间轴范围内且至少保留 10 ms 时长。片段必须支持键盘 ArrowLeft/ArrowRight
以 10 ms 为步长移动或调整，且所有操作仅更新本地 Provider 会话。

#### Scenario: 选择并收缩动画片段

- **WHEN** 用户点击默认 `Fault` 动画片段并把结束手柄从 300 ms 拖到 250 ms
- **THEN** 片段显示选中态，结束时间更新为 250 ms
- **WHEN** 用户聚焦片段主体并按 ArrowRight
- **THEN** 片段整体移动为 10 ms 至 260 ms，且不改变播放头或页面文档

### Requirement: 三种播放模式

系统 MUST 提供 `play-once`、`loop` 和 `ping-pong` 三种本地播放模式，并在播放时按照当前模式推进
播放头；模式切换必须更新 Provider 会话状态。

#### Scenario: 播放一次与循环

- **WHEN** 用户播放时间线直到播放头到达 300 ms
- **THEN** `play-once` 模式停止在末尾
- **WHEN** 用户选择 `loop` 后再次播放
- **THEN** 播放头从末尾回到 0 ms 并继续推进

#### Scenario: 往返播放

- **WHEN** 用户选择 `ping-pong` 并让播放头越过 300 ms 或 0 ms
- **THEN** 播放头在边界反向并继续播放，而不停止或跳过边界

### Requirement: 参考图一致的可访问视觉结构

系统 MUST 使用共享 Theme/I18n token 表达全部颜色，MUST NOT 硬编码第一方 chrome 前景色，
并在 light 与 dark 两种解析主题下都保持正文、标尺、关键帧与曲线的可读对比度。视觉结构
MUST 保持顶部控制栏、固定轨道列表、可横向滚动的标尺、播放头、菱形关键帧、右侧字段和
缓动编辑区。缓动编辑区 MUST NOT 出现协议不支持的编辑器标签（例如弹簧）。可交互控件必须具有
本地化 accessible name、可见焦点和键盘操作。

#### Scenario: 键盘调整播放头

- **WHEN** 用户聚焦播放头并按 ArrowLeft、ArrowRight、Home 或 End
- **THEN** 播放头分别按 10 ms 调整、跳至 0 ms 或跳至当前时长
- **AND** 右侧时间字段和可访问状态文字同步更新

#### Scenario: 浅色主题下渲染时间线

- **WHEN** 宿主以 light 主题渲染时间线与属性面板
- **THEN** 标尺文字、属性行文字、曲线路径与片段条均相对背景可读
- **AND** 组件不出现浅色背景配浅色前景的组合

#### Scenario: 会话不再携带缓动编辑器标签

- **WHEN** 宿主构造面板会话值
- **THEN** 会话值不包含缓动编辑器标签字段，会话上下文也不提供切换该标签的方法

### Requirement: 编辑器中可见的动画区

`@compose-ui/editor` MUST 在默认底部工具组中提供本地化的“动画”标签，并以
`@compose-ui/animation-panel` 作为纯 UI 依赖挂载时间线。切换动画标签本身 MUST NOT 改变右侧
属性区的内容；只有在时间线中选中动画本身时，属性区才 MUST 切换为动画检查器，选回对象轨道或
属性轨道时 MUST 恢复编辑器原有 Inspector。动画标签成为活动标签时编辑器 MUST 进入动画模式，
该模式下的关键帧编辑与动画参数修改 MUST 通过动画命令写入 ComposeDocument 并参与撤销历史；
播放头、播放状态、自动记录与选择 MUST 保持为编辑器会话状态，MUST NOT 写入文档。
底部工具组 MUST 横跨整个编辑器底边；场景与属性区应位于其上方的主工作区左右分栏，不能限制底部
工具组的水平宽度。

#### Scenario: 激活动画标签

- **WHEN** 用户在编辑器底部工具组选择“动画”标签但没有选中任何动画
- **THEN** 底部显示动画时间线
- **AND** 右侧属性区继续显示编辑器原有 Inspector 内容

#### Scenario: 选中动画切换到动画检查器

- **WHEN** 用户在时间线中选中动画本身
- **THEN** 右侧属性区显示该动画的检查器
- **WHEN** 用户改为选中某个对象轨道
- **THEN** 右侧属性区恢复显示该 Entity 的 Inspector

#### Scenario: 动画编辑器占满底边

- **WHEN** 编辑器同时显示场景区、右侧属性区和已展开的底部动画标签
- **THEN** 底部动画编辑器横跨编辑器完整底边宽度
- **AND** 场景区和属性区仅占用底部工具组上方的主工作区

#### Scenario: 切换回常规工具标签

- **WHEN** 用户从“动画”切换到资源、命令或日志标签
- **THEN** 右侧属性区恢复显示编辑器原有 Inspector 内容
- **AND** 编辑器退出动画模式，画布恢复显示基础文档

#### Scenario: 关键帧编辑进入撤销历史

- **WHEN** 用户在动画模式下打了一个关键帧
- **THEN** 撤销历史新增一条可撤销记录
- **WHEN** 用户拖动播放头或切换播放模式
- **THEN** 撤销历史不新增任何记录

### Requirement: 语义化面板动作回调

`ComposeAnimationPanelProvider` MUST 支持可选的 `onAction` 回调，在每次用户操作时给出描述该操作
本身的语义动作，而不要求宿主从会话快照中 diff 反推。动作 MUST 至少覆盖播放头改变、选择改变、
关键帧移动、关键帧删除、插值修改、时长修改、播放模式切换与自动记录开关。`onValueChange`
MUST 保持现有语义，两者可同时使用。

#### Scenario: 拖动关键帧产生移动动作

- **WHEN** 受控宿主提供 `onAction` 且用户把一个关键帧从 200 ms 拖到 250 ms
- **THEN** 宿主收到一个携带该属性轨道 ID、关键帧 ID 与 `250` 的关键帧移动动作
- **AND** 宿主不需要比较前后快照即可确定发生了什么

#### Scenario: 播放不产生编辑动作

- **WHEN** 时间线正在播放
- **THEN** 宿主只收到播放头改变动作，不收到任何关键帧编辑动作

### Requirement: 宿主驱动的关键帧值与插值模型

`ComposeAnimationKeyframe.value` MUST 支持数值、二维向量与颜色字符串；
`ComposeAnimationPropertyTrack` MUST 声明 `valueKind` 以确定该轨道的值语义与展示格式。
`ComposeAnimationKeyframe.interpolation` MUST 是 `hold`、`linear` 或带四元控制点的 `cubic`
判别联合。右侧属性面板 MUST 按 `valueKind` 选择对应的值编辑控件，MUST NOT 把所有值当作颜色处理。
选中关键帧的插值 MUST 通过缓动预设、曲线控制柄或单行控制点数值编辑，改动 MUST 经 `onAction`
报告给宿主。属性面板显示的插值区间 MUST 表达出向语义，即「本帧 → 下一帧」。
包 MUST NOT 因此依赖 `@compose-ui/core`、`@compose-ui/animation` 或任何文档协议。

#### Scenario: 数值轨道显示数值输入

- **WHEN** 宿主提供一条 `valueKind` 为数值的轨道并选中其中一个关键帧
- **THEN** 右侧值字段是数值输入，而不是十六进制颜色输入

#### Scenario: 二维向量轨道显示两个分量

- **WHEN** 宿主提供一条二维向量轨道并选中其中一个关键帧
- **THEN** 右侧同时显示 X 与 Y 两个可编辑分量

#### Scenario: 选择 cubic 插值后可编辑控制点

- **WHEN** 用户把选中关键帧的插值改为 `cubic`
- **THEN** 缓动编辑区出现曲线画布与单行控制点数值，修改后通过 `onAction` 报告给宿主

#### Scenario: 插值区间按出向语义显示

- **WHEN** 用户选中 200 ms 的关键帧，同一属性轨道的下一个关键帧在 300 ms
- **THEN** 属性面板显示的插值区间是 `200 ms → 300 ms`

### Requirement: 显式片段归属与宿主提供的文案

`ComposeAnimationClip` MUST 通过必填 `trackId` 声明所属对象轨道，面板 MUST NOT 依据 label 或
ID 前缀猜测归属。面板 MUST NOT 内置任何演示数据的文案映射；所有对象与属性名称 MUST 由宿主
通过数据提供。

#### Scenario: 多轨道各自渲染自己的片段

- **WHEN** 会话包含三个对象轨道，每个轨道各有一个 `trackId` 指向自己的片段
- **THEN** 每个片段只渲染在自己那一行，不出现在其它轨道行上

#### Scenario: 选择片段联动同 trackId 的轨道

- **WHEN** 用户选择任一片段
- **THEN** 同 `trackId` 的对象轨道被选中，判定不依赖 label 文本或 ID 前缀

#### Scenario: 宿主文案原样显示

- **WHEN** 宿主提供的对象名称恰好与旧演示数据的标识相同
- **THEN** 面板显示宿主给的名称，不做任何替换

### Requirement: 空会话状态

会话不含任何轨道时，时间线 MUST 渲染由宿主提供的空状态内容，MUST NOT 回退到内置演示数据，
也 MUST NOT 渲染播放控件或占位轨道。宿主未提供空状态内容时 MUST 渲染一个中性的无数据提示。

#### Scenario: 宿主提供创建引导

- **WHEN** 宿主传入不含轨道的会话值与一段空状态内容
- **THEN** 时间线只显示该内容，不出现任何演示轨道或关键帧

#### Scenario: 不回退到演示数据

- **WHEN** 宿主以受控方式传入空会话值
- **THEN** 面板不使用任何内置演示内容填充

### Requirement: 双栏共用垂直滚动

左侧轨道名列表与右侧关键帧车道 MUST 共用同一条垂直滚动。任意一栏滚动时，两栏对应行
MUST 保持在同一视觉行上。右侧出现横向滚动条时 MUST NOT 产生额外的纵向偏移。

#### Scenario: 多轨道超出可视高度后滚动

- **WHEN** 会话包含超出面板高度的轨道数量，用户在任意一栏纵向滚动
- **THEN** 左栏轨道名与右栏关键帧车道的对应行始终对齐

### Requirement: 复用共享交互组件

时间线与属性面板的按钮、数值输入与颜色字段 MUST 使用 `@compose-ui/components` 的 Primitive，
MUST NOT 在包内维护第二套基础控件实现。轨道与属性行的更多操作菜单 MUST 使用
`ComposeContextMenu`。

#### Scenario: 颜色字段使用共享取色器

- **WHEN** 用户在属性面板编辑一条颜色轨道的关键帧值
- **THEN** 使用与其他第一方面板一致的 `ComposeColorPicker` 交互
- **AND** 键盘与焦点行为与其他面板保持一致

### Requirement: 更多操作菜单

对象行与属性行 MUST 通过在行上按下右键打开更多操作菜单，指针入口 MUST 只有右键这一个。行上
MUST NOT 渲染独立的「更多操作」按钮，也 MUST NOT 为这样的按钮保留常驻占位宽度。

键盘 MUST 有等价入口：焦点位于行的命中按钮上时，Shift+F10 与 ContextMenu 键 MUST 打开同一份
菜单。面板 MUST 自己处理这两个按键，MUST NOT 依赖浏览器把它们翻译成 `contextmenu` 事件——
Chromium 只对独立的 ContextMenu 键这么做，而 Mac 键盘上没有该键，仅靠浏览器翻译会让 macOS
用户完全失去键盘路径。键盘触发时菜单的锚点 MUST 由该行的矩形推出，因为键盘事件不携带有意义
的指针坐标。

关键帧车道与单个关键帧上的右键 MUST 额外提供依赖光标时间位置的条目；对象行与属性行标签区域
的右键 MUST NOT 提供这些条目，因为行不表达时间位置。

菜单 MUST 使用 `ComposeContextMenu`，关闭后 MUST 把焦点恢复到打开它的那一行的命中按钮。面板
MUST NOT 在菜单中实现任何文档语义，所有条目 MUST 通过 `onAction` 发出语义动作；删除属性轨道、
删除某个对象的全部轨道，以及在指定时间打点（值由宿主决定）MUST 各有对应的动作类型。

#### Scenario: 行上不存在更多操作按钮

- **WHEN** 用户悬停在某一条对象行或属性行上，或把焦点移入该行
- **THEN** 该行不出现任何「更多操作」按钮
- **AND** 行尾没有为该按钮保留的空位，数值区可以一直排到行的右边界

#### Scenario: 右键打开行菜单并能删除属性轨道

- **WHEN** 用户在一条属性行上按下右键
- **THEN** 菜单打开并包含删除该属性轨道的条目
- **AND** 菜单中不含任何依赖光标时间位置的条目

#### Scenario: 键盘用 Shift+F10 打开同一份菜单

- **WHEN** 用户把焦点移到某一行的命中按钮并按下 Shift+F10 或 ContextMenu 键
- **THEN** 打开的菜单与在该行按下右键得到的菜单条目完全相同
- **AND** 该行为在浏览器不把 Shift+F10 翻译成 `contextmenu` 的平台上同样成立
- **AND** 菜单关闭后焦点回到该行的命中按钮

### Requirement: 时间线滚轮缩放与平移

系统 MUST 在动画时间线的标尺/轨道区域支持 Ctrl/Cmd+滚轮以光标所在时间点为锚点缩放，以及不带
修饰键的滚轮/触控板横向滚动做平移。缩放与平移 MUST 只影响当前 React 会话内的本地展示状态，
MUST NOT 写入 `ComposeAnimationPanelValue`、MUST NOT 触发 Provider 的 `onValueChange`，也
MUST NOT 改变任何关键帧、片段的实际时间数据。

#### Scenario: 按住修饰键滚动缩放

- **WHEN** 用户在时间线标尺或轨道区域按住 Ctrl（或 macOS 上的 Cmd）滚动鼠标滚轮
- **THEN** 时间轴以光标所在的时间点为锚点放大或缩小
- **AND** 缩放前后光标下方对应的时间点在缩放后仍处于光标下方（锚点保持不动）
- **AND** 该操作不修改 Provider 会话值，也不触发 `onValueChange`

#### Scenario: 不带修饰键的滚动做横向平移

- **WHEN** 用户在时间线标尺或轨道区域滚动鼠标滚轮或触控板且未按住 Ctrl/Cmd
- **THEN** 时间线区域按滚动量横向平移，显示更早或更晚的时间区间
- **AND** 播放头位置、关键帧选中状态均保持不变

#### Scenario: 标尺主刻度随缩放级别按可读间距变密或变疏

- **WHEN** 用户放大或缩小时间线
- **THEN** 标尺主刻度的时间步长按当前像素密度重新选取，保持相邻刻度标签之间不小于可读的
  最小像素间距
- **AND** 放大后同一时长内显示的主刻度数量增多，缩小后减少，不出现刻度标签重叠或过度稀疏
- **AND** 标尺次刻度（无标签的细分刻度线）的间距按主刻度步长同步换算，不是与实际时间脱节的
  固定等分

### Requirement: 缩放不改变片段与关键帧的视觉尺寸

系统 MUST 保证缩放只改变动画片段、关键帧、插值曲线段在时间轴上的位置与宽度（随时间比例换算），
MUST NOT 改变这些元素自身的视觉尺寸——片段条的圆角与边框宽度、关键帧菱形的像素大小、拖动手柄
的像素尺寸在任意缩放级别下保持不变。

#### Scenario: 放大后片段条的视觉粗细不变

- **WHEN** 用户放大时间线，使 1 毫秒对应更多像素
- **THEN** 动画片段条的起止位置和宽度按新的像素/毫秒比例重新计算
- **AND** 片段条的高度、圆角、边框宽度与放大前保持一致的像素值
- **AND** 关键帧菱形和拖动手柄的像素尺寸与放大前保持一致

#### Scenario: 任意缩放级别与宿主容器高度下都不产生多余的纵向滚动

- **WHEN** 时间线以任意缩放级别渲染，且宿主容器的可视高度恰好等于内容实际所需高度
- **THEN** 时间线区域 MUST NOT 出现纵向滚动条
- **AND** 播放头两端的装饰性菱形手柄等纯视觉元素 MUST NOT 因为旋转变换而探出时间线的可滚动
  区域边界

### Requirement: 缩放边界钳制

系统 MUST 将缩放级别钳制在合理范围内：缩放级别 MUST NOT 低到使时间线总宽度小于当前可视区域宽度
（避免出现无意义的空白区域），也 MUST NOT 高到使最小关键帧吸附单位（10 ms）对应的像素距离超出
可用范围。可视区域宽度变化（例如宿主容器 resize）时，系统 MUST 重新计算钳制边界并按需回弹当前
缩放级别。

#### Scenario: 缩小到下限后停止响应

- **WHEN** 用户持续缩小时间线，直到总宽度等于当前可视区域宽度
- **THEN** 时间线停止继续缩小，不产生小于可视宽度的时间线内容
- **AND** 不出现横向滚动条

#### Scenario: 容器宽度变化后钳制边界随之更新

- **WHEN** 宿主容器在用户已缩小到下限之后被进一步缩窄
- **THEN** 系统重新计算下限并相应回弹当前缩放级别，避免时间线宽度小于新的可视宽度

### Requirement: 不依赖滚轮的缩放入口

系统 MUST 提供至少一种不依赖鼠标滚轮手势的缩放方式（工具栏按钮或键盘快捷键），并具有本地化
accessible name 与可见焦点，供无法使用滚轮/触控板手势的用户使用。

#### Scenario: 通过工具栏或键盘放大缩小

- **WHEN** 用户使用工具栏缩放控件或聚焦时间线区域后按下缩放快捷键
- **THEN** 缩放级别按预设步长变化，效果与滚轮缩放一致
- **AND** 该控件具有可通过屏幕阅读器识别的本地化名称

### Requirement: 缓动预设与曲线编辑器

包 MUST 导出一个受控的缓动曲线编辑器组件与一张缓动预设表。预设表 MUST 覆盖 Hold、Linear、
Ease in、Ease out、Ease in and out、Ease in back、Ease out back、Ease in and out back，
且每个预设 MUST 只用现有的 `hold`、`linear` 或 `cubic` 判别联合表达，MUST NOT 为此扩展插值
协议。当前插值与任一预设在 1e-6 容差内不匹配时，编辑器 MUST 显示为 Custom bezier。

编辑器 MUST 同时提供三条等价的编辑路径：选择预设、拖拽曲线画布上的两个控制柄、以及提交单行
逗号分隔的控制点数值（形如 `0.5, 0, 0.5, 1`）。拖拽或键盘调节控制柄时，x 分量 MUST 钳制到
`[0, 1]` 以保证时间轴单调，y 分量 MUST 允许越界以表达回弹缓动。数值输入解析失败时 MUST 回滚
到提交前的值。每一次改动 MUST 通过受控回调向宿主报告完整的插值值；组件 MUST NOT 自行保存
除拖拽会话之外的状态，也 MUST NOT 依赖 `@compose-ui/core` 或任何文档协议。

#### Scenario: 选择预设写入对应控制点

- **WHEN** 用户在缓动预设中选择 Ease in and out
- **THEN** 曲线更新为 `cubic-bezier(0.42, 0, 0.58, 1)`，数值行显示 `0.42, 0, 0.58, 1`
- **AND** 宿主收到 `cubic` 插值与该组控制点

#### Scenario: 回弹预设允许 y 越界

- **WHEN** 用户选择 Ease out back
- **THEN** 曲线在段末越过终点值再回落，控制点 y 分量大于 1 时不被钳制

#### Scenario: 拖拽控制柄落到 Custom bezier

- **WHEN** 当前是 Ease in 预设，用户拖动第一个控制柄
- **THEN** x 分量停留在 `[0, 1]` 内，预设显示切换为 Custom bezier
- **AND** 宿主在拖动过程中持续收到更新后的控制点

#### Scenario: 键盘微调控制柄

- **WHEN** 用户聚焦某个控制柄并按方向键，或按住 Shift 再按方向键
- **THEN** 对应分量分别以 0.01 与 0.1 步进调整，且控制柄具有本地化 accessible name

#### Scenario: 非法数值回滚

- **WHEN** 用户把数值行改成 `0.5, 0, abc` 并提交
- **THEN** 数值行恢复提交前的四个控制点，宿主不收到任何插值更新

