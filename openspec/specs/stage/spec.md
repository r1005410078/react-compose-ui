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

Stage MUST 在无限世界中显示文档全部 Frame。Frame MUST 使用自身 x/y/width/height 形成明确边界，
普通节点 MUST 在所属 Frame 子树中渲染；Frame 外 drop 不得创建普通节点。

#### Scenario: 显示多个 Frame

- **WHEN** 文档包含位于不同正负世界坐标的多个 Frame
- **THEN** Stage 在对应世界位置显示每个 Frame 及其后代
- **AND** 用户可以平移或适配视口访问任意 Frame

#### Scenario: 隐藏和锁定节点

- **WHEN** 节点 visible 为 false 或 locked 为 true
- **THEN** hidden 节点不渲染且不参与吸附
- **AND** locked 节点可以保持场景树选择，但 Stage 不允许直接变换或删除

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

Stage MUST 使用原生 Pointer Events、pointer capture 与 `requestAnimationFrame` 合并瞬时更新。
pointermove MUST NOT dispatch；pointerup MUST 最多 dispatch 一次。Escape、pointercancel 或
lostpointercapture MUST 恢复手势开始前画面且不创建事务。

#### Scenario: 高频 Pointer 移动

- **WHEN** 一次手势产生多次 pointermove
- **THEN** Stage 以 animation frame 合并可视预览
- **AND** History 与 Operation Log 在 pointerup 前没有新条目

#### Scenario: 取消进行中的手势

- **WHEN** 用户按 Escape、浏览器发出 pointercancel 或 Stage 丢失 pointer capture
- **THEN** DOM Scene 与 SVG Overlay 恢复手势前几何并清理临时 UI
- **AND** runtime 未收到 transform 命令

### Requirement: 分组与重设父节点

Stage MUST 只允许同一直接父节点下的未锁定非 Frame 节点 group。Ungroup 与合法 reparent MUST
保持节点的世界位置、尺寸和旋转；Group resize MUST 通过一个 batch 比例更新后代局部几何。

#### Scenario: 分组同级节点

- **WHEN** 用户选择同一父节点下多个合法节点并执行 group
- **THEN** 新 Group 使用选择的世界包围框
- **AND** 后代转换为 Group 局部 transform 后保持原世界几何

#### Scenario: 拒绝跨父节点分组

- **WHEN** 选择来自不同直接父节点、包含 Frame 或 locked 节点
- **THEN** group 返回 rejected 且文档不变
- **AND** CommandPanel 可以显示稳定拒绝原因

#### Scenario: 取消分组或重设父节点

- **WHEN** 用户 ungroup 或把节点移动到另一个合法 Group/Frame
- **THEN** 新局部 transform 产生与操作前相同的世界几何
- **AND** 结构与坐标修改属于同一事务

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

系统 MUST 提供使用同一 registry 的 `ComponentPalette` 和实例级 `StageDragController`。Palette
拖入 MUST 使用 Pointer Events；有效 Frame drop MUST 创建并选择一个 Component，Frame 外 drop
MUST 发布 rejection 且不修改文档。

#### Scenario: 拖入有效 Frame

- **WHEN** 用户从 Palette 拖动 definition 并在未锁定 Frame 内松开
- **THEN** definition factory 生成独立 JSON props，并在 drop 世界位置派发一次 component.create
- **AND** 成功后 selection 更新为新节点 ID

#### Scenario: 拖到 Frame 外

- **WHEN** 用户在所有 Frame 之外或 locked Frame 中结束 palette drag
- **THEN** 不创建 Component 或事务历史
- **AND** CommandPanel 收到包含稳定原因的 rejected 事件

#### Scenario: 隔离多个 Stage 实例

- **WHEN** 页面同时挂载两个 drag controller、Palette 和 Stage 组合
- **THEN** 一个 Palette 会话只影响绑定到同一 controller 的 Stage
- **AND** 结束或卸载后 window 监听与拖拽状态被释放

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
并在 surface 显示细网格、主网格、红色 X 轴与绿色 Y 轴。视觉抽稀 MUST NOT 改变实际 snap step。

#### Scenario: 平移缩放标尺网格

- **WHEN** viewport 平移、缩放或 grid step/offset/primaryLineEvery 改变
- **THEN** ruler label、tick、细线与主线在相同世界位置对齐
- **AND** 过密线按 zoom 抽稀但节点仍吸附到原始配置刻度

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
