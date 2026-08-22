# stage Specification

## Purpose
TBD - created by archiving change add-infinite-stage-composition. Update Purpose after archive.
## Requirements
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

### Requirement: 选择与框选

select 工具 MUST 支持点击选择、Shift 切换多选、点击空白清除选择和空白拖动 marquee。marquee
工具 MUST 支持从任意位置（含节点之上）拖出 marquee。两个工具的框选 MUST 使用同一个受控
`policy.marqueeMode`，Stage MUST 只消费该值而不得自行持有模式的事实来源——Stage 本身不提供
切换模式的 UI。选择结果 MUST 使用稳定文档 ID，并 MUST 忽略 hidden 节点和完全位于其他 Frame
剪裁范围之外的内容。

#### Scenario: 点击与 Shift 多选

- **WHEN** 用户点击一个可见节点，再 Shift 点击另一个可见节点
- **THEN** Stage 请求按交互顺序包含两个 ID 的选择
- **AND** SVG Overlay 显示对应单选或共同世界包围框

#### Scenario: 框选节点

- **WHEN** 用户从 Stage 空白处拖出 marquee
- **THEN** 按当前 `policy.marqueeMode` 命中的可见未锁定节点按确定性场景顺序进入选择
- **AND** marquee 只作为瞬时 SVG Overlay，不产生文档事务

#### Scenario: 使用框选工具从节点上起框

- **WHEN** 工具为 marquee 且用户在一个可见节点上按下并拖动
- **THEN** Stage 显示 marquee Overlay 而不是移动该节点
- **AND** 释放后按当前 `policy.marqueeMode` 请求选择

#### Scenario: Overlay 区分判定模式

- **WHEN** 当前生效判定为包含
- **THEN** marquee Overlay 使用实线边框
- **AND** 当前生效判定为相交时使用虚线边框

#### Scenario: 点击空白清选

- **WHEN** select 工具下用户点击未命中 Frame 内容或节点的空白
- **THEN** Stage 请求空选择
- **AND** 文档与 activeFrameId 保持不变

### Requirement: 直接移动缩放与旋转

Stage MUST 只允许当前工具暴露的 move、resize 或 rotate 手势；每种变换 MUST 在拖动或方向键移动 Flow
时把它转换为 Absolute 后移动，除非该次拖动落在同一 `nowrap` Layout 容器内部且未越过其边界——此时
MUST 按容器内原地重排处理，保持 Flow 并只改变 `Hierarchy.childIds` 顺序。`wrap`/`wrap-reverse` 容器
与方向键移动 MUST 保持转换为 Absolute 的既有行为。Resize Fill axis MUST 转为 Fixed；Rotation MUST
保持 Flow 与 sizing。全部操作 MUST 使用开始 Snapshot 并维持现有 preview/cancel/一次提交保证。

#### Scenario: 拖动 Flow 转为 Absolute

- **WHEN** 用户在允许移动的 Stage 工具中拖动一个或多个 Flow Entity 越过其所在容器边界，或该容器为
  wrap，并正常松手
- **THEN** preview 保持开始世界几何并跟随指针，提交后目标为 Absolute final offset
- **AND** Hierarchy.childIds 顺序不因此改变

#### Scenario: nowrap 容器内拖动保持 Flow 并重排

- **WHEN** 用户在 Stage 拖动一个 nowrap 容器内的 Flow Entity，全程未越过该容器边界，并正常松手
- **THEN** 提交后该 Entity 仍为 Flow，LayoutItem 不变
- **AND** Hierarchy.childIds 按拖动落点重新排序

#### Scenario: Flow 结构操作禁用

- **WHEN** 当前 Group/Ungroup 目标包含 Flow Entity
- **THEN** 菜单和快捷键使用相同 availability 禁用该操作并提供可读原因
- **AND** Delete、Lock、Visibility 与 Rotation 仍按各自能力执行

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
duplicate、copy/cut/paste、group/ungroup 和 delete；动作只通过现有会话回调或 dispatch 边界生效。

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
The Stage package MUST export `ComposeStage`, compose-prefixed supporting types and `ComposeComponentPalette` from
its root while keeping coordinate, snapping and command planning in stage-engine.

#### Scenario: Stage structure refactor
- **WHEN** the Stage implementation is reorganized
- **THEN** its user-visible grid, rulers, overlays, pointer behaviour, ARIA and stable container test IDs remain unchanged

#### Scenario: 标尺改用 Canvas 绘制
- **WHEN** 标尺渲染层从 SVG 迁移到 Canvas
- **THEN** `stage-ruler-x`、`stage-ruler-y` 与 `stage-ruler-corner` 容器的 test ID 与 ARIA 保持不变
- **AND** 逐刻度 DOM 节点不再存在，刻度位置改由纯点阵单测与视觉黄金图验证

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

### Requirement: 分组与重设父级

Stage MUST 允许 Canvas 或 Container 内同父级、顶层、Absolute 选择通过 group 创建 first-class Group，
并只允许 first-class Group 或历史 Group 兼容结构执行 ungroup。普通 Container MUST 保留其内容、裁剪与
布局语义而不再充当 Group。SceneTree 与 Stage MUST 使用同一 nullable reparent 规划器保持世界几何。

#### Scenario: 根级分组和取消分组

- **WHEN** 用户组合根级 Entity 并随后取消组合
- **THEN** 选择先变为具有 Group 图标的新 Group，再变为提升后的子项
- **AND** 每个动作最多提交一个事务且世界几何不变

#### Scenario: Container 不可解除分组

- **WHEN** 用户选择普通 Container
- **THEN** Ungroup 菜单与快捷键显示稳定不可用状态且文档不变

### Requirement: ECS DOM 与 SVG 分层 Stage

Stage MUST 使用 ComposeDocument v4 Entity 渲染 DOM Scene，并用 SVG Overlay 渲染编辑反馈。
Entity MAY 同时渲染 Renderer 内容和 Hierarchy 子项；未知 Renderer MUST 降级且 Entity 仍可选择。

#### Scenario: 渲染可渲染容器

- **WHEN** Entity 同时拥有 Renderer、Hierarchy、Appearance 和 Clip
- **THEN** Stage 先渲染 Renderer 再渲染子项
- **AND** Appearance、裁剪、旋转和嵌套世界几何正确应用

### Requirement: 统一 Entity Palette

Component Palette MUST 只消费 ComposeEntityRegistry Presets，不再区分 Frame Preset 与 Component
Definition。Container、Rectangle、Text、Image、SVG MUST 使用相同拖入和键盘新增流程。

#### Scenario: 拖入五种基础 Preset

- **WHEN** 用户依次拖入 Container 与四种 Renderer Preset
- **THEN** 每次都创建合法 v4 Entity 并选中新实体
- **AND** 不产生旧 Frame/Component Node

### Requirement: 按约束显示变换手柄

Stage MUST 仅为允许编辑的选区显示对应手柄：free 显示八向，preserve-aspect 显示四角，
horizontal 显示 E/W，vertical 显示 N/S，none 不显示 Resize；rotatable 为 false 时不显示旋转。

处于画布内文字编辑会话时，Stage MUST NOT 为编辑目标显示任何 Resize 或旋转手柄，改为只显示单一
编辑边框以区别于普通选中态。该抑制与 TransformConstraints 的抑制是两条独立规则，叠加生效。

边缘命中区两端为角手柄让出的空间 MUST 随可用长度收缩并至少保留 8px 可抓长度：固定让位会让十几
像素高的选区把 E/W 命中区算成零高度，边根本抓不住。

#### Scenario: 动态切换几何限制

- **WHEN** Inspector 修改 TransformConstraints
- **THEN** Stage 手柄和直接操作立即同步
- **AND** 禁用但仍可选择的 Entity 保留选择框

#### Scenario: 短选区的边缘命中区仍可抓取

- **WHEN** 选区高度只有十几像素
- **THEN** E/W 边缘命中区仍保留可抓长度，不会被让位挤成零高度
- **AND** 足够长的选区仍为角手柄让出两端 8px

#### Scenario: 编辑态不显示变换手柄

- **WHEN** 一个 free 约束的文字 Entity 进入画布内编辑会话
- **THEN** 八向手柄与旋转手柄都不显示，只显示编辑边框
- **AND** 退出编辑后按其 TransformConstraints 恢复显示手柄

### Requirement: ECS 上下文菜单与结构操作

Stage 上下文菜单 MUST 根据 Hierarchy、Lock 与 TransformConstraints 计算 copy、cut、paste、
duplicate、group、ungroup、delete 和视图操作状态，不得读取旧 kind。

#### Scenario: 取消容器分组

- **WHEN** 单选含子项的可编辑 Hierarchy Entity
- **THEN** 菜单启用取消编组并保留现有快捷键提示

### Requirement: Stage 右键操作菜单

Stage MUST 在节点和空白画布使用共享右键菜单呈现编辑、视图、工具和吸附操作。编辑区 MUST 在
创建副本之前显示复制、剪切和粘贴。

#### Scenario: 右键未选节点

- **WHEN** 用户右键未选中的可见节点
- **THEN** Stage 先请求单选该节点并显示适用编辑操作

#### Scenario: 右键菜单显示当前 Stage 键位

- **WHEN** Stage 打开节点、视图、工具或吸附菜单
- **THEN** 每个实际配置的动作在菜单末尾显示当前 `shortcuts` 的全部键位
- **AND** 自定义配置立即生效，空数组隐藏提示，禁用菜单项仍保留已配置的提示

### Requirement: Paint SVG Overlay 与采样适配

ComposeStage MUST 仅根据 Engine snapshot 渲染线性、径向、角向的可访问 SVG 控制柄和 sample hover。控制柄仅在单选实体的背景 Paint editor 打开时显示；React adapter 负责 pointer capture、native client 坐标和 effect 应用，不得实现 Paint 几何。

#### Scenario: 退出 Paint 编辑

- **WHEN** Popover 关闭、选择变更、Escape、blur、pointercancel 或 document 变更
- **THEN** Stage 清除 Paint overlay 与 preview
- **AND** 非正常结束不产生事务

### Requirement: Layout Runtime 状态界面

Stage MUST 接受可选 Layout Runtime；缺省时创建实例。loading 时 MUST 暴露 aria-busy 并禁止场景
交互，error 时 MUST 显示可访问错误，ready 时才挂载 Entity Scene。

#### Scenario: 异步进入 ready
- **WHEN** Stage 挂载后 Yoga loader 尚未完成再成功完成
- **THEN** 先显示布局加载态且不允许选择或变换
- **AND** ready 后使用当前文档的首个 Snapshot 一次性显示正确场景

### Requirement: 平移帧的场景渲染范围

平移与缩放 MUST 只更新 DOM Scene 根节点的变换，MUST NOT 重建 Entity 内容子树。只在 viewport
变化时，Stage MUST NOT 遍历全部 Entity 重新计算世界包围盒。

#### Scenario: 平移只更新场景变换

- **WHEN** 只有 viewport 发生变化
- **THEN** 场景根节点的 transform 更新为新的平移与缩放
- **AND** Entity 渲染器不重新渲染

#### Scenario: 内容边界惰性求值

- **WHEN** Engine 已经发布滚动范围，用户继续平移
- **THEN** Stage 不再为兜底内容边界遍历全部 Entity
- **AND** 滚动条位置与范围与之前保持一致

### Requirement: 宿主接管 Stage 快捷键动作

`ComposeStage` MUST 接受可选的快捷键动作接管回调。命中某个可配置动作时，Stage MUST 先询问宿主；
宿主表示已接管时 Stage MUST 阻止浏览器默认行为并停止内建处理，不得重复执行。宿主未接管或未提供
该回调时，Stage MUST 保持既有内建实现。

按住不放的临时平移 MUST NOT 参与接管，始终由 Stage 自身的手势生命周期处理。方向键微调与 Escape
取消不属于可配置动作，同样不参与接管。

#### Scenario: 宿主接管编辑动作

- **WHEN** 宿主提供接管回调并对 group 动作返回已接管
- **THEN** Stage 不再自行规划或派发 group 命令
- **AND** 浏览器默认行为被阻止，事务由宿主一侧产生

#### Scenario: 宿主拒绝接管

- **WHEN** 宿主提供接管回调但对某个动作返回未接管
- **THEN** Stage 继续执行该动作的内建实现
- **AND** 行为与未提供回调时一致

#### Scenario: 临时平移不受接管影响

- **WHEN** 宿主提供接管回调并按住临时平移键拖动
- **THEN** Stage 仍按自身手势生命周期临时平移 viewport
- **AND** 接管回调不会因该动作被调用

#### Scenario: 独立使用保持内建行为

- **WHEN** 宿主未提供接管回调
- **THEN** 全部既有 Stage 快捷键行为不变

### Requirement: Stage 页面 setup 值预览

Stage MUST 接受由宿主组合的可选页面 Script Scope/绑定解析端口，并使用 runtime value Props 渲染 Entity。
State/Computed 更新 MUST 精确刷新依赖 Entity；脚本缺失或错误 MUST 回退 authored Props。Stage MUST NOT
自行加载脚本资源，也不得依赖 Editor 或页面 Store 实现。

#### Scenario: 画布显示响应式页面值

- **WHEN** Text Prop 绑定页面 State 且 Effect 修改其 `.value`
- **THEN** Stage 在不修改 ComposeDocument 的情况下显示新文本
- **AND** Scene Tree、选择、事务历史和未依赖 Entity 不因运行值变化重置

#### Scenario: setup 失败回退字面内容

- **WHEN** 页面 setup 无法加载或绑定值不通过 Prop Contract
- **THEN** Stage 使用 Renderer authored Prop 并显示非阻断 diagnostic
- **AND** 其他 Entity 和编辑手势保持可用

### Requirement: Stage 编辑模式禁止方法副作用

普通 Stage 编辑模式 MUST 保持已绑定方法 Prop 的存在形状，但用户用于选择、移动、缩放和打开上下文
菜单的 Pointer/Keyboard 操作 MUST NOT 执行页面方法。未来允许方法执行的交互预览模式不属于本变更。

#### Scenario: 点击绑定 onClick 的 Entity

- **WHEN** 用户在普通 Stage 中点击一个 onClick 已绑定的 Button Entity
- **THEN** Stage 只执行既有选择命中行为且页面 State 不变
- **AND** Renderer 不因方法 Prop 完全缺失而切换视觉分支

### Requirement: 画布内原地文字编辑

Stage MUST 为声明了原地文字编辑契约的 Entity 提供画布内编辑：编辑目标以其最终排版样式原地渲染为
可编辑文本，MUST NOT 用浮层输入控件替代——浮层的字形排版与最终渲染不是同一套，宽度对不上会让
所见即所得在编辑瞬间断掉。编辑目标 MUST 获得键盘焦点，并 MUST 在退出会话后把焦点交还 Stage surface。

以文字工具创建的文字 MUST 以空内容进入编辑，MUST NOT 保留 Preset 的占位文案——占位文案会逼用户
先全选删除再打字。

`draw-text` 的绘制预览 MUST 只显示一根与行高等高、落在按下点的光标，MUST NOT 显示占位文案、尺寸
标注或任何边框：文字只按点创建、尺寸由内容决定，边框会暗示一块用户控制不了的区域，尺寸标注会
暗示一个用户改不了的数字，而占位文案等于承诺一段并不会存在的内容——松手即消失，看起来就是闪了
一下。

编辑期间 Stage MUST NOT 发布任何文档事务。退出编辑时 Stage MUST 按内容收敛为最多一条可撤销事务：
内容为空发布一次删除该 Entity 的命令；内容非空且有变化发布一次 Renderer props 设置命令；内容非空且
未变化不发布任何命令。

判定顺序 MUST 是「先看是否为空，再看是否变化」：点击创建的文字本就是空的，若「未变化」优先，
用户点完立刻退出就会在文档里留下一个看不见也选不中的空文字。因此内容为空时 MUST 删除，无论用户
是否敲过字。

Auto width（Hug）文字在输入过程中 MUST 通过既有 measurement 失效链路实时改变宽度，MUST NOT 引入
第二条测量通道。由于编辑期间文档不变，Stage MUST 把编辑中的文本写入 Registry 的编辑中值覆盖通道，
使渲染与测量看到同一个值；退出编辑时 MUST 清除覆盖，MUST NOT 让覆盖值残留到下一次会话之外。

Stage 作为 Controller 的宿主，MUST 供给编辑会话所需的三项事实：把指针事件的连击计数归一化后随
`pointer.down` 传入；向 Registry 查询后以 context 提供「某 Entity 是否可原地编辑」的判定；处理
`drawing.commit` 创建实体后，以 context 回灌本次绘制实际创建的 Entity。提交时 Stage MUST 向 Registry
查询该 Entity 的可编辑 prop 名称，MUST NOT 按物料类型硬编码 prop 名。

#### Scenario: 编辑中文本经覆盖通道驱动渲染与测量

- **WHEN** 用户在编辑会话中逐字键入
- **THEN** Stage 只更新编辑中值覆盖，不派发任何文档命令
- **AND** 退出会话后覆盖被清除，Entity 回到 authored props 的呈现

#### Scenario: 点击创建后直接输入

- **WHEN** 用户以文字工具点击画布并随即键入内容，然后点击画布其他位置
- **THEN** 编辑一开始就是空内容，画布上只显示所键入的文字而没有占位文案
- **AND** 历史中只增加一次文本设置事务，且 Auto width 宽度在键入过程中实时跟随内容

#### Scenario: 双击已有文字改写并提交

- **WHEN** 用户双击一段已有文字，改写内容后按 `Esc`
- **THEN** 文档更新为新内容且该 Entity 保持选中
- **AND** 撤销一次即回到改写前的内容

#### Scenario: 空内容退出时删除文字

- **WHEN** 用户退出编辑时文字内容为空
- **THEN** 该文字 Entity 被删除
- **AND** 撤销可恢复该 Entity

#### Scenario: 绘制预览只显示光标

- **WHEN** 用户以文字工具在画布上按下并保持，随后拖动
- **THEN** 预览自始至终只有一根落在按下点的光标，没有边框、尺寸标注或占位文案
- **AND** 光标的位置与高度不随拖动改变，松手后画布上不出现一闪而过的文字

#### Scenario: 点击创建后未输入即退出不留残余

- **WHEN** 用户以文字工具点击创建文字后一个字都没敲就退出编辑
- **THEN** 该空文字 Entity 被删除，文档中不留下不可见的残余
- **AND** 撤销可恢复它

#### Scenario: 内容未变化不产生事务

- **WHEN** 用户进入编辑后没有改动**非空**内容就退出
- **THEN** 不产生任何文档事务
- **AND** 历史面板不增加条目

### Requirement: 受控工具模式与专属选区反馈

Stage MUST 支持受控的 `select`、`move`、`scale`、`rotate`、`pan`、`draw-container`、
`draw-rectangle`、`draw-line`、`draw-arrow`、`draw-circle` 与 `draw-text` 工具，并通过既有
`onToolChange` 请求切换。`select` MUST 保持普通选择箭头、四角缩放和本体移动；`move` 激活时才显示
红 X/绿 Y 移动 gizmo；`scale` 与 `rotate` MUST 只暴露各自变换命中。

#### Scenario: 选择工具显示四角与边缘缩放

- **WHEN** 可 resize 的 Entity 在 select 工具中被选中
- **THEN** Overlay 只渲染四个角上的小方块
- **AND** 选择框边缘的 hover 提供对应方向 resize cursor，而不显示中点方块

#### Scenario: 精确移动工具显示轴 gizmo

- **WHEN** move 工具激活且存在可移动的选择
- **THEN** Overlay 在选择的左上显示向右的红 X 与向下的绿 Y gizmo
- **AND** 拖动任一轴只修改相应坐标轴，切换到其他工具后 gizmo 消失

#### Scenario: 旋转与缩放工具隔离命中

- **WHEN** 用户分别激活 scale 或 rotate 工具
- **THEN** 前者只能启动 resize，后者只能启动 rotate
- **AND** select 与 pan 的既有选择和视口行为不被拦截

### Requirement: 直接绘制 Preset

Stage MUST 为 container、rectangle、line、arrow、circle 与 text 提供受控绘制工具。绘制工具 MUST 在拖拽期间展示瞬时预览，正常松手时通过 Registry Preset 创建一个合法 Entity，取消时不得产生文档事务。container 工具在拖拽距离小于有效阈值时 MUST 回退到 Container Preset 的默认尺寸并以按下点为左上角，MUST NOT 创建退化尺寸的容器。

#### Scenario: 拖拽绘制容器与形状

- **WHEN** 用户在任一 container 或 shape 绘制工具中从 surface 拖出有效 bounds 并松手
- **THEN** Stage 创建一个具有相同规范化世界 bounds 的对应 Preset Entity
- **AND** 该 Entity 成为选区，写入一个可撤销事务后请求切换到 select 工具，避免后续点击继续绘制

#### Scenario: 点击绘制容器回退默认尺寸

- **WHEN** 用户使用 container 工具在 surface 上单击而没有产生有效拖拽距离
- **THEN** Stage 以按下点为左上角、按 Container Preset 的默认尺寸创建容器
- **AND** 不创建 1×1 或其他退化尺寸的容器

#### Scenario: 点击或拖拽绘制文字

- **WHEN** 用户使用 text 工具点击 surface
- **THEN** Stage 在点击点创建保留 Text Preset `hug × hug` 轴的文字，初始预览使用 Text 的默认回退尺寸
- **AND** Layout measurement 完成后选区贴合实际文字内容
- **WHEN** 用户使用 text 工具拖拽 surface
- **THEN** Stage 创建两轴为 `fixed` 且使用精确拖拽 bounds 的 text box
- **AND** Escape、pointercancel 或无效 geometry 不创建 Entity

### Requirement: 两点 Shape 的端点选区

当且仅当单选可编辑的 Shape Renderer Line 或 Arrow 时，Stage MUST 使用其真实首尾世界坐标绘制蓝色线段、
两个白底蓝边端点控制点及 `长度 × 0` 浮标。它 MUST 不渲染通用矩形 selection bounds、边缘 hit area 或四角
缩放点；普通 Entity 继续使用通用选区。

#### Scenario: 单选 Line 或 Arrow

- **WHEN** 用户在 select、scale、move 或 rotate 工具中单选 Line 或 Arrow
- **THEN** 选区始终沿真实线段显示，且没有矩形选框
- **AND** 仅 select/scale 工具中的首尾控制点可启动 resize，move/rotate 保留各自专属手势

#### Scenario: 拖拽端点并越过另一端

- **WHEN** 用户拖动首端或尾端，并把它越过另一端
- **THEN** 未拖动端保持固定，预览持续跟随指针和 snap
- **AND** 松手以一个可撤销 batch 更新空间几何与 Shape `direction`，marker 始终附着在对应语义端点

### Requirement: Group 动态选择反馈

Stage MUST 以可见后代动态并集绘制 Group 的选择边框、命中范围与吸附范围；Group MUST 不显示 Resize
或 Rotate 手柄。移动 Group MUST 移动其完整子树，移动孩子 MUST 不产生隐式 Group 文档更新。

#### Scenario: Group 子项改变范围

- **WHEN** 用户移动 Group 内子项越过初始边界
- **THEN** Group 选框随可见后代范围改变
- **AND** 历史中只出现子项移动事务

### Requirement: 组件实例内部下钻与命中

Stage MUST 支持穿透进组件实例内部的命中与选择。默认单击 MUST 选中实例整体；双击 MUST 逐层下钻，
并受既有八层上限约束。下钻 MUST 复用已归一化的 clickCount，MUST NOT 引入独立计时。内部选区 MUST
使用与 Scene Tree 一致的复合地址，并与 Scene Tree 的展开与选中状态双向同步。选中实例整体时，
Stage MUST 只呈现一层选中框语义（对应宿主外框/根尺寸），MUST NOT 因宿主壳与嵌套根各画一套
外观而出现双层可见色块；嵌套内容的 Appearance 渲染 MUST 与组件文档 Stage 路径一致。

#### Scenario: 默认选中实例整体

- **WHEN** 用户单击组件实例
- **THEN** 选区是实例 Entity 本身，内部实体不被单独选中

#### Scenario: 双击下钻选中内部实体

- **WHEN** 用户在 select 工具下双击实例
- **THEN** 命中穿透到内部实体，选区为对应复合地址且不启动移动手势
- **AND** Scene Tree 同步展开并高亮同一节点

#### Scenario: 退出下钻

- **WHEN** 用户退出下钻上下文
- **THEN** 选区恢复为实例整体，内部命中不再生效

#### Scenario: 下钻与文本原地编辑互斥

- **WHEN** 用户双击的目标是 component-instance 或可编辑文本
- **THEN** 只触发下钻或只触发原地编辑，两者不同时激活

#### Scenario: 实例整体无双层可见填色

- **WHEN** 用户单击选中 component-instance 且未下钻
- **THEN** Stage 上可见填色与圆角来自嵌套文档内容
- **AND** 不出现宿主与根各贡献一层不透明底导致的错色或直角盖层

### Requirement: Stage 只渲染 WidgetSwitcher 的活动子项

Stage 场景层 MUST 跳过 core 派生的隐藏集合中的 Entity，与既有 `Visibility` 判断合并处理。切换活动
索引 MUST NOT 改变 Layout Snapshot——非活动子项仍参与布局求解，尺寸保持稳定。

#### Scenario: 只显示活动子项

- **WHEN** Stage 渲染含两个子项、`activeIndex` 为 0 的 WidgetSwitcher
- **THEN** 只有第一个子项及其后代出现在场景中
- **AND** 第二个子项的布局 box 与切换前一致

### Requirement: 选中 WidgetSwitcher 后代时临时预览该分支

选中 switcher 的任一后代时，Stage MUST 临时把该后代所在的直接子项显示出来以便编辑。该预览 MUST 是
表示层派生：MUST NOT 写入文档、MUST NOT 派发命令、MUST NOT 进入 Undo 栈；取消选择后 MUST 立即回到
`activeIndex`。

预览覆盖 MUST 同时作用于场景渲染与 SceneIndex，使被预览的分支既可见也可命中、可选中、可拖拽。

#### Scenario: 选中非活动子项

- **WHEN** 用户在场景树中选中 `activeIndex` 之外的某个子项的后代
- **THEN** 该子项分支在画布上显示并可直接命中拖拽
- **AND** 未产生任何文档事务，Undo 栈深度不变

#### Scenario: 取消选择后回到活动索引

- **WHEN** 用户清空选择
- **THEN** 画布重新只显示 `activeIndex` 指向的子项

### Requirement: 画布可编辑路径覆盖层

`ComposeStage` MUST 支持可选的 `editablePath` 世界坐标几何，并在 Overlay 中渲染虚线轨迹、
体现速度快慢的等时采样点、切线连杆与手柄，以及关键帧顶点标记。路径层 MUST 渲染在选区
变换手柄之上——关键帧顶点常与对象角点重合，压在手柄之下将无法拖动；吸附参考线等瞬时
反馈仍保持最上层。切线手柄 MUST 只在 `smooth` 顶点或当前活动顶点上显示。手柄的命中区
MUST 独立于可见尺寸放大。省略 `editablePath` 时 Stage 外观与行为 MUST 完全不变。

#### Scenario: 显示轨迹与速度

- **WHEN** 宿主传入一条包含缓入缓出段的可编辑路径
- **THEN** 画布显示连接各顶点的虚线轨迹
- **AND** 等时采样点在段两端密集、中间稀疏

#### Scenario: 切线手柄的显示条件

- **WHEN** 路径包含 `corner` 与 `smooth` 两种顶点且没有活动顶点
- **THEN** 只有 `smooth` 顶点显示切线连杆与手柄
- **WHEN** 宿主把某个 `corner` 顶点标记为活动
- **THEN** 该顶点也显示切线手柄

#### Scenario: 未传入路径时不变

- **WHEN** 宿主不传 `editablePath`
- **THEN** Overlay 不渲染任何路径元素

### Requirement: 画布路径编辑手势上报

`ComposeStage` MUST 把路径顶点与切线手柄的拖动结果以带阶段的世界坐标回调上报给宿主，
并 MUST 提供顶点双击切换回调。Stage MUST NOT 因为路径编辑派发任何编辑命令，
路径几何的事实来源始终在宿主。

#### Scenario: 拖动顶点上报世界坐标

- **WHEN** 用户拖动一个路径顶点并松手
- **THEN** 宿主收到该顶点的开始、移动与结束回调，结束回调携带最终世界坐标
- **AND** Stage 自身没有修改文档

#### Scenario: 双击顶点上报切换

- **WHEN** 用户双击一个路径顶点
- **THEN** 宿主收到该顶点的切换回调

#### Scenario: Shift 修饰键随手势上报

- **WHEN** 用户按住 Shift 拖动切线手柄
- **THEN** 每次移动回调都带有 Shift 已按下的修饰键状态

### Requirement: Stage 滚动配置提示

Stage MUST 为配置了横向或纵向滚动的可见容器绘制对应方向的静态滚动条提示，且不得改变
Entity 编辑坐标、消费滚轮、维护滚动偏移或产生文档事务。

#### Scenario: 显示不可交互的纵向提示

- **WHEN** 可见容器的纵向溢出配置为 `scroll`
- **THEN** Stage 在容器右边显示 `aria-hidden`、不可命中的静态提示

### Requirement: 基础组件分类九宫格

`ComposeComponentPalette` MUST 将所有未隐藏的 Registry Preset 显示在本地化“基础 (N)”可折叠
分类下，并以紧凑的响应式等尺寸网格呈现。网格 MUST 在可用宽度不足时自动将 Tile 排到下一行。每个 Tile MUST 使用与 Preset 类型对应的一致矢量图标、保留
名称、点击新增和拖入 Stage 的既有行为；Palette 不得修改 Registry 顺序、Preset 定义或 ComposeDocument。

#### Scenario: 展示基础组件网格

- **WHEN** Palette 接收到五个可见 Preset
- **THEN** 显示一个名称为“基础 (5)”的可聚焦分类控制项
- **AND** 展开时按 Registry 顺序显示五个 Preset Tile，并根据面板可用宽度自动换行
- **AND** 每个 Tile 占用相同的网格尺寸，图标的视觉尺寸一致
- **AND** 隐藏的 Preset 不计入分类数量，也不显示 Tile

#### Scenario: 折叠基础组件分类

- **WHEN** 用户激活已展开的“基础 (N)”分类控制项
- **THEN** 分类控制项反映折叠状态，且其 Preset Tile 不再可见
- **WHEN** 用户再次激活该控制项
- **THEN** Tile 恢复显示，顺序和可访问名称保持不变

#### Scenario: 从网格新增 Preset

- **WHEN** 用户点击或拖动任一 Preset Tile 到 Stage
- **THEN** 系统沿用既有 `external.add` 或 `external.drop` 流程创建对应 Preset
- **AND** 不产生旧 Frame/Component Node，也不写入 Palette 的展开状态

#### Scenario: 拖动预览跟随指针

- **WHEN** 用户从 Preset Tile 开始拖动，且指针越过既有拖动阈值
- **THEN** Palette 显示不拦截指针的半透明 Preset 占位预览，并跟随最新 client pointer 位置
- **WHEN** 用户取消或结束拖动
- **THEN** 占位预览立即消失，且只有有效 drop 才会改变文档

### Requirement: 标尺指针游标线

Stage MUST 在顶部和左侧 ruler 上显示跟随指针世界位置的游标标记。该标记 MUST 是瞬时视图状态，
MUST NOT 写入 ComposeDocument、事务历史或触发文档变更。

#### Scenario: 指针移动时更新游标

- **WHEN** 指针在 surface 或 ruler 上移动
- **THEN** 两条 ruler 各显示一个对应当前指针世界坐标的游标标记

#### Scenario: 指针离开时隐藏游标

- **WHEN** 指针离开 Stage
- **THEN** 两条 ruler 的游标标记消失且不残留最后位置

### Requirement: Stage 节点层级操作

Stage MUST 为节点提供前移一层、后移一层、置于顶层和置于底层四个动作。画布右键菜单 MUST 使用
“层级”子菜单呈现动作、当前快捷键与动态可用状态；独立 Stage 与宿主接管路径 MUST 使用相同命令语义。

#### Scenario: 从画布菜单调整前景节点

- **WHEN** 用户右键选中节点并执行一个可用的层级菜单项
- **THEN** Stage 提交一次同级重排事务并保持当前选择
- **AND** 重叠区域的绘制与命中顺序立即使用新的文档顺序

#### Scenario: 使用 Figma 风格默认键位

- **WHEN** Stage 使用默认 shortcuts 且焦点不在可编辑输入中
- **THEN** `[` 与 `]` 分别后移和前移一层，Primary+`[` 与 Primary+`]` 分别置底和置顶
- **AND** 自定义键位、宿主动作接管与输入隔离继续生效

#### Scenario: 显示层级边界状态

- **WHEN** 当前可编辑选择无法继续执行某个层级方向
- **THEN** 对应菜单项被禁用并继续显示当前快捷键
- **AND** 执行动作不会产生空事务或改变选择

### Requirement: 画布拖拽落点反馈

Stage MUST 在存在候选 reparent 目标期间为该容器渲染高亮描边，区别于普通选中态。Stage MUST 在
Layout 容器内原地重排期间按 Controller 发布的插入位置渲染落点指示：`nowrap` 容器为主轴插入线，
`wrap`/`wrap-reverse` 容器为目标行内的主轴插入线。两种反馈 MUST 在候选目标清除或 Pointer Up
提交/取消后立即消失。

被拖动目标自身的选中框与变换手柄呈现 MUST 保持既有行为不变——落点反馈画在目标容器上，与被拖动节点
的手柄属于不同对象。

#### Scenario: 候选容器显示高亮描边

- **WHEN** 拖动中的指针使某容器成为候选 reparent 目标
- **THEN** 该容器显示高亮描边
- **AND** 被拖动 Entity 自身的选中框与手柄呈现保持既有行为

#### Scenario: 容器内重排显示落点指示

- **WHEN** 用户在 `nowrap` 容器内拖动 Flow 子级
- **THEN** Stage 按当前插入位置渲染落点指示
- **AND** 指示随指针移动实时更新且不产生文档事务

#### Scenario: wrap 容器按行渲染插入线

- **WHEN** 用户在 `wrap` 容器内把 Flow 子级拖到另一行的两个兄弟之间
- **THEN** Stage 在目标行内按插入位置渲染主轴插入线
- **AND** 指示线位置与松手后的真实插入结果一致

#### Scenario: 反馈随会话状态同步消失

- **WHEN** 指针移出候选容器区域，或 Pointer Up 完成提交或取消
- **THEN** 容器高亮与落点指示立即消失
- **AND** 不残留在已经不再是候选目标的容器上

### Requirement: Stage 复制剪切粘贴

Stage MUST 为当前画布选区提供复制、剪切和粘贴。复制 MUST 把规范化顶层 Entity 写入会话剪贴板且
不修改文档；剪切 MUST 只纳入未锁定来源，并在成功粘贴移动后清空剪贴板。粘贴 MUST 使用建议落点：
可容纳子项的未锁定容器追加子项，叶节点插到自身之后，空白画布落到根级。Stage MUST NOT 读写系统
剪贴板。未注入 `services.clipboard` 的独立 Stage 使用内建内存剪贴板；宿主提供 `onShortcutAction`
并返回 `true` 时 MUST 停止内建处理。可编辑输入或画布内文字编辑中 MUST NOT 拦截平台复制/剪切/粘贴。

#### Scenario: 从画布菜单复制并粘贴

- **WHEN** 用户右键可见节点并执行复制，再在空白画布执行粘贴
- **THEN** Stage 提交一次复制事务，新节点位于根级并被选中
- **AND** 再次粘贴仍可生成另一组副本

#### Scenario: 剪切后粘贴清空剪贴板

- **WHEN** 用户剪切有效选择并粘贴到建议落点
- **THEN** 来源被移动到新位置且剪贴板被清空
- **AND** 再次粘贴不产生事务

#### Scenario: 使用平台主修饰键

- **WHEN** Stage 聚焦且用户按下默认 Primary+C / Primary+X / Primary+V
- **THEN** Stage 分别执行复制、剪切和粘贴
- **AND** 右键菜单在 macOS 显示 ⌘C/⌘X/⌘V，其他平台显示 Ctrl+C/Ctrl+X/Ctrl+V
- **AND** 裸 `C` 仍切换容器绘制工具

#### Scenario: 可编辑目标保留系统剪贴板

- **WHEN** 焦点位于 input、textarea 或画布内文字编辑
- **THEN** Primary+C/X/V 不执行 Entity 复制、剪切或粘贴

#### Scenario: 宿主经 services 提供共享剪贴板

- **WHEN** 宿主通过 `services.clipboard` 注入共享快照并执行复制
- **THEN** 写入经 `services.onClipboardChange` 通知宿主
- **AND** 粘贴可用性与聚合前的平铺 `clipboard` 行为一致

### Requirement: 多 Frame 与嵌套边界

Stage MUST 渲染 rootIds 中的每一个 Frame，并为每个 Frame 渲染可检查的边界区域。Frame MUST 与
普通 Container 共用同一条呈现管线：背景、边框、圆角、透明度与阴影 MUST 全部来自该 Entity 自身
的 `Appearance`，Stage MUST NOT 为 Frame 额外绘制描边、选中轮廓或任何容器不会得到的装饰。
场景与容器在画布上的唯一视觉区别 MUST 是标题标签；「哪一块会被发布」MUST 由标签上的激活标记
承担，MUST NOT 依赖边界颜色差异。
Stage MUST 在当前目标 Frame 的局部原点显示固定屏幕尺寸、Godot 风格的前景十字标记：MUST 精确
使用 16×16 `EditorPosition` 双填充轮廓，外层为 `rgba(255,255,255,0.706)`，内层为 `#ff5f5f`；
不得以描边线条近似，也不得通过 halo 或轴线分段在原点周围制造缺口。X/Y 轴 MUST 分别使用
`rgba(245,51,82,0.75)` 与 `rgba(135,214,3,0.75)`。平移、缩放或 Frame 尺寸变化不得改变其锚点。
带 Hierarchy 的 Container Entity MUST 可以嵌套、旋转，并按 Clip 裁剪或显示溢出；嵌套 Frame MUST
建立独立局部原点；Frame 边界不得限制无限 Stage 中的编辑和滚动范围。

#### Scenario: 编辑输出边界外的根 Entity

- **WHEN** 某 Entity 被移动到其所属 Frame 的边界外
- **THEN** Stage 仍渲染、选择、移动和 resize 该 Entity
- **AND** Frame 区域只作为网格之上、Entity 之下的检查目标，不阻止边界外编辑

#### Scenario: 检查透明输出区域

- **WHEN** 用户点击某 Frame 中没有子级 Entity 覆盖的区域
- **THEN** Stage 选中该 Frame Entity 并在 Inspector 显示其属性
- **AND** 背景为 transparent 时网格透过 Frame 可见，且 Stage 不为该 Frame 补画任何边框
- **AND** 原点标记在连续 X/Y 轴之后按 Godot `EditorPosition` 的双填充路径和精确颜色绘制

#### Scenario: 渲染嵌套 Container 裁剪

- **WHEN** 嵌套 Container 切换 Clip.enabled，或场景中存在嵌套 Frame
- **THEN** Stage 对越界后代切换 hidden/visible overflow
- **AND** Container 与 Frame 的 Transform rotation 与后代世界几何保持一致

#### Scenario: 激活场景边界可辨认

- **WHEN** 页面有两个场景且都未被选中
- **THEN** 两块场景的边界本身没有任何视觉差异——场景与容器共用同一条呈现管线
- **AND** 激活场景由标题标签上的激活标记与播放按钮标出，因此不选中也看得见哪一块会被发布

### Requirement: Stage Frame 背景 Paint

ComposeStage MUST 在每个 Frame 的边界内渲染其 `Appearance.backgroundPaint` 的共享 Paint 描述。
Frame 背景 MUST 参与 Frame Entity 自身的选中与 Paint edit/sample session，MUST NOT 被其后代
Entity 的命中测试吞掉。

#### Scenario: 编辑渐变输出背景

- **WHEN** Frame Inspector 提交合法的 Gradient Paint
- **THEN** Stage 在下一文档快照显示对应 Frame 渐变
- **AND** 现有 Entity 选择、移动、命中测试和渐变控制柄目标保持不变

### Requirement: 可拖拽 Frame 局部辅助线

Stage MUST 允许从 ruler 创建、移动和删除辅助线，辅助线归属当前活动 Frame 并使用该 Frame 的局部
坐标。Pointermove MUST 只更新预览；pointerup MUST 最多派发一个命令或 batch，取消 MUST 不修改文档。

顶部（水平）ruler MUST 拖出水平 guide，左侧（垂直）ruler MUST 拖出垂直 guide；ruler 自身的
轴与 guide 的轴互为反向。手势停留在该 guide 所属 ruler 内时，Stage MUST 给出可识别的删除
光标提示，并在 pointerup 删除该 guide。活动 Frame 切换时 Stage MUST 只显示该 Frame 的辅助线。

#### Scenario: 从标尺创建辅助线

- **WHEN** 用户从顶部 ruler 拖入 surface
- **THEN** Stage 预览并创建一条由活动 Frame 局部 Y 定位的水平 guide
- **WHEN** 用户从左侧 ruler 拖入 surface
- **THEN** Stage 预览并创建一条由活动 Frame 局部 X 定位的垂直 guide
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

#### Scenario: 切换活动 Frame

- **WHEN** 用户在多画板文档中把活动 Frame 从 A 切换到 B
- **THEN** Stage 只显示 B 的辅助线，A 的辅助线保持不变且不被删除

### Requirement: 跨 Frame 拖拽与重设父级

Stage MUST 允许把 Entity 从一个 Frame 拖入另一个 Frame，并 MUST 在落点提交时把其
`LayoutItem.offset` 从源 Frame 局部坐标转换为目标 Frame 局部坐标，使屏幕位置保持不变。
若被拖动的 Entity 或其后代携带属于源 Frame 的动画轨道，Stage MUST 在同一个事务中调用动画包的
轨道重定位命令，把这些轨道及其所属动画搬迁到目标 Frame，MUST NOT 静默丢弃关键帧。搬迁产生的
动画清单变化 MUST 与结构变化在同一次撤销中一起回滚。

#### Scenario: 无动画 Entity 跨 Frame 拖入

- **WHEN** 用户把一个没有动画轨道的矩形从 Frame A 拖入 Frame B
- **THEN** 该 Entity 成为 B 的子级，屏幕位置在提交前后保持不变
- **AND** 操作作为一个可撤销事务进入 History 与 Operation Log

#### Scenario: 携带轨道的 Entity 跨 Frame 拖入

- **WHEN** 用户把一个携带动画轨道的 Entity 从 Frame A 拖入 Frame B
- **THEN** 该 Entity 成为 B 的子级，其轨道按重定位规则出现在 B 的动画清单下且关键帧值不变
- **AND** 结构变化与轨道搬迁在同一个事务中，一次撤销即完整还原 A 的清单与该 Entity 的归属

#### Scenario: 提示不可自动合并的搬迁

- **WHEN** 轨道重定位因目标 Frame 已存在同名冲突动画而无法自动合并
- **THEN** Stage 在提交前呈现选择目标动画或新建动画的提示
- **AND** 用户取消时文档与撤销历史不发生变化

### Requirement: 场景标签的激活与预览入口

根 Frame 的标题标签 MUST 承载场景语义，且 MUST NOT 改变普通容器标签的既有结构。
激活场景的标签 MUST 在名称**前**显示播放按钮，点击 MUST 请求宿主以该场景为目标打开预览；
每个场景标签 MUST 在名称**后**显示激活标记，激活态与未激活态 MUST 在形态上可区分而不只靠颜色，
点击未激活标记 MUST 请求宿主把该场景设为激活。每个场景标签 MUST 在激活标记**之后**显示该
场景的尺寸胶囊，内容取自 `Frame.size`。三个新控件 MUST 各自具备本地化 accessible name。

**锁定场景 MUST 保留全部三个控件**：播放、激活标记与尺寸显示都 MUST 照常呈现且播放与激活
MUST 保持可用——锁保护的是场景的内容与几何，而「它是谁、多大、是不是发布目标」正是用户
用来判断要不要解锁的信息。锁定 MUST 只收走改这块场景的入口：名称 MUST NOT 是选中或重命名
入口，尺寸胶囊 MUST 退成只读且双击 MUST NOT 打开尺寸弹框。锁定态名称 MUST 保留既有的
`is-locked` 呈现与既有 testid。

播放按钮、激活标记与尺寸胶囊 MUST 在 `pointerdown` 阶段阻止冒泡与默认动作，因此 MUST NOT
触发标签的选中手势，也 MUST NOT 参与就地重命名的双击判定。名称按钮 MUST 保留既有 testid 与
既有的单击选中、双击重命名行为；新控件 MUST 使用各自独立的 testid，MUST NOT 复用容器标签的
testid 前缀。

标签容器 MUST 保持不吞掉画布指针事件：容器自身不接收指针事件，各控件各自开启；名称仍 MUST
在超出可用宽度时省略号截断，尺寸胶囊 MUST NOT 参与收缩。标签层 MUST 保持在变换手柄层之下。

Stage MUST 在右键菜单中为根 Frame 提供「设为激活场景」，已是激活场景时 MUST 禁用。
Stage MUST 为激活场景的边界提供与选中态正交的视觉区分。

Stage MUST NOT 自行写入激活状态——它只发出请求，由宿主决定如何持久化。

#### Scenario: 激活场景标签显示播放与激活标记

- **WHEN** 页面有两个场景，其中第一个是激活场景
- **THEN** 第一个场景的标签在名称前显示播放按钮，名称后显示激活态标记
- **AND** 第二个场景的标签显示未激活态标记且没有播放按钮

#### Scenario: 场景标签显示尺寸

- **WHEN** 一块场景的 `Frame.size` 是 `{ width: 1920, height: 1080 }`
- **THEN** 该场景标签在激活标记之后显示 `1920 × 1080`
- **AND** 场景尺寸改变后该显示同步更新

#### Scenario: 点击标记请求切换激活

- **WHEN** 用户点击未激活场景标签上的标记
- **THEN** Stage 发出以该场景为目标的激活请求
- **AND** 该次点击不选中该场景，也不进入就地重命名

#### Scenario: 播放按钮请求预览

- **WHEN** 用户点击激活场景标签上的播放按钮
- **THEN** Stage 发出以该场景为目标的预览请求
- **AND** 该次点击不改变当前选择

#### Scenario: 名称按钮行为不变

- **WHEN** 用户单击场景标签的名称
- **THEN** 该场景被选中
- **WHEN** 用户在间隔内再次单击同一名称
- **THEN** 进入就地重命名输入态，且该输入态不显示播放按钮、激活标记与尺寸胶囊

#### Scenario: 右键设为激活场景

- **WHEN** 用户右键一个非激活的根 Frame
- **THEN** 菜单出现「设为激活场景」
- **AND** 对已激活的场景该项被禁用

#### Scenario: 锁定场景仍显示播放、激活与尺寸

- **WHEN** 激活场景被锁定
- **THEN** 标签仍显示播放按钮、激活标记与尺寸胶囊
- **AND** 点击播放仍发出预览请求，名称不再是选中或重命名入口
- **AND** 尺寸胶囊呈现为只读，双击不打开尺寸弹框

#### Scenario: 未提供回调时不出现控件

- **WHEN** 宿主没有提供激活或预览回调
- **THEN** 标签只渲染名称与尺寸胶囊，不出现对应控件
- **AND** 既有容器标签行为完全不变

### Requirement: 空白工作区的新建落点

在所有 Frame 之外新建 Entity 时，Stage MUST 按被创建 Entity 的类型分流，MUST NOT 回退到
`rootIds[0]`：

- 容器类 Entity（拥有 `Hierarchy` 且不是 Group）MUST 升格为一块新的根场景，几何取绘制或
  落点得到的世界坐标；新场景的 Clip MUST 归一为不裁剪（与「新建场景」命令的默认一致），
  其余外观与组件 MUST 原样保留。该归一只作用于本路径新建的容器，MUST NOT 影响对既有
  容器的显式升格。
- 其余 Entity MUST 落进**激活场景**，世界坐标 MUST 换算为该场景的局部坐标，并 MUST
  保留落点位置——即使局部坐标越出场景边界也 MUST NOT 钳制。场景默认不裁剪，越界对象
  因此仍然可见；用户为场景开启裁剪后越界部分被裁掉是其显式选择的结果。

该规则 MUST 覆盖全部新建路径：绘制工具提交、物料面板拖放与点击添加、资源浏览器拖放。
无选中时的粘贴落点 MUST 同样解析为激活场景。

#### Scenario: 在场景外绘制容器得到新场景

- **WHEN** 用户用容器工具在所有场景之外拖出一个矩形区域
- **THEN** 文档 `rootIds` 增加一项，新场景位于绘制处并与既有场景并排
- **AND** 新场景默认不裁剪，该操作是一次可撤销事务，且不改变页面的激活场景

#### Scenario: 在场景外绘制矩形落进激活场景并保留落点

- **WHEN** 用户用矩形工具在所有场景之外、距激活场景边界较远处拖出一个矩形
- **THEN** 该矩形成为激活场景的子级，局部坐标等于世界落点减去场景原点
- **AND** 其位置不被钳制进场景边界，画布上矩形仍显示在绘制处

#### Scenario: 切换激活场景后落点跟随

- **WHEN** 页面有两块场景，用户把第二块设为激活场景后在空白处绘制矩形
- **THEN** 该矩形成为第二块场景的子级，而不是 `rootIds` 中第一块场景的子级

### Requirement: Stage 注入面聚合

`ComposeStageProps` MUST 把宿主注入面收敛为 `services` 与 `policy` 两个聚合对象。
`services` MUST 承载宿主拥有的能力端口（`dispatch`、`registry`、`assetResolver`、
`pageLoader`、`scriptModuleLoader`、`clipboard`、`onClipboardChange`、`layoutRuntime`）。
Stage MUST 按字段消费 `services`，MUST NOT 以其对象引用作为场景子树或 measurement adapter
的缓存键。`policy` MUST 承载宿主拥有事实来源、Stage 只消费的开关（`marqueeMode`、
`lockGestureParent`、`gridVisible`），Stage MUST NOT 为其中任何一项持有事实来源或提供切换 UI。

受控协议（`viewport`、`tool`、`selectedIds`、`activeFrameId` 及其 `onChange`）、逐帧数据
（`document`、`layoutSnapshot`、`layoutPreviewSnapshot`、`layoutError`、`scriptScope`）与
快捷键（`shortcuts`、`onShortcutAction`）MUST 保持平铺。上述聚合项的同名平铺 prop
MUST 被删除，且 MUST NOT 提供兼容别名或运行时迁移层。

#### Scenario: 端口经 services 注入

- **WHEN** 宿主通过 `services` 注入 `assetResolver` 与 `pageLoader` 并渲染 Stage
- **THEN** 资源节点创建与页面实体渲染的行为与聚合前完全一致
- **AND** 省略某个可选端口时该端口对应能力呈现既有的缺省状态

#### Scenario: 模式语义经 policy 注入

- **WHEN** 宿主传入 `policy.lockGestureParent` 为 true 并在画布上拖动一个对象
- **THEN** 拖动不产生跨父级挂载，同容器重排照常
- **AND** 该行为与聚合前的平铺 `lockGestureParent` 逐项一致

#### Scenario: 端口按字段消费

- **WHEN** 宿主重新构造 `services` 对象但其中各端口的值未变
- **THEN** Stage MUST NOT 因此重建场景子树、重建 measurement adapter 或重置进行中的交互会话

#### Scenario: policy 变化不牵动端口

- **WHEN** 宿主因模式切换更新 `policy` 而 `services` 各端口未变
- **THEN** Stage MUST NOT 因此重建场景子树或重置进行中的交互会话

### Requirement: resize 手势实时布局反馈

Auto Layout 容器的子级或带子级的 Auto Layout 容器本身被 resize 期间，Stage MUST 按预览
Snapshot 渲染场景：拖子级时兄弟随拖动实时让位，拖容器时子级排布（fill 伸缩、wrap 换行）
随拖动实时更新，所见结果与 Pointer Up 提交后的布局一致。预览渲染 MUST 以 rAF 合并，单帧
最多触发一次预览求解。手势取消时 MUST 立即恢复提交态 Snapshot 的渲染，MUST NOT 残留预览
几何；预览期间 MUST NOT 产生文档事务或历史条目。

#### Scenario: resize 子级时兄弟实时让位

- **WHEN** 用户拖动 Auto Layout 容器内某子级的 resize 手柄
- **THEN** 兄弟节点随拖动按预览 Snapshot 实时重新排布
- **AND** Pointer Up 提交后的最终布局与松手前所见一致

#### Scenario: resize 容器时子级实时重排

- **WHEN** 用户拖动带子级的 Auto Layout 容器自身的 resize 手柄
- **THEN** 子级随拖动按预览 Snapshot 实时重新排布
- **AND** Pointer Up 提交后的最终布局与松手前所见一致

#### Scenario: 取消手势恢复提交态

- **WHEN** resize 手势进行中收到 Escape 或失去指针捕获
- **THEN** 场景立即恢复为提交态 Snapshot 的渲染
- **AND** 历史与文档无任何新增条目

### Requirement: 顶层容器标题标签

Stage MUST 为每个顶层容器（`rootIds` 的直接成员、含 Hierarchy 且不是 first-class Group）
在其左上角外侧渲染名称标签。
标签 MUST 使用恒定屏幕尺寸，不随视口缩放放大或缩小，并 MUST 跟随容器的屏幕位置。嵌套容器
MUST NOT 渲染标签。不可见、被宿主隐藏或视口缩放低于可读阈值的容器 MUST NOT 渲染标签。
标签宽度 MUST 不超过容器的屏幕宽度，超出部分 MUST 省略。

标签 MUST 是容器的选中入口：在标签上按下 MUST 与在容器体上按下产生相同的选中与移动语义，
并 MUST 不穿透到下方场景。锁定容器的标签 MUST 只承载名称信息，MUST NOT 接受选中、拖动
或重命名，并 MUST 与未锁定标签有可区分的视觉表现。容器处于选区中时标签 MUST 呈现选中态。变换手柄 MUST 绘制在标签
之上，标签不得遮挡 resize 与 rotate 命中区。

标签 MUST 支持就地重命名：双击进入编辑，Enter 或失焦提交，Escape 取消并恢复原名。Stage
MUST NOT 自行写入文档，重命名结果 MUST 通过受控回调交给宿主；宿主未提供该回调时标签
MUST 只读且不进入编辑态。标签文案与无障碍名称 MUST 走 Stage 内建本地化，不得硬编码。

#### Scenario: 顶层容器显示标签而嵌套容器不显示

- **WHEN** 文档中存在一个顶层容器，其内部还有一个嵌套容器
- **THEN** 只有顶层容器在左上角外侧显示名称标签
- **AND** 平移与缩放视口时标签字号保持不变且始终贴在该容器左上角外侧

#### Scenario: 通过标签选中并移动容器

- **WHEN** 用户在容器标签上按下并拖动
- **THEN** 该容器成为选区并进入 move 手势
- **AND** 标签呈现选中态，变换手柄仍可命中

#### Scenario: 就地重命名容器

- **WHEN** 宿主提供了重命名回调且用户双击标签、输入新名称并按 Enter
- **THEN** Stage 通过回调上报新名称，且不自行提交文档事务
- **WHEN** 用户改为按 Escape
- **THEN** 退出编辑并恢复原名称，不触发回调

#### Scenario: 锁定容器的标签只读且不可选中

- **WHEN** 容器处于锁定状态
- **THEN** 它的标签仍显示名称，但按下不改变选区，双击不进入重命名

#### Scenario: 未提供重命名回调时标签只读

- **WHEN** 宿主未提供重命名回调且用户双击标签
- **THEN** 标签不进入编辑态，仍然只承担选中职责

### Requirement: 手势父级锁定输入

`ComposeStage` MUST 提供可选的 `lockGestureParent` prop，并把它原样传入交互 Controller 的
`StageInteractionContext.lockGestureParent`。为 true 时画布 move 手势 MUST NOT 产生跨父级
reparent 落点高亮与结构命令，同容器重排照常；缺省时行为与现在完全一致。Stage 自身
MUST NOT 感知宿主启用锁定的理由（如编辑器的动画模式）——它只透传布尔输入。

#### Scenario: 锁定时拖拽不显示挂载高亮

- **WHEN** 宿主以 `lockGestureParent` 渲染 Stage，用户把对象拖过另一块容器内部
- **THEN** 画布不出现 reparent 落点高亮
- **AND** 松手后对象仍属原父级

#### Scenario: 缺省时行为不变

- **WHEN** 宿主未传 `lockGestureParent`
- **THEN** 跨父级拖拽的落点判定与提交与既有行为一致

### Requirement: Overlay 层注册表

Stage Overlay MUST 由一组可注册的层组成，每层是纯呈现——输入是上下文，输出是 SVG 片段，
MUST NOT 持有手势状态或写文档。宿主 MUST 能追加自己的层而不修改 Overlay 本体。

绘制顺序 MUST 由显式的 `order` 数值决定，MUST NOT 依赖代码书写次序。SVG 没有 z-index，
**绘制顺序即命中顺序**：后画的元素压在上面，也先接收指针，因此顺序决定重叠区域归谁。
`order` MUST 两两不同，使顺序完全确定；id 重复时注册 MUST 失败。

两处顺序是硬约束：可编辑路径的顶点 MUST 画在缩放手柄之上——关键帧顶点常与对象角点重合，
压在手柄之下将永远拖不动；吸附参考线 MUST 画在最上层——它是瞬时反馈，被盖住等于没画。

层之间 MUST NOT 共享预先算好的派生包，各层 MUST 自行从上下文换算所需的屏幕几何。

#### Scenario: 宿主追加层

- **WHEN** 宿主传入一个 order 落在两个第一方层之间的层
- **THEN** 它在绘制序列中恰好排在那两层之间

#### Scenario: id 重复被拒绝

- **WHEN** 追加的层与既有层 id 相同
- **THEN** 注册抛错

#### Scenario: 关键顺序不被打破

- **WHEN** 校验默认注册表
- **THEN** 可编辑路径排在缩放手柄之上，吸附参考线排在最上层

### Requirement: 适配层的纯逻辑与 React 分离

Stage 适配层中不依赖 React 的确定性逻辑 MUST 住在独立模块，MUST NOT 与组件实现混在同一个
文件里——预览文档烘焙、指针几何归一化、资源落点排布与快捷键匹配都属于这一类。

这些模块 MUST NOT 引入 Hook、ref 或组件闭包，使它们可以脱离渲染独立求值与测试。

#### Scenario: 预览烘焙可独立求值

- **WHEN** 给定文档、布局快照与一组预览变换
- **THEN** 烘焙结果完全由输入决定，不需要挂载任何组件

#### Scenario: 快捷键匹配可独立求值

- **WHEN** 给定一个键盘事件与键位表
- **THEN** 匹配结果完全由输入决定

### Requirement: 适配层的用户能力按 Hook 划分

Stage 适配层中构成一条完整用户能力的逻辑 MUST 住在独立的 Hook 模块，MUST NOT 作为渲染函数
里的闭包依赖作用域捕获取得依赖——键盘操作是其中一条。

Hook 的参数对象 MUST 是它的完整依赖清单。它 MUST NOT 接受把多项依赖打包在一起的可变聚合
引用（例如「最新值」ref），否则依赖只是换了个位置继续隐藏。

#### Scenario: 键盘能力的依赖可从签名读出

- **WHEN** 阅读键盘 Hook 的参数类型
- **THEN** 该能力触达的文档、视口、控制器与宿主回调全部列在其中

#### Scenario: 判定次序属于行为

- **WHEN** 键盘动作级联被搬进 Hook
- **THEN** 分支次序与提前返回保持不变，因为次序本身决定了哪些分支可达

### Requirement: 方向键微调的命令规划可独立求值

方向键微调把选中对象的世界位移换算成 `setTransform` 更新，这段换算 MUST 是不依赖 React 的
纯函数，MUST 独立于键盘事件处理被断言。

换算 MUST 按 Entity 自身 offset 反推父级内容盒原点，MUST NOT 另按父级边框宽度再内缩一次
——边框已经含在求解位置里，重复计算会让对象每次微调都额外偏移。`fill` 尺寸 MUST 沿用求解
结果而非 authored 值，否则一次微调就把「填满父级」固化成固定尺寸。

#### Scenario: 给定文档与方向得到确定的更新

- **WHEN** 给定文档、布局快照、一组 Entity、方向与步长
- **THEN** 产出的更新完全由输入决定，不需要挂载任何组件

#### Scenario: Flow 子级不参与微调

- **WHEN** 选中项里包含 `positioning` 为 `flow` 的子级
- **THEN** 它被排除在更新之外，因为其位置由 Auto Layout 决定，写入 offset 只会产生空事务

### Requirement: 视口适配与缩放只有一份实现

把目标矩形适配进 surface、以及按步长缩放，MUST 由共享的纯函数完成。键盘快捷键与画布右键
菜单 MUST 调用同一份实现，MUST NOT 各自内联缩放求解或复制缩放上下限、边距与步长常量。

#### Scenario: 适配结果完全由输入决定

- **WHEN** 给定目标矩形与 surface 尺寸
- **THEN** 产出的视口完全由输入决定，且目标居中、四周留出统一边距

#### Scenario: 空目标不改变视口

- **WHEN** 目标矩形缺失或宽高非正
- **THEN** 不产生新的视口，因为没有可适配的内容

### Requirement: 画布右键菜单是受控组件

画布右键菜单 MUST 是一个独立的受控组件，其 props MUST 表达完整契约——可用性、文案与动作
回调都由宿主传入。它 MUST NOT 从渲染函数的闭包里就近取用文档、事务或选区。

只服务于该菜单的可用性派生（层级顺序、编组与取消编组）MUST 与菜单同住，MUST NOT 留在宿主
组件里跨越数百行遥相呼应。

#### Scenario: 菜单项按可用性禁用并说明原因

- **WHEN** 某项操作对当前选区不可用
- **THEN** 对应菜单项禁用，并在有原因可说明时通过 title 给出原因

### Requirement: Stage chrome 文案一律经由 i18n

Stage 自身渲染的所有用户可见文案 MUST 取自 `stage-i18n`，MUST NOT 在组件里硬编码任何
语言的字面量——右键菜单的编组、删除、视图、工具与吸附项都属于这一类。

#### Scenario: 切换语言后菜单文案随之改变

- **WHEN** 宿主提供的 locale 为 `en-US`
- **THEN** 右键菜单的每一项都显示英文，而不是回退成中文字面量

### Requirement: 原地文字编辑是一条独立能力

画布内原地文字编辑 MUST 住在独立的 Hook 模块，包含会话状态、可编辑性判定、测量覆盖更新与
退出时的事务收敛。宿主 MUST NOT 把这条能力的状态与回调散落在渲染函数各处。

编辑期间 MUST NOT 产生任何文档事务；提交只发生在退出时，且三种情况互斥——有变化写 Prop、
内容为空删除实体、无变化不发命令。

#### Scenario: 逐字符输入不进历史

- **WHEN** 用户在编辑态连续输入
- **THEN** 不产生任何事务，撤销栈不被单个单词撑满

#### Scenario: 空内容退出删除实体

- **WHEN** 点击创建的文字未输入任何内容即退出
- **THEN** 该实体被删除，不在场景里留下看不见也选不中的空文字

### Requirement: 适配层 Hook 的回调必须引用稳定

进入宿主效果处理表或交互上下文的 Hook 回调 MUST 保持引用稳定。宿主传入的函数型依赖
MUST 经由 Hook 内部的最新值引用读取，MUST NOT 进入 `useCallback` 依赖数组。

这不是性能优化：处理表随引用变化重建，会被进行中的空间手势判定为上下文已变而中止。

#### Scenario: 宿主每帧新建回调不影响进行中的手势

- **WHEN** 宿主以内联箭头函数的形式传入回调，并在手势进行中重新渲染
- **THEN** 线段端点、框选与路径顶点手势照常推进并正常提交，而不是被中止

### Requirement: 指针会话生命周期是一条独立能力

从 `pointerdown` 归一化到会话结束的全部状态与判定 MUST 住在独立的 Hook 模块，包含连击计数、
Pointer capture 的接管与归还、window 路由、逐帧推进与取消清理。

会话 MUST 以单调递增的 generation 判等，MUST NOT 只凭 `pointerId` 判断消息归属——同一个
`pointerId` 可以先后属于两次会话，迟到的 rAF 回调、window 事件与 capture 丢失通知都可能跨越
会话边界抵达。

#### Scenario: 过期消息不误伤新会话

- **WHEN** 上一次会话的 rAF 回调在新会话开始后才执行
- **THEN** 该回调被丢弃，新会话的状态不受影响

#### Scenario: 主动释放与被动丢失可区分

- **WHEN** 会话主动归还 Pointer capture，浏览器随之派发 lostpointercapture
- **THEN** 该通知被识别为自身释放的回声而消费掉，不被当作手势中断

### Requirement: 手势路由装在 window 的捕获阶段

指针移动、抬起与取消的监听 MUST 装在 window 的捕获阶段，MUST NOT 只依赖 React 事件树。

宿主在自己的根节点上调用 `stopPropagation` 是合法的，但 React 树内的监听会因此漏掉手势的
最终点，而漏掉 `pointerup` 意味着手势永远结束不了。

#### Scenario: 宿主阻止冒泡不影响手势结束

- **WHEN** 宿主在根节点的指针处理里阻止事件继续传播
- **THEN** 手势仍能收到最终点并正常提交

### Requirement: 内核效果只有一个落地点

内核产出的交互效果 MUST 在唯一一处落成宿主动作，该处 MUST 住在独立的 Hook 模块。指针
capture、选区、视口、路径、命令派发、文字编辑进出与外部拖入 MUST NOT 各自散落在渲染函数里。

需要规划文档命令的分支——两点图形端点提交、绘制提交、外部拖入——MUST 与分派同住，因为它们
除了这里没有别的调用方。

#### Scenario: 拖入资源的迟到结果不写进新文档

- **WHEN** 资源解析在解析器已被替换或组件已卸载之后才返回
- **THEN** 该结果被丢弃，不产生任何命令

### Requirement: 每帧新建的值不得进入回调依赖数组

Hook 内需要保持引用稳定的回调，其依赖数组 MUST NOT 包含每次渲染都新建的值——内联箭头函数、
派生对象与派生数组都属于这一类。这些值 MUST 经由 Hook 内部的最新值引用读取。

判据是「它每帧是不是新的」，不是「它是不是函数」。

#### Scenario: 派生文案对象不打断进行中的手势

- **WHEN** 国际化文案对象随渲染重新生成，且此时有手势正在进行
- **THEN** 效果分派的注册不因此重建，手势照常推进并正常提交

### Requirement: 滚轮导航使用非 passive 原生监听

画布的滚轮平移与缩放 MUST 在根元素上安装非 passive 的原生监听，MUST NOT 依赖 React 的
合成 wheel 事件——后者以 passive 方式委托，其 `preventDefault` 无法阻止页面滚动。

#### Scenario: 画布缩放不连带滚动页面

- **WHEN** 用户在画布上按住修饰键滚动滚轮
- **THEN** 画布缩放，承载页面不滚动

### Requirement: 选区与屏幕几何的派生可独立求值

选区约束、缩放手柄集合、可旋转与可编辑判定，以及世界到屏幕的换算 MUST 是不依赖 React 的
纯函数，MUST 能脱离渲染独立断言。

缩放手柄 MUST 区分「可拖动」与「需画出」两个集合——`free` 与 `preserve-aspect` 只画四角，
边方向靠透明命中区响应；`horizontal` 与 `vertical` 没有角可用，必须画出对应边控点。

#### Scenario: 多选时约束取交集

- **WHEN** 选区内一项只允许水平缩放、另一项只允许垂直缩放
- **THEN** 没有任何手柄可用

#### Scenario: 组件实例始终可四角缩放

- **WHEN** 选中一个已落盘为 `resize: 'none'` 的组件实例
- **THEN** 选区层按 `free` 处理并给出四角手柄，文档不被修改

### Requirement: 适配层不承担可独立求值的派生

Stage 适配层 MUST NOT 内联可由输入完全决定的派生逻辑。这类逻辑 MUST 住在纯函数模块，
适配层只负责调用与接线。

#### Scenario: 辅助线预览与已保存线的合并可独立断言

- **WHEN** 给定已保存的辅助线与拖动中的预览
- **THEN** 同 id 的被预览覆盖、预览中的新线追加在后，结果完全由输入决定

### Requirement: 隐藏集合的引用必须随内容稳定

Switcher 隐藏集合的返回值 MUST 在内容不变时保持同一引用。场景子树与场景索引缓存都以它作键，
引用漂移会重建整棵场景，正在 DOM 上测量的实例内部选中框随之丢失。

求值 MUST NOT 直接以宿主传入的选区数组作依赖——宿主每次渲染都可能传入新数组，那会让每个
平移帧都重新遍历一次文档。

#### Scenario: 文档编辑后隐藏内容未变

- **WHEN** 文档发生与 Switcher 无关的编辑
- **THEN** 隐藏集合返回同一个引用，场景不重建

### Requirement: Surface 尺寸观测忽略零尺寸与同值

Surface 尺寸观测 MUST 丢弃宽或高为非正数的测量结果，MUST 在尺寸未变时保持原有 state 引用。

零尺寸出现在挂载于隐藏容器时，写入会让后续所有以尺寸为除数的换算失效；同值触发来自祖先
重排，不短路就是每次重排都重渲染整棵场景。

#### Scenario: 隐藏容器中挂载不破坏换算

- **WHEN** Stage 挂载在一个当前不可见、测得 0×0 的容器里
- **THEN** 尺寸保持首帧回退值，视口换算与标尺刻度仍可求值

### Requirement: 屏幕模型是可独立求值的视图模型

这一帧要绘制的屏幕坐标——标尺刻度、场景边界、手柄锚点、辅助线与滚动轴——MUST 由一个不依赖
React 的纯函数产出，MUST 能脱离渲染独立断言。

内核尚未发布滚动范围时的内容边界回退 MUST 惰性求值：它要遍历全部 Entity，而只有首帧会用到。

#### Scenario: 滚动范围已发布时不遍历场景

- **WHEN** 内核已发布滚动范围
- **THEN** 不计算内容边界回退，不产生全场景遍历

### Requirement: 适配层按用户能力分目录

`stage-surface` 的功能目录 MUST 按用户能力划分，MUST NOT 按技术类型（`hooks/`、`utils/`、
`types/`）横向堆放。同一条能力的 Hook、纯逻辑与测试 MUST 住在同一个目录。

目录 MUST 满足准入标准才建立：三个及以上协同实现文件，或拥有自己的状态机与测试。不满足的
MUST 留在根目录，MUST NOT 为凑结构创建空壳目录。

被两个及以上能力共用的模块 MUST 留在根目录，MUST NOT 塞进其中任一能力目录。

#### Scenario: 单文件能力不升格为目录

- **WHEN** 某条能力只有一个实现文件
- **THEN** 它留在功能目录之外，不为它单独建目录

### Requirement: 功能目录经由自身入口对外

每个功能目录 MUST 有自己的 `index.ts` 控制导出。目录之间以及宿主对目录的引用 MUST 走该入口，
MUST NOT 深层引用目录内的实现文件。

#### Scenario: 跨目录引用不穿透实现

- **WHEN** 一个功能目录需要另一个目录的导出
- **THEN** 它从对方的目录入口导入，而不是从实现文件

### Requirement: 共享类型跟随消费者归属

跨功能共享的类型 MUST 归属于读取它的一侧，MUST NOT 因为「谁产生它」而留在产生方——后者会让
消费方目录反向依赖产生方，形成目录级循环。

#### Scenario: 端点朝向类型与线段几何同住

- **WHEN** 绘制产生两点图形的端点朝向，而预览烘焙与端点求解读取它
- **THEN** 该类型住在预览侧，创建目录单向依赖预览目录

### Requirement: 场景尺寸弹框

双击场景标签的尺寸胶囊 MUST 打开场景尺寸弹框。弹框 MUST 同时提供常见分辨率预设与自定义
宽高输入，预设列表 MUST 取自 `@compose-ui/core` 的公开常量，MUST NOT 由 Stage 复制一份。
当前尺寸匹配某个预设时该预设 MUST 呈现为选中态。

选择预设 MUST 把待提交的宽高写入自定义输入，使两种输入方式共用同一份草稿——用户 MUST 能
先选预设再微调数值。宽或高不是正有限数时提交入口 MUST 禁用。

场景被锁定时 MUST NOT 打开弹框：改尺寸是对该场景的写入，用户 MUST 先显式解锁。

确认 MUST 通过 `entity.frame.size.set` 提交**一次**可撤销事务并关闭弹框；草稿与当前尺寸相同时
MUST NOT 派发命令。取消、Esc 与点击遮罩 MUST 关闭弹框且 MUST NOT 写入文档。弹框每次打开
MUST 以该场景的当前尺寸重新初始化草稿，MUST NOT 残留上一次未确认的输入。

尺寸弹框 MUST NOT 成为尺寸的第二份事实来源：它与 Inspector 几何分组派发同一条命令，撤销
一步即回到原尺寸。

#### Scenario: 选择预设并确认

- **WHEN** 用户双击一块 1280×720 场景的尺寸胶囊，选择 1920×1080 并确认
- **THEN** 文档派发一条 `entity.frame.size.set`，该 Frame 尺寸变为 1920×1080
- **AND** 弹框关闭，撤销一步即回到 1280×720

#### Scenario: 自定义尺寸

- **WHEN** 用户在弹框中输入宽 1000、高 800 并确认
- **THEN** 该 Frame 尺寸变为 1000×800，且弹框中没有预设处于选中态

#### Scenario: 非法输入禁用确认

- **WHEN** 用户把宽度清空或输入 0
- **THEN** 确认入口禁用，Stage 不派发任何命令

#### Scenario: 取消不写入文档

- **WHEN** 用户改了数值后按 Esc 或点击取消
- **THEN** 弹框关闭且文档未变化
- **AND** 再次打开弹框时输入框显示的是该场景的当前尺寸

### Requirement: 场景视口适配

Stage MUST 在两个时机把视口适配到一块场景，使该场景在可视区域内整体可见并居中：

- **首次布局就绪**：Stage 完成第一次有效 surface 测量后 MUST 对**激活场景**适配一次。
  激活场景缺省或失效时 MUST 回退到第一块根 Frame。该适配每次挂载 MUST 只发生一次，
  MUST NOT 因文档编辑、选择变化或 surface 尺寸变化重复触发。宿主 MUST 能通过
  `autoFitActiveFrame` 关闭该行为，关闭时 Stage MUST 完全使用受控视口。
- **场景尺寸提交成功后**：MUST 立即对该场景适配一次。适配 MUST 使用刚提交的新尺寸，
  MUST NOT 等待下一帧的布局快照——否则用户会看到一次按旧尺寸算出的错误取景。

适配结果 MUST 通过既有的受控视口回调发出，Stage MUST NOT 自行持有视口。适配缩放 MUST
钳制在 Stage 既有的缩放上下限内，并保留可视区域四周的留白。目标矩形宽或高不是正数时
MUST NOT 发出任何视口变化。

#### Scenario: 首次进入适配激活场景

- **WHEN** 编辑器首次打开一个含 1920×1080 激活场景的页面
- **THEN** Stage 在首次测量到 surface 后发出一次视口变化，该场景整体可见并居中
- **AND** 随后的编辑、选择与文档变化不再触发自动适配

#### Scenario: 关闭自动适配

- **WHEN** 宿主传入 `autoFitActiveFrame` 为 false
- **THEN** Stage 首次布局就绪时不发出任何视口变化，视口完全由宿主控制

#### Scenario: 改尺寸后按新尺寸适配

- **WHEN** 用户把激活场景从 1280×720 改成 3840×2160
- **THEN** Stage 在同一次交互中把视口适配到 3840×2160 的场景矩形
- **AND** 缩放按新尺寸算出，而不是按旧尺寸

#### Scenario: 无效目标不改变视口

- **WHEN** 待适配的场景在文档中不存在，或其求解宽高为 0
- **THEN** Stage 不发出视口变化

### Requirement: 编辑期 Interaction 不改变命中与行为

Stage MUST NOT 因 Entity 携带 `Interaction` 而改变命中测试、选择、拖拽或任何编辑手势。
在画布上点击一个带跳转的 Entity MUST 只是选中它,MUST NOT 触发跳转。Stage MUST NOT 为
`Interaction` 引入新的编辑模式。

Stage MAY 以不可交互的视觉标记提示该 Entity 带有交互,但该标记 MUST NOT 参与命中测试,
也 MUST NOT 改变 Entity 的几何或布局呈现。

#### Scenario: 画布点击只选中

- **WHEN** 用户在画布上点击一个带 click→navigate 的 Entity
- **THEN** 该 Entity 被选中且当前页面不变
- **AND** 没有任何页面加载被发起

#### Scenario: 标记不参与命中

- **WHEN** Stage 呈现交互标记且用户点击标记所在位置
- **THEN** 命中的仍然是 Entity 本身
- **AND** Entity 的几何与布局呈现不受标记影响

