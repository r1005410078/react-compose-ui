## ADDED Requirements

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
状态。Viewport MUST 使用屏幕像素 x/y 与 0.1～8 范围 zoom；这些状态及 CSS 网格 MUST NOT 写入
ComposeDocument、History 或 Operation Log。

#### Scenario: 平移无限视口

- **WHEN** 用户使用 pan 工具、按住 Space 拖动或使用中键拖动
- **THEN** Stage 只请求更新 viewport x/y
- **AND** 文档、选择和事务历史保持不变

#### Scenario: 以游标为锚缩放

- **WHEN** 用户在 viewport 内使用 Cmd/Ctrl 加滚轮缩放
- **THEN** zoom 被限制在 0.1～8
- **AND** 缩放前位于游标下方的世界坐标在缩放后仍位于同一屏幕位置

#### Scenario: 更新受控状态

- **WHEN** 宿主在回调后传入新的 viewport、tool、selection 或 activeFrameId
- **THEN** DOM Scene、SVG Overlay 和工具可用状态使用最新受控值
- **AND** Stage 不保留与宿主冲突的第二份正式状态

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
计算结果，再转换为各自父节点局部 transform；一次完成的手势 MUST 只派发一个 transform 命令或
batch。

#### Scenario: 移动单选或多选

- **WHEN** 用户拖动一个未锁定选择或共同包围框
- **THEN** 所有目标在 Pointer 预览中保持相对位置
- **AND** pointerup 只提交一次包含最终局部 transform 的事务

#### Scenario: 八向缩放

- **WHEN** 用户拖动任一 resize handle
- **THEN** 共同包围框从对应边或角变化，且尺寸不会跨过最小正尺寸
- **AND** Shift 保持初始宽高比，Alt 从中心对称缩放

#### Scenario: 旋转选择

- **WHEN** 用户拖动 rotation handle
- **THEN** 选择围绕共同中心旋转
- **AND** Shift 把角度量化到 15°，pointerup 提交一次最终事务

### Requirement: 屏幕距离吸附

移动和 resize MUST 吸附到当前 Frame 与可见未选中兄弟节点的边缘和中心。吸附阈值 MUST 固定为
6 屏幕像素并按当前 zoom 换算；Cmd/Ctrl MUST 临时关闭吸附，命中时 MUST 在 SVG Overlay 显示
瞬时参考线。

#### Scenario: 不同 zoom 下保持吸附手感

- **WHEN** 用户在不同 zoom 下把选择拖到候选线 6 屏幕像素范围内
- **THEN** Stage 使用换算后的世界距离得到相同屏幕阈值
- **AND** 参考线与最终吸附位置在屏幕上对齐

#### Scenario: 临时关闭吸附

- **WHEN** 用户在变换期间按住 Cmd/Ctrl
- **THEN** 几何跟随原始指针位置且不显示 snap guide
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
