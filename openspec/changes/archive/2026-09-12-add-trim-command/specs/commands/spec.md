## ADDED Requirements

### Requirement: 落在对象上的点是第四种输入

会话协议 MUST 提供输入种类 `pick`：`{ kind: 'pick', targets: [{ id, point }] }`——一个或多个
**落在对象上的点**，每项带对象标识与点。它既不是 `point` 也不是 `selection`：

- 不是 `point`，因为它 MUST NOT 经过点输入管线——吸附会把落点挪到光标底下那截线之外，而用户
  瞄的正是那截线；等待 `pick` 的一步也 MUST NOT 被当成「正在取点」。
- 不是 `selection`，因为它 MUST 说出落在对象的**哪儿**，且 MUST NOT 改动宿主的选择集。

`targets` MUST 是数组：一笔拖过多个对象时 MUST 作为**一次**输入推进——一次输入、一个事务。
点一下是长度为 1 的退化情形。

本字段 MUST 只含字符串标识与两个数：本包零运行时依赖、不认识任何文档协议，这条不因为多了一种
输入而松动。没有声明 `pick` 的一步收到它 MUST 拒绝并停在原提示，与其余输入种类同一条规则。

#### Scenario: 声明 pick 的一步收到 pick

- **WHEN** 一步的 `accepts` 含 `pick`，会话收到一个 `pick` 输入
- **THEN** 会话按该输入推进

#### Scenario: 声明 pick 的一步收到点

- **WHEN** 一步的 `accepts` 只含 `pick`，会话收到一个 `point` 输入
- **THEN** 会话拒绝并停在原提示

#### Scenario: 没声明的一步收到 pick

- **WHEN** 一步的 `accepts` 不含 `pick`，会话收到一个 `pick` 输入
- **THEN** 会话拒绝并停在原提示

### Requirement: 提示可声明光标徽标

`ComposeCommandPrompt` MUST 提供可选的 `badge`，声明这一步要在光标旁画的徽标；v1 只有
`'scissors'`。缺席表示不画。

它 MUST 由**提示自己声明**，MUST NOT 由宿主按命令 id 反推——与 `cursorInput` 同一条判断：宿主
不认识任何一条命令的内部。它 MUST 只是呈现，MUST NOT 改变任何输入的解释。

#### Scenario: 缺席时呈现不变

- **WHEN** 一条提示没有声明 `badge`
- **THEN** 宿主的呈现与本要求引入之前完全一致

#### Scenario: 声明剪刀

- **WHEN** 一条提示声明 `badge: 'scissors'`
- **THEN** 宿主在光标旁画出剪刀徽标
