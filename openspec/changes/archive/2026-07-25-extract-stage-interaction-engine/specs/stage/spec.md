## MODIFIED Requirements

### Requirement: DOM 与 SVG 分层 Stage

系统 MUST 提供 `@compose-ui/stage` React 包。`Stage` MUST 使用 DOM Viewport 与 Scene Layer 渲染
Frame、Group 和宿主 React Component，并使用覆盖视口的 SVG Overlay 渲染编辑反馈；首版 MUST
NOT 使用纯 Canvas 2D 场景或公开多渲染后端选择。Stage MUST 通过
`@compose-ui/stage-engine` 驱动坐标、手势、吸附、preview 和空间命令，React 实现 MUST 只承担
DOM 输入适配、surface effect 应用和渲染。

#### Scenario: 渲染 Stage 分层

- **WHEN** 宿主使用文档、registry 与 interaction controller 挂载 Stage
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

### Requirement: ComponentPalette 拖入

系统 MUST 提供使用同一 registry 的 `ComponentPalette`。Palette 与 Stage MUST 共享实例级
`StageInteractionController`，并通过 external descriptor 驱动 Pointer 与键盘新增；有效 Frame
drop MUST 创建并选择一个 Component，Frame 外 drop MUST 发布 rejection 且不修改文档。

#### Scenario: 拖入有效 Frame

- **WHEN** 用户从 Palette 拖动 definition 并在未锁定 Frame 内松开
- **THEN** definition factory 生成独立 JSON props，并在 drop 世界位置派发一次 component.create
- **AND** 成功后 selection 更新为新节点 ID

#### Scenario: 拖到 Frame 外

- **WHEN** 用户在所有 Frame 之外或 locked Frame 中结束 palette drag
- **THEN** 不创建 Component 或事务历史
- **AND** CommandPanel 收到包含稳定原因的 rejected 事件

#### Scenario: 隔离多个 Stage 实例

- **WHEN** 页面挂载使用不同 interaction controller 的多个 Stage/Palette 组合
- **THEN** 每个 Palette 会话只影响与其共享 controller 的 Stage
- **AND** 其他实例的 snapshot、selection 和文档保持不变

### Requirement: Frame Palette 拖入

ComponentPalette MUST 可以在 registry components 前显示 Frame presets，并使用同一
`StageInteractionController` 的 `{ kind: 'frame', presetId }` descriptor 支持 Pointer 与键盘
新增；Frame drop MUST 创建真正的根级 Frame。React icon 和 preset factory MUST 留在 Stage
适配层，不得进入 stage-engine descriptor。

#### Scenario: Pointer 居中创建根 Frame

- **WHEN** 用户把 Frame preset 拖到任意 Stage 屏幕位置
- **THEN** Stage 在对应世界点居中创建根级 Frame 并追加到 rootIds
- **AND** 新 Frame 被选中并成为 activeFrame，不会嵌套进已有 Frame

#### Scenario: 键盘新增 Frame

- **WHEN** 键盘用户激活 Frame Palette 项
- **THEN** Frame 在当前 viewport 世界中心创建
- **AND** 只产生一个 frame.create 事务

## ADDED Requirements

### Requirement: Stage 包导出边界

`@compose-ui/stage` MUST NOT 重导出坐标、矩阵、画布几何、空间命令、SceneIndex 或 interaction
controller，也 MUST NOT 提供 `StageDragController`、`dragController` prop 或兼容 facade。
消费者 MUST 从 `@compose-ui/stage-engine` 导入 headless API，并使用
`interactionController` 连接 Stage 与 Palette。

#### Scenario: 使用新的破坏性导入边界

- **WHEN** 消费者升级 Stage 与 Editor 的 major 版本
- **THEN** UI 组件和 StageFramePreset 继续从 stage 包导入
- **AND** 几何、命令与 controller 只从 stage-engine 包导入

## MODIFIED Requirements

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
