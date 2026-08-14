## ADDED Requirements

### Requirement: Auto-keyframe 自动属性轨道

动画编辑会话 MUST 默认开启可关闭的 Auto-keyframe。开启时，系统 MUST 识别视觉安全属性修改并写入
动画草稿，不提交对应文档事务；关闭时 MUST 完整保留既有文档编辑语义。时间轴 MUST 只显示检测到的
属性轨道；除没有 authored 对应字段的通道外 MUST NOT 提供手动添加属性入口。

#### Scenario: 首次修改自动建立轨道

- **WHEN** 播放头位于 300ms，用户把未动画的白色背景改为红色
- **THEN** 会话自动创建背景轨道、0ms 白色关键帧和 300ms 红色关键帧
- **AND** Entity authored 背景仍为白色且文档历史不增加

#### Scenario: 更新当前时间的既有帧

- **WHEN** 当前属性轨道在播放头时间已经存在关键帧且用户再次修改属性
- **THEN** 会话更新该关键帧而不创建重复时间
- **AND** 一次连续颜色或拖动交互只增加一个动画会话历史项

#### Scenario: 关闭自动刻帧

- **WHEN** 用户关闭 Auto-keyframe 后修改同一属性
- **THEN** 系统按原有命令更新 ComposeDocument
- **AND** 动画草稿和关键帧保持不变

#### Scenario: Auto Layout 子节点拖拽不录制位置

- **WHEN** Auto-keyframe 开启且用户拖拽 Flow 容器的子节点触发 reorder
- **THEN** 系统保持原有 reorder 命令语义且不创建位置关键帧
- **AND** 发布说明该节点位置只能通过时间轴数值编辑写入 offset 的诊断

#### Scenario: 添加没有 authored 对应字段的轨道

- **WHEN** 用户打开「添加轨道」入口
- **THEN** 菜单只列出没有 authored 对应字段的通道（v1 仅 scale）
- **AND** 位置、旋转、透明度与背景不出现在菜单中

### Requirement: 容器范围时间轴与上下文 Inspector

React 时间轴 MUST 聚合当前 Hierarchy 容器后代的 Animation；叶子选择 MUST 使用最近 Hierarchy 祖先，
顶层叶子 MUST 使用隐式 Canvas。时间轴 MUST 区分节点持续区间、属性轨道、关键帧和播放头，并同时只
编辑一个活动动画资源。播放头 MUST 表示活动资源的本地时间，`delayMs` 与 `speed` MUST 只影响节点
区间的可视化呈现而 MUST NOT 参与关键帧寻址。关键帧或区间选择 MUST 切换右侧上下文 Inspector。

#### Scenario: 聚合容器后代动画

- **WHEN** 容器内的 Fault 与 Alarm 分别绑定动画资源
- **THEN** 时间轴显示两个节点区间及各自自动识别的属性轨道
- **AND** 点击任一轨道只切换活动资源，不改变 Scene Tree 层级或文档选择

#### Scenario: 选择四个关键帧中的第三帧

- **WHEN** 属性轨道在 0、100、200、300ms 各有一帧且用户选择 200ms
- **THEN** 播放头移动到资源本地 200ms，第三个菱形显示选中，右栏显示 3/4、时间、值和进入该帧的 easing
- **AND** Stage 显示同一 FrameSnapshot

#### Scenario: delay 与 speed 不改变关键帧寻址

- **WHEN** 活动资源所属节点配置了 100ms delay 与 2 倍 speed
- **THEN** 播放头与关键帧时间仍按资源本地时间显示和寻址
- **AND** 节点区间在时间轴上按 delay 偏移并按 speed 缩放呈现

#### Scenario: 选择区间编辑缓动

- **WHEN** 用户选择两个关键帧之间的连线
- **THEN** 右栏显示 Curve/Spring/Hold 设置并把修改写入后一个关键帧的 easing
- **AND** 清除时间轴选择后右栏恢复节点 Inspector

### Requirement: 动画编辑会话草稿与显式保存

React 编辑会话 MUST 使用独立于页面文档历史的草稿与 Undo/Redo，只有显式保存才写 Provider，并 MUST
处理 expected revision 冲突、重新加载、强制覆盖与 dirty 关闭保护。撤销快捷键的路由 MUST 由动画
面板可见性与焦点确定，且 MUST NOT 跨栈撤销。自动创建的槽位映射 MUST 在资源保存成功后才提交
文档事务。

#### Scenario: 保存动画草稿

- **WHEN** 用户移动关键帧、修改 easing 后执行保存
- **THEN** 会话以读取时 revision 写入完整候选资源并清除 dirty
- **AND** 播放器订阅新 revision 后使用新资源

#### Scenario: 保存遇到资源冲突

- **WHEN** Provider revision 已在外部变化
- **THEN** 会话保留本地草稿并提供重新加载或显式覆盖
- **AND** 不自动覆盖远端内容或修改节点引用

#### Scenario: 撤销栈路由

- **WHEN** 焦点位于时间轴内时执行撤销，随后把焦点移到 Stage 再次执行撤销
- **THEN** 第一次撤销动画草稿操作，第二次撤销页面文档事务
- **AND** 两个栈的历史项互不合并，History 面板只显示页面文档历史

#### Scenario: 草稿存在时关闭会话

- **WHEN** 用户在存在未保存草稿时关闭动画面板或切换活动页面
- **THEN** 会话按 dirty 关闭保护提示并在确认后清除选择与播放调度
- **AND** 已保存的资源内容与节点引用保持不变
