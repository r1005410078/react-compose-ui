# stage Specification

## Purpose
TBD - created by archiving change add-infinite-stage-composition. Update Purpose after archive.
## Requirements
### Requirement: DOM 与 SVG 分层 Stage

系统 MUST 提供 `@compose-ui/stage` React 包。`Stage` MUST 使用 DOM Viewport 与 Scene Layer 渲染
Frame、Group 和宿主 React Component，并使用覆盖视口的 SVG Overlay 渲染编辑反馈；首版 MUST
NOT 使用纯 Canvas 2D 场景或公开多渲染后端选择。

#### Scenario: 渲染 Stage 分层

- **WHEN** 宿主使用文档与 registry 挂载 Stage
- **THEN** Frame 和组件渲染在应用 viewport transform 的 DOM Scene Layer
- **AND** 选择、控制点与参考线渲染在不随 zoom 改变控制点尺寸的 SVG Overlay

#### Scenario: 渲染组件内部 Canvas

- **WHEN** definition renderer 返回 ECharts Canvas 或其他宿主 DOM/SVG 内容
- **THEN** 内容正常保留在对应 Component DOM 边界内
- **AND** Stage 不尝试把宿主内容重绘进统一 Canvas

#### Scenario: 显示未知或失败组件

- **WHEN** Component type 未注册或 renderer 抛出异常
- **THEN** 对应节点显示包含 type 的可访问占位
- **AND** 节点仍可被选择并通过命令移动或删除

### Requirement: 受控无限视口

Stage MUST 接收受控 viewport、tool、selectedIds 和 activeFrameId，并通过回调请求替换这些会话
状态。Viewport MUST 使用 screen surface 像素 x/y 与 0.1～8 范围 zoom；viewport、选择、工具和
动态滚动范围 MUST NOT 写入 ComposeDocument、History 或 Operation Log。网格设置与辅助线 MUST
只读取 ComposeDocument v2 canvas。

#### Scenario: 平移无限视口

- **WHEN** 用户使用 pan 工具、Space/中键拖动、滚轮或 scrollbar 平移
- **THEN** Stage 只请求更新 viewport x/y
- **AND** 文档、选择和事务历史保持不变

#### Scenario: 以游标为锚缩放

- **WHEN** 用户在 surface 内使用 Cmd/Ctrl 加滚轮缩放
- **THEN** zoom 被限制在 0.1～8
- **AND** 缩放前位于游标下方的世界坐标在缩放后仍位于同一 surface 位置

#### Scenario: 使用真实 surface 尺寸

- **WHEN** ruler、scrollbar 或宿主布局改变 Stage 可视区域
- **THEN** Stage 上报扣除固定 UI 后的真实 surface width/height
- **AND** Scene、Overlay、ruler、scrollbar 和 fit 计算使用同一尺寸

### Requirement: 多 Frame 与输出边界

Stage MUST 渲染位于世界 `(0,0)` 的可检查文档输出边界，并渲染 rootIds 中任意 Frame 或
Component。输出背景 MUST 使用 document.output，默认透明并显示 1 屏幕像素非缩放边框；
未选中边框 MUST 使用统一的主题中性色且不得复用 X/Y 轴颜色，选中输出检查目标时四边 MUST
统一使用编辑器强调色。Stage MUST 在世界 `(0,0)` 显示固定屏幕尺寸、Godot 风格的前景十字
标记：MUST 精确使用 16×16 `EditorPosition` 双填充轮廓，外层为
`rgba(255,255,255,0.706)`，内层为 `#ff5f5f`；不得以描边线条近似，也不得通过 halo 或轴线
分段在原点周围制造缺口。X/Y 轴 MUST 分别使用 `rgba(245,51,82,0.75)` 与
`rgba(135,214,3,0.75)`。平移、缩放或 output 尺寸变化不得改变其世界锚点。
激活输出检查时不得显示节点变换手柄。Frame MUST 可以嵌套、旋转，并按 clipContent 裁剪或
显示溢出；输出边界不得限制无限 Stage 中的编辑和滚动范围。

#### Scenario: 编辑输出边界外的根组件

- **WHEN** 根 Component 位于文档输出边界外
- **THEN** Stage 仍渲染、选择、移动和 resize 该组件
- **AND** 输出区域只作为网格之上、节点之下的检查目标，不阻止边界外编辑

#### Scenario: 检查透明输出区域

- **WHEN** 用户点击没有节点覆盖的输出区域
- **THEN** Stage 发送 output inspection 回调并清空节点选择
- **AND** 网格透过 transparent 背景可见，边框在任意 zoom 下保持 1 屏幕像素
- **AND** 未选中时四边使用同一主题中性色且不与 X/Y 轴混淆，选中时四边统一使用强调色
- **AND** 原点标记在连续 X/Y 轴之后按 Godot `EditorPosition` 的双填充路径和精确颜色绘制

#### Scenario: 渲染嵌套 Frame 裁剪

- **WHEN** 嵌套 Frame 切换 clipContent
- **THEN** Stage 对越界后代切换 hidden/visible overflow
- **AND** Frame rotation 与后代世界几何保持一致

### Requirement: 选择与框选

select 工具 MUST 支持点击选择、Shift 切换多选、点击空白清除选择和空白拖动 marquee。选择结果
MUST 使用稳定文档 ID，并 MUST 忽略 hidden 节点和完全位于其他 Frame 剪裁范围之外的内容。

#### Scenario: 点击与 Shift 多选

- **WHEN** 用户点击一个可见节点，再 Shift 点击另一个可见节点
- **THEN** Stage 请求按交互顺序包含两个 ID 的选择
- **AND** SVG Overlay 显示对应单选或共同世界包围框

#### Scenario: 框选节点

- **WHEN** 用户从 Stage 空白处拖出 marquee
- **THEN** 与 marquee 相交的可见未锁定节点按确定性场景顺序进入选择
- **AND** marquee 只作为瞬时 SVG Overlay，不产生文档事务

#### Scenario: 点击空白清选

- **WHEN** select 工具下用户点击未命中 Frame 内容或节点的空白
- **THEN** Stage 请求空选择
- **AND** 文档与 activeFrameId 保持不变

### Requirement: 直接移动缩放与旋转

Stage MUST 为可编辑选择提供移动、八向 resize 和 rotation handle。单选与多选 MUST 使用世界几何
计算结果，再转换为各自父节点局部 transform；move 与 resize MUST 使用统一吸附引擎，一次完成
的手势 MUST 只派发一个 transform 命令或 batch。

#### Scenario: 移动单选或多选

- **WHEN** 用户拖动一个未锁定选择或共同包围框
- **THEN** 所有目标在 Pointer 预览中保持相对位置并应用启用的吸附
- **AND** pointerup 只提交一次包含最终局部 transform 的事务

#### Scenario: 八向缩放并吸附活动边

- **WHEN** 用户拖动任一 resize handle
- **THEN** 活动边或角参与智能和网格吸附，且尺寸不会跨过最小正尺寸
- **AND** Shift 保持初始宽高比，Alt 从中心对称缩放

#### Scenario: 旋转选择

- **WHEN** 用户拖动 rotation handle
- **THEN** 选择围绕共同中心旋转
- **AND** Shift 把角度量化到 15°，pointerup 提交一次最终事务

### Requirement: 屏幕距离吸附

move 与 resize MUST 支持网格、可见未选中节点和全局辅助线吸附。节点与辅助线
阈值 MUST 固定为 6 屏幕像素；智能候选 MUST 优先于网格，距离相同时辅助线优先。Cmd/Ctrl MUST
临时关闭全部吸附，节点/辅助线命中时 MUST 显示瞬时参考线。

#### Scenario: 智能吸附优先

- **WHEN** 同一轴在 6 屏幕像素内同时存在辅助线或节点候选且网格吸附已开启
- **THEN** Stage 选择最小智能修正，距离相同时选择辅助线
- **AND** 只在没有智能候选时把 move 左上角或 resize 活动边量化到 grid

#### Scenario: 不同 zoom 下保持吸附手感

- **WHEN** 用户在不同 zoom 下把选择拖到智能候选 6 屏幕像素范围内
- **THEN** Stage 使用换算后的世界距离得到相同屏幕阈值
- **AND** 参考线与最终吸附位置在屏幕上对齐

#### Scenario: 临时关闭全部吸附

- **WHEN** 用户在变换或辅助线拖动期间按住 Cmd/Ctrl
- **THEN** 几何跟随原始指针且不量化到 grid、不显示 snap guide
- **AND** 松开修饰键后吸附可以继续参与当前预览

### Requirement: Pointer 手势原子性与取消

Stage MUST 使用原生 Pointer Events、独立活动 Pointer session、pointer capture 与
`requestAnimationFrame` 合并瞬时更新。pointermove MUST NOT dispatch；正常 pointerup 或
buttons 为 0 的遗漏松手恢复路径 MUST 使用最终坐标且最多 dispatch 一次。Escape、
pointercancel、window blur 或匹配当前活动 session 的真实 lostpointercapture MUST 恢复手势
开始前画面且不创建事务。子节点冒泡、不同 Pointer、旧 generation、finishing/ended session
或正常 release 后迟到的 lostpointercapture MUST 被忽略。

#### Scenario: 下一帧前快速松手

- **WHEN** 多次 pointermove 已排入 rAF，但用户在下一帧执行前 pointerup
- **THEN** Stage 同步使用 pointerup 最终坐标完成 preview 和一次正式提交
- **AND** 迟到的旧 rAF callback 不修改新手势或重复提交

#### Scenario: capture 事件不拥有活动手势

- **WHEN** pointer capture 失败，或收到子节点冒泡、不同 Pointer、旧 release 的迟到
  lostpointercapture
- **THEN** 当前活动 session 继续由唯一 window 路由接收 move/up/cancel
- **AND** 正常松手仍恰好提交一次

#### Scenario: 取消进行中的手势

- **WHEN** 用户按 Escape、浏览器发出 pointercancel、window blur，或 Stage 根节点在 buttons
  非零时真正丢失当前 Pointer capture
- **THEN** DOM Scene 与 SVG Overlay 恢复手势前几何并清理临时 UI
- **AND** runtime 未收到 transform 命令

### Requirement: 分组与重设父节点

Stage MUST 允许根或 Frame 内的同父级混合选择通过 group 创建 Frame，并允许 ungroup 任意含孩子
Frame。SceneTree 与 Stage MUST 使用同一 nullable reparent 规划器保持世界几何。

#### Scenario: 根级分组和取消分组

- **WHEN** 用户组合根级 Frame/Component 并随后取消组合
- **THEN** 选择先变为新 Frame，再变为提升后的孩子
- **AND** 每个动作最多提交一个事务

### Requirement: Stage 键盘命令

Stage 聚焦且目标可编辑时 MUST 支持 Delete/Backspace 删除、方向键移动 1 世界单位、
Shift+方向键移动 10、Cmd/Ctrl+D 复制、Cmd/Ctrl+G group 和 Cmd/Ctrl+Shift+G ungroup。输入框、
可编辑元素或 IME 活动时 MUST NOT 拦截这些命令。

#### Scenario: 键盘微调并合并重复

- **WHEN** 用户连续按方向键移动相同选择
- **THEN** Stage 派发带稳定 mergeKey 的 transform 命令
- **AND** 重复按键可以在事务合并窗口内作为一个历史动作撤销

#### Scenario: 不拦截文本输入

- **WHEN** 焦点位于 input、textarea、contenteditable 或正在进行 IME 组合
- **THEN** Stage 不派发删除、复制、分组或微调命令

### Requirement: ComponentPalette 拖入

ComponentPalette MUST 允许 Component 和 Frame descriptor 落到最深合法 Frame或 Canvas；Pointer
和键盘路径 MUST 使用同一 selection/hit 父级规则且不依赖 activeFrameId。

#### Scenario: 拖到空白 Canvas

- **WHEN** 用户把 Component 或 Frame 拖到没有 Frame 命中的世界点
- **THEN** 节点作为 rootIds 末尾的根节点创建并选中

#### Scenario: 拖到嵌套 Frame

- **WHEN** 用户把 Component 或 Frame 拖到可见未锁定的嵌套 Frame
- **THEN** 新节点成为该 Frame 的最后一个孩子
- **AND** 提交后的世界中心匹配 drop 点

### Requirement: Frame Palette 拖入

ComponentPalette MUST 可以在 registry components 前显示 Frame presets。StageDragController MUST
以附加 API 支持 Frame Pointer 与键盘新增，同时保持既有 componentType API；Frame drop MUST
创建真正的根级 Frame。

#### Scenario: Pointer 居中创建根 Frame

- **WHEN** 用户把 Frame preset 拖到任意 Stage 屏幕位置
- **THEN** Stage 在对应世界点居中创建根级 Frame并追加到 rootIds
- **AND** 新 Frame 被选中并成为 activeFrame，不会嵌套进已有 Frame

#### Scenario: 键盘新增 Frame

- **WHEN** 键盘用户激活 Frame Palette 项
- **THEN** Frame 在当前 viewport 世界中心创建
- **AND** 只产生一个 frame.create 事务

#### Scenario: 保持 Component 拖入兼容

- **WHEN** 旧宿主继续调用 StageDragController 的 start/add componentType 方法
- **THEN** Component 仍只允许创建在有效未锁定 Frame 内
- **AND** Frame presets 不改变旧 drop target 方法签名

### Requirement: Stage 统一节点样式

Stage MUST 对 Frame、Group 与 Component wrapper 应用 resolved node style。Style border MUST NOT
改变文档几何；Frame/Component MUST 保持裁剪，Group MUST 保持可见子节点的原溢出语义。

#### Scenario: 渲染通用节点样式

- **WHEN** 三种节点包含背景、边框、圆角、透明度或 shadow
- **THEN** Stage 在对应节点边界渲染样式
- **AND** 选区、手柄、吸附和世界坐标不因边框宽度改变

### Requirement: 自适应网格标尺与世界原点

Stage MUST 在 24px 顶部和左侧 ruler 内显示随 viewport 与 canvas grid 更新的正负世界坐标，
并在 surface 显示细网格、主网格、红色 X 轴与绿色 Y 轴。画布网格投影间距达到 2 CSS px
时 MUST 显示每条配置网格线；更密时 MUST 只按二次幂 stride 抽稀为原网格子集。视觉抽稀
MUST NOT 改变实际 snap step，标尺仍可按独立可读性阈值抽稀。

#### Scenario: 平移缩放标尺网格

- **WHEN** viewport 平移、缩放或 grid step/offset/primaryLineEvery 改变
- **THEN** ruler label、tick、细线与主线在相同世界位置对齐
- **AND** 默认 8 单位网格在 75% 与 25% 缩放时分别显示 6px 与 2px 细线
- **AND** 更低缩放只隐藏部分原始格线，节点仍吸附到原始配置刻度

#### Scenario: 显示世界原点交叉

- **WHEN** 世界 `(0,0)` 位于或移入可视 surface
- **THEN** 红色水平 X 轴与绿色垂直 Y 轴在该点交叉
- **AND** 轴线随 viewport 变换且位于节点内容下方

#### Scenario: 标记选择尺寸

- **WHEN** 存在单选或多选并进行 move、resize 或 rotate 预览
- **THEN** 顶部和左侧 ruler 实时标记世界 AABB 起止位置
- **AND** 分别显示最多两位小数的宽度与高度

### Requirement: 可拖拽全局辅助线

Stage MUST 允许从 ruler 创建、移动和删除全局世界辅助线。Pointermove MUST 只更新预览；
pointerup MUST 最多派发一个 canvas 命令或 batch，取消 MUST 不修改文档。

#### Scenario: 从标尺创建辅助线

- **WHEN** 用户从顶部或左侧 ruler 拖入 surface
- **THEN** Stage 预览垂直或水平 guide，并在 pointerup 创建一个文档 guide
- **AND** grid snap 开启时 guide position 量化到对应刻度

#### Scenario: 从交叉角创建双轴辅助线

- **WHEN** 用户从两个 ruler 的交叉角拖入 surface
- **THEN** 同时预览水平和垂直 guide
- **AND** pointerup 通过一个 batch 创建两条可共同撤销的 guide

#### Scenario: 移动删除或取消辅助线

- **WHEN** 用户移动已有 guide、拖回对应 ruler，或取消手势
- **THEN** pointerup 分别提交 move、delete，取消则恢复原位置且不创建事务
- **AND** guide 创建、移动和删除进入 History 与 Operation Log

### Requirement: 无限画布滚动条

Stage MUST 在 surface 右侧和底部提供 10px 自定义 scrollbar。虚拟范围 MUST 包含可见节点、世界
原点、当前可视 world rect 及每边至少一屏 padding，并在当前挂载会话内只扩不缩。Scrollbar
MUST 只修改 viewport。

#### Scenario: 拖动滚动条平移

- **WHEN** 用户拖动水平或垂直 thumb
- **THEN** viewport 按虚拟 world range 平移且 Scene、grid、ruler、guide 同步更新
- **AND** ComposeDocument、History 与 Operation Log 保持不变

#### Scenario: 动态扩展无限范围

- **WHEN** 内容、平移或 thumb 到达现有虚拟范围边缘
- **THEN** 对应方向至少扩展一个可视 world span
- **AND** 已建立范围不因节点删除或缩小而跳回

#### Scenario: 键盘操作可访问滚动条

- **WHEN** 聚焦 scrollbar 后使用 Arrow、Page、Home 或 End
- **THEN** viewport 按小步、翻页或边界规则移动
- **AND** scrollbar 暴露 orientation、controls、valuemin、valuemax 与 valuenow

### Requirement: 可配置 Stage 快捷键

Stage MUST 接受可选 locale 与快捷键配置，并在未提供时保持 zh-CN 和现有默认键位。默认动作
MUST 包括临时平移、select/pan 工具、适配选择/Frame、100%/放大/缩小、grid/smart snap、
duplicate、group/ungroup 和 delete；动作只通过现有会话回调或 dispatch 边界生效。

#### Scenario: 执行默认 Stage 快捷键

- **WHEN** Stage 聚焦且用户使用默认 V/H、F/Shift+F、primary+0/Equal/Minus、Shift+G/S 或编辑命令键位
- **THEN** Stage 执行对应工具、适配、缩放、吸附或文档命令
- **AND** 会话动作不产生文档事务，编辑动作仍只产生既有事务

#### Scenario: 执行自定义临时平移键

- **WHEN** 宿主把临时平移动作绑定到非 Space 键并按住该键拖动
- **THEN** Stage 使用新键临时平移 viewport
- **AND** Space 不再触发该动作

#### Scenario: 忽略可编辑与组合输入

- **WHEN** 键盘事件来自可编辑元素或处于 IME composing
- **THEN** Stage 不执行导航、工具、适配、吸附或临时平移快捷键
- **AND** 现有文本编辑行为保持不变

### Requirement: 临时平移生命周期

Stage MUST 在统一 pointer capture 决策边界识别临时平移，使拖动可以从空白、Frame 或节点开始。
临时平移期间 MUST 只请求 viewport 更新，并在 keyup、window blur、pointercancel 或
lostpointercapture 时清理按键与手势状态。

#### Scenario: 从任意命中区域临时平移

- **WHEN** 用户按住临时平移键并从 Stage 空白、Frame 或节点开始拖动
- **THEN** viewport 按指针位移更新
- **AND** selection、document、History 与 Operation Log 保持不变

#### Scenario: 清理中断的临时平移

- **WHEN** 临时平移期间发生按键释放、窗口失焦、pointer cancel 或失去 capture
- **THEN** Stage 结束手势并清理临时按键状态
- **AND** 后续普通点击或拖动不会继续平移

### Requirement: Stage 内建本地化

Stage 的默认 toolbar、ruler/scrollbar ARIA、空状态、错误占位与手势反馈 MUST 支持 zh-CN 和
en-US；宿主 renderer 和 registry label MUST 保持原文。

#### Scenario: 使用英文 Stage chrome

- **WHEN** 宿主以 en-US 挂载 Stage
- **THEN** Stage 内建可见文案和可访问名称显示英文
- **AND** Frame 名称、registry label 与组件业务内容不被翻译

### Requirement: Stage 包导出边界

`@compose-ui/stage` MUST NOT 重导出坐标、矩阵、画布几何、空间命令、SceneIndex 或 interaction
controller，也 MUST NOT 提供 `StageDragController`、`dragController` prop 或兼容 facade。
消费者 MUST 从 `@compose-ui/stage-engine` 导入 headless API，并使用
`interactionController` 连接 Stage 与 Palette。

#### Scenario: 使用新的破坏性导入边界

- **WHEN** 消费者升级 Stage 与 Editor 的 major 版本
- **THEN** UI 组件和 StageFramePreset 继续从 stage 包导入
- **AND** 几何、命令与 controller 只从 stage-engine 包导入

### Requirement: 异步资源节点创建

Stage MUST 使用 assetResolver 和 Registry seed factory 异步创建资源节点，最多并发读取四项。
成功项 MUST 以一个事务创建，失败项 MUST 被排除并形成精确汇总。

#### Scenario: 单项固有尺寸创建

- **WHEN** 用户把图片或 SVG 放到 Stage
- **THEN** 最长边不超过 512 且小图不放大，无法读取尺寸时回退 320×180
- **AND** 成功 drop 恰好创建并选中一个节点事务

#### Scenario: 批量网格创建与部分失败

- **WHEN** 多项资源中至少一项解析成功
- **THEN** 成功项按最多四列、24 世界单位间距排列，第一项中心位于 drop 点
- **AND** 一个 batch 只包含成功项并选中这些节点

#### Scenario: 等待期间父级失效

- **WHEN** 异步读取期间目标 Frame 被删除或锁定
- **THEN** 成功节点回退到 Canvas 根并保持 drop 世界锚点

#### Scenario: 资源解析取消

- **WHEN** Stage 卸载或 assetResolver 更换
- **THEN** pending drop 被中止且不派发命令
