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

Stage MUST 只允许当前工具暴露的 move、resize 或 rotate 手势；每种变换 MUST 在拖动或方向键移动 Flow 时把它
转换为 Absolute 后移动，不得在 Stage 重排 Flow。Resize Fill axis MUST 转为 Fixed；Rotation MUST 保持 Flow
与 sizing。全部操作 MUST 使用开始 Snapshot 并维持现有 preview/cancel/一次提交保证。

#### Scenario: 拖动 Flow 转为 Absolute

- **WHEN** 用户在允许移动的 Stage 工具中拖动一个或多个 Flow Entity 并正常松手
- **THEN** preview 保持开始世界几何并跟随指针，提交后目标为 Absolute final offset
- **AND** Hierarchy.childIds 顺序不因 Stage 拖动改变

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
The Stage package MUST export `ComposeStage`, compose-prefixed supporting types and `ComposeComponentPalette` from
its root while keeping coordinate, snapping and command planning in stage-engine.

#### Scenario: Stage structure refactor
- **WHEN** the Stage implementation is reorganized
- **THEN** its user-visible grid, rulers, overlays, pointer behaviour, ARIA and stable test IDs remain unchanged

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

### Requirement: 多 Container 与输出边界

Stage MUST 渲染位于世界 `(0,0)` 的可检查文档输出边界，并渲染 rootIds 中任意 Entity。
输出背景 MUST 使用 document.output，默认透明并显示 1 屏幕像素非缩放边框；
未选中边框 MUST 使用统一的主题中性色且不得复用 X/Y 轴颜色，选中输出检查目标时四边 MUST
统一使用编辑器强调色。Stage MUST 在世界 `(0,0)` 显示固定屏幕尺寸、Godot 风格的前景十字
标记：MUST 精确使用 16×16 `EditorPosition` 双填充轮廓，外层为
`rgba(255,255,255,0.706)`，内层为 `#ff5f5f`；不得以描边线条近似，也不得通过 halo 或轴线
分段在原点周围制造缺口。X/Y 轴 MUST 分别使用 `rgba(245,51,82,0.75)` 与
`rgba(135,214,3,0.75)`。平移、缩放或 output 尺寸变化不得改变其世界锚点。
激活输出检查时不得显示 Entity 变换手柄。带 Hierarchy 的 Container Entity MUST 可以嵌套、
旋转，并按 Clip 裁剪或显示溢出；输出边界不得限制无限 Stage 中的编辑和滚动范围。

#### Scenario: 编辑输出边界外的根 Entity

- **WHEN** 根 Entity 位于文档输出边界外
- **THEN** Stage 仍渲染、选择、移动和 resize 该 Entity
- **AND** 输出区域只作为网格之上、Entity 之下的检查目标，不阻止边界外编辑

#### Scenario: 检查透明输出区域

- **WHEN** 用户点击没有 Entity 覆盖的输出区域
- **THEN** Stage 发送 output inspection 回调并清空 Entity 选择
- **AND** 网格透过 transparent 背景可见，边框在任意 zoom 下保持 1 屏幕像素
- **AND** 未选中时四边使用同一主题中性色且不与 X/Y 轴混淆，选中时四边统一使用强调色
- **AND** 原点标记在连续 X/Y 轴之后按 Godot `EditorPosition` 的双填充路径和精确颜色绘制

#### Scenario: 渲染嵌套 Container 裁剪

- **WHEN** 嵌套 Container Entity 切换 Clip.enabled
- **THEN** Stage 对越界后代切换 hidden/visible overflow
- **AND** Container 的 Transform rotation 与后代世界几何保持一致

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

Stage 上下文菜单 MUST 根据 Hierarchy、Lock 与 TransformConstraints 计算 duplicate、group、
ungroup、delete 和视图操作状态，不得读取旧 kind。

#### Scenario: 取消容器分组

- **WHEN** 单选含子项的可编辑 Hierarchy Entity
- **THEN** 菜单启用取消编组并保留现有快捷键提示

### Requirement: Stage 右键操作菜单

Stage MUST 在节点和空白画布使用共享右键菜单呈现编辑、视图、工具和吸附操作。

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

### Requirement: Stage 输出背景 Paint

ComposeStage MUST 在固定输出边界渲染 `output.backgroundPaint` 的共享 Paint 描述，并让输出背景保持
不可交互、不可选中和不参与 Entity Paint edit/sample session。

#### Scenario: 编辑渐变输出背景

- **WHEN** Canvas Inspector 提交合法的输出 Gradient Paint
- **THEN** Stage 在下一文档快照显示对应输出渐变
- **AND** 现有 Entity 选择、移动、命中测试和渐变控制柄目标保持不变

### Requirement: Stage 页面文档加载注入

Stage MUST 接受可选的页面文档加载端口并将其注入 Registry 渲染上下文，使引用了页面的实体能在编辑
画布上实时渲染其内容。Stage MUST NOT 自行实现页面加载或嵌套渲染逻辑，也 MUST NOT 因此依赖
`preview`、`editor` 或页面 Store 实现包。未注入端口时画布 MUST 正常渲染且相关实体呈现占位状态。

#### Scenario: 注入后实时渲染

- **WHEN** 宿主向 Stage 注入页面文档加载端口，画布上存在引用页面的实体
- **THEN** 该实体在编辑画布上渲染被引用页面的内容
- **AND** 渲染结果与预览一致

#### Scenario: 未注入端口

- **WHEN** 宿主未注入页面文档加载端口
- **THEN** 画布正常渲染
- **AND** 引用页面的实体呈现可访问的占位状态

#### Scenario: 嵌套内容不干扰选择

- **WHEN** 用户在渲染了嵌套页面内容的实体区域内点击或框选
- **THEN** 命中与选择结果为该实体本身
- **AND** 嵌套内容不产生额外的可选目标

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

Stage MUST 为 container、rectangle、line、arrow、circle 与 text 提供受控绘制工具。绘制工具 MUST 在
拖拽期间展示瞬时预览，正常松手时通过 Registry Preset 创建一个合法 Entity，取消时不得产生文档事务。

#### Scenario: 拖拽绘制容器与形状

- **WHEN** 用户在任一 container 或 shape 绘制工具中从 surface 拖出有效 bounds 并松手
- **THEN** Stage 创建一个具有相同规范化世界 bounds 的对应 Preset Entity
- **AND** 该 Entity 成为选区，写入一个可撤销事务后请求切换到 select 工具，避免后续点击继续绘制

#### Scenario: 点击或拖拽绘制文字

- **WHEN** 用户使用 text 工具点击或拖拽 surface
- **THEN** click 使用 Text Preset 默认尺寸插入，drag 使用拖拽 bounds 创建 text box
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
使用与 Scene Tree 一致的复合地址，并与 Scene Tree 的展开与选中状态双向同步。

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

