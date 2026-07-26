# stage-engine Specification

## Purpose
TBD - created by archiving change extract-stage-interaction-engine. Update Purpose after archive.
## Requirements
### Requirement: 无 React 的 Stage Engine 包

系统 MUST 提供只依赖 `@compose-ui/core` 的 `@compose-ui/stage-engine` 公共包。包 MUST NOT
依赖 React、ReactDOM、DOM 类型、CSS、component-registry 或 ui-context，并 MUST 导出坐标、
矩阵、场景索引、吸附、滚动映射、空间命令与交互 controller 公共 API。

#### Scenario: 独立构建 Stage Engine

- **WHEN** 消费者在没有 React 或 DOM 的 TypeScript 环境导入 stage-engine
- **THEN** 可以计算文档世界几何、创建空间命令并驱动交互 controller
- **AND** 构建产物与 package manifest 不包含第一方 UI 包或 React 运行时

### Requirement: 场景索引与坐标空间

系统 MUST 从一个不可变 ComposeDocument 派生 parent、确定性文档顺序、世界矩阵、世界边界、
可见性和吸附候选，并 MUST 使用同一 viewport/surface 坐标协议完成 client、surface 与 world
换算。新 document 引用 MUST 产生对应的新索引结果。

#### Scenario: 查询嵌套世界几何

- **WHEN** 文档包含嵌套旋转 Group 与 Component
- **THEN** SceneIndex 返回由全部父级矩阵组合得到的世界矩阵和轴对齐边界
- **AND** world/surface 往返在正负坐标与不同 zoom 下保持一致

#### Scenario: 文档更新后刷新索引

- **WHEN** controller 收到新的不可变 document 引用
- **THEN** 后续 hit、selection 和 snap 查询只使用新文档结果
- **AND** 不复用旧文档的 parent、矩阵或可见性条目

### Requirement: Headless 交互 Controller

系统 MUST 提供实例级 `StageInteractionController`，使用普通数据事件、不可变 snapshot 和
surface effect port 表达 pan、marquee、move、resize、rotate、guide 与 external drag。一个
controller MUST 同时只允许一个 surface 连接。

#### Scenario: 连接并驱动 surface

- **WHEN** 宿主连接一个 surface、更新受控 context 并发送 Pointer 事件
- **THEN** controller 发布对应 phase 与 preview snapshot
- **AND** viewport、selection、pointer capture 和命令请求通过 effect port 返回

#### Scenario: 拒绝第二个同时连接的 surface

- **WHEN** 同一 controller 已连接 surface 且另一个 surface 尝试连接
- **THEN** connectSurface 明确抛错
- **AND** 原连接与活动交互保持不变

### Requirement: 手势预览与原子提交

内部变换 session MUST 捕获开始文档与世界几何，Pointer 更新 MUST 只发布 preview。
pointerup MUST 使用最终点冻结最多一个命令或 batch，并在清理 preview 和释放 capture 之前
提交该 effect。cancel、真实 lost capture、失焦或不兼容 document/tool/selection context 更新
MUST 清理预览且不提交文档；surface 尺寸重测 MUST NOT 取消活动 move、resize 或 rotate。

#### Scenario: 高频更新后单次提交

- **WHEN** move、resize 或 rotate session 收到多次 Pointer 更新后结束
- **THEN** 每次更新只改变 snapshot 中的局部 preview transform
- **AND** 结束时只产生一个包含最终结果的 dispatch effect

#### Scenario: 取消或文档并发变化

- **WHEN** 活动内部手势被取消，或 context document 在提交前变化
- **THEN** phase 返回 idle 并清除 preview、snap guide 与 pointer 状态
- **AND** surface 不收到 dispatch effect

#### Scenario: 最终点与 effect 顺序

- **WHEN** move、resize 或 rotate 没有中间 move，直接以新的最终点 pointerup
- **THEN** dispatch effect 包含该最终点计算出的 transform
- **AND** command dispatch 先于 idle preview 清理和 pointer release

#### Scenario: 活动期间重测 surface

- **WHEN** 活动 move、resize 或 rotate 的 surface 尺寸发生变化
- **THEN** session 继续使用开始时的 viewport 与 adapter 冻结的 surface 原点计算最终几何
- **AND** 不因纯测量变化取消或丢失正常 pointerup

### Requirement: 统一外部拖入

controller MUST 使用 `{ kind: 'component', componentType }` 与 `{ kind: 'frame', presetId }`
descriptor 管理 Palette Pointer 和键盘新增会话。Engine MUST 负责 surface/world 定位与合法
Frame 命中，React adapter MUST 在 drop effect 中解析 registry seed 或 Frame preset。

#### Scenario: 拖入 Component

- **WHEN** external component 会话在未锁定 Frame 内结束
- **THEN** controller 产生包含最终世界点和 Frame ID 的 external drop effect
- **AND** external Pointer 过程不直接创建文档事务

#### Scenario: 取消或落在 Frame 外

- **WHEN** external 会话被取消或 Component 在所有合法 Frame 外结束
- **THEN** 取消会话不产生 effect，Frame 外 drop 产生可观察 rejection 所需的 drop effect
- **AND** controller 返回 idle

### Requirement: 世界几何保持的结构命令

stage-engine MUST 支持 nullable reparent，并使用 Frame 实现 group/ungroup。Frame resize MUST
只更新所选 Frame 自身 transform；移动或旋转 MUST 通过父矩阵影响后代。

#### Scenario: Resize Frame 不缩放孩子

- **WHEN** 用户 resize 根级或嵌套 Frame
- **THEN** Frame 的边界更新而全部后代局部 transform 保持不变
- **AND** pointerup 仍只派发一个 transform 事务

### Requirement: 输出区域检查命中

controller MUST 接受独立的 output hit，并通过 output selection effect 请求宿主检查隐式 Canvas。
输出检查不得写入 selectedIds；节点、resize、rotate、guide 和平移命中 MUST 保持原优先级。

#### Scenario: 点击与框选输出区域

- **WHEN** 选择工具在输出区域空白处按下并松开
- **THEN** controller 清空节点选择并请求检查 output
- **AND** 从输出区域拖出有效框选后改为返回命中的节点选择

#### Scenario: 平移不切换检查目标

- **WHEN** pan 工具、Space 临时平移或中键从输出区域开始
- **THEN** controller 只更新 viewport
- **AND** 不发送 output selection effect
