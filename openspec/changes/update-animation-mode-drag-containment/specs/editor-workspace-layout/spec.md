## MODIFIED Requirements

### Requirement: 动画模式

页面文档工具栏的模式切换器切到「动画」时，编辑器 MUST 进入动画模式；切回「设计」时
MUST 退出。动画模式 MUST 以**当前作用域 Frame** 为界：时间线显示该 Frame `Animations` 清单中的
动画，属性面板打点只作用于该 Frame 内的 Entity。作用域 Frame MUST 解析为「选中对象所属的
最近祖先 Frame」，没有任何选择时 MUST 回退到页面的 `activeFrameId`——与 `多画板下的 Frame
动作目标` 同一条规则，因此「哪一块会被发布」与「正在编辑哪一块的动画」可以不同。时间线、
动画文件选择器、镜像水合、自动记录与关键帧 Inspector MUST 全部解析到同一个 Frame，
MUST NOT 各自解析。作用域 Frame MUST 在时间线上具名可见，使跳转可被察觉。
组件文档工作区 MUST 同样支持动画模式，作用域为组件的根 Frame。动画模式下画布、属性面板与
预览 MUST 显示当前播放头时刻的采样文档，而所有编辑命令 MUST 仍然派发到基础文档。播放头、
播放状态、自动记录开关与动画选择 MUST 是编辑器会话状态，MUST NOT 写入文档或撤销历史。

动画模式下画布拖拽 MUST 以锁定原父级运行（Editor 向 Stage 传入 `lockGestureParent`）：
move 手势 MUST NOT 产生跨父级 reparent 落点与结构命令——动画模式的拖拽表达姿态编辑，
自动记录开启时写入播放头处的关键帧、关闭时写入基础 offset，对象 MUST 始终留在其所属
场景内。切回设计模式后跨父级拖拽 MUST 恢复既有行为。

#### Scenario: 进入与退出动画模式

- **WHEN** 用户在页面文档工具栏把模式切换到「动画」
- **THEN** 编辑器进入动画模式，时间线显示当前作用域 Frame 的动画
- **WHEN** 用户把模式切换回「设计」
- **THEN** 编辑器退出动画模式，画布恢复显示基础文档

#### Scenario: 组件文档的动画模式

- **WHEN** 用户在组件工作区打开动画模式
- **THEN** 时间线显示组件根 Frame 的动画，打点写入该组件文档
- **AND** 宿主页面文档不发生任何变化

#### Scenario: 切换活动 Frame 更新时间线

- **WHEN** 用户在多画板文档中把活动 Frame 从 A 切换到 B
- **THEN** 时间线切换为 B 的动画清单，播放头重置为 B 的会话状态

#### Scenario: 选中另一块场景内的对象切换作用域

- **WHEN** 激活场景是 A，用户选中场景 B 里的一个 Entity
- **THEN** 时间线切换为 B 的动画清单，打点写入 B
- **AND** 页面的 `activeFrameId` 不发生变化

#### Scenario: 清空选择回退到激活场景

- **WHEN** 用户在场景 B 中打点后清空选择
- **THEN** 时间线回到激活场景 A 的动画清单

#### Scenario: 动画模式拖拽不跨场景挂载

- **WHEN** 在动画模式下，用户拖动场景 B 内的对象且落点越过 B 的边界或进入场景 A
- **THEN** 对象仍属场景 B，不产生任何 reparent 或 moveEntity 命令
- **AND** 自动记录开启时该拖拽在播放头处写入 B 场景动画的关键帧，场景 A 的动画不变

#### Scenario: 播放头驱动画布

- **WHEN** 动画中某 Entity 的位置在 0 ms 与 300 ms 各有一个关键帧，用户把播放头拖到 150 ms
- **THEN** 画布中该 Entity 显示在两个关键帧之间的插值位置
- **AND** 文档与撤销历史不发生任何变化

#### Scenario: 播放不产生事务

- **WHEN** 用户播放整条动画
- **THEN** 撤销历史中不新增任何条目
