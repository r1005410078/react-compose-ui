## ADDED Requirements

### Requirement: 绘图命令的单键快捷键

Stage MUST 为七条绘图命令各提供一个默认单键快捷键，按下即启动，MUST NOT 需要确认键：

| 动作 | 命令 | 默认键 |
| --- | --- | --- |
| `drafting.line` | `LINE` | `L` |
| `drafting.polyline` | `PLINE` | `P` |
| `drafting.rectangle` | `RECTANGLE` | `R` |
| `drafting.circle` | `CIRCLE` | `C` |
| `drafting.arc` | `ARC` | `A` |
| `drafting.arrow` | `ARROW` | `X` |
| `drafting.wire` | `WIRE` | `W` |

这七个动作 MUST 是 `ComposeStageShortcutAction` 的成员，因此 MUST 可被 `shortcuts` 覆盖
键位、可被 `onShortcutAction` 接管。做成「键位直接映射到命令 id」会绕开这两条通道，宿主
将既不能改键也不能接管。

快捷键 MUST 经与命令行、`ComposeStageHandle.startCommand` **同一条**启动路径生效，
MUST NOT 另走一条构造上下文、推进状态机的路径——理由与那两者同源：另写一份必然只实现三种
拒绝里的一两种，同一条命令会在不同入口给出不同结果。

**一条命令会话正在进行时，图面上的单键 MUST NOT 启动新命令。** SDD 2.2 的最终形态是把
命令进行中的可打印字符转交给动态输入框，而动态输入尚未落地；在它到来之前启动新命令会
**静默丢弃**正在进行的那一条，用户已取的点就没了。什么都不做是安全子集，动态输入落地时
接管这一档即可。

**同一个事件上还有别的 Stage 动作时，绘图单键 MUST 让路。** 绘图键是七个**裸字母**，是快捷键
表里最容易被撞上的一类绑定；宿主把某个动作重绑到 `P` 是一次显式选择，而 `P` 画多段线只是默认
值。不让路的话，新增这七个默认键会静默夺走宿主已经绑好的键，症状是「我绑的键失灵了」。

`X` 给 `ARROW`、`A` 给 `ARC` 是一次取舍：`A` 只能给一条，弧比箭头更接近「基础图形」。

#### Scenario: 按下 L 即开始画线

- **WHEN** 图面聚焦且没有命令在跑，用户按下 `L`
- **THEN** `LINE` 会话启动，命令行显示「指定第一点」
- **AND** 状态与在命令行敲 `LINE↵` 完全一致

#### Scenario: 带修饰键的同一个字母不受影响

- **WHEN** 用户按下 `primary+X`
- **THEN** 执行剪切，MUST NOT 启动 `ARROW`

#### Scenario: 焦点在命令行时单键是文本

- **WHEN** 焦点在命令行输入框里，用户键入 `R`
- **THEN** 输入框收到字符 `R`，MUST NOT 启动 `RECTANGLE`

#### Scenario: 命令进行中单键不替换会话

- **WHEN** `LINE` 已取到一个点，图面聚焦，用户按下 `R`
- **THEN** `LINE` 会话保持不变，已取的点仍在，MUST NOT 启动 `RECTANGLE`

#### Scenario: 与别的动作撞键时让路

- **WHEN** 宿主把一个非绘图动作也绑到 `P`，用户按下 `P`
- **THEN** 执行那个动作，MUST NOT 启动 `PLINE`

#### Scenario: 宿主可以改键与接管

- **WHEN** 宿主把 `drafting.line` 绑到别的键并按下它
- **THEN** `LINE` 启动
- **WHEN** 宿主的 `onShortcutAction` 对 `drafting.line` 返回 true
- **THEN** Stage 不再自己启动该命令
