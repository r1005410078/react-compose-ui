# 命令词汇表合并

## Why

「能敲什么」今天定义了两遍，两个形状互相看不见：

| | 住在哪 | 形状 | 谁读它 | 有几条 |
| --- | --- | --- | --- | --- |
| `ComposeCommandDefinition` | `commands` | `id/aliases/title/start()` | Stage 命令行 | 8 |
| `ComposeCommandAction` | `command-panel` | `id/title/run()` | 命令面板检索 | 31 |

对用户的后果是：**撤销、编组、创建场景在面板里有、命令行敲不出来**；反过来 `LINE`、`MOVE`、
`ERASE` 命令行敲得出来、面板里搜不到。「我要做的这件事怎么触发」这个问题的答案取决于用户先
想到哪个入口，而两个入口都不完整。步骤 6 刚把命令行变成常驻——它常驻了，却只认得八个词。

**两个形状本来就是一个。**`Action` 是 `Definition` 的**退化情形**：一个 `prompt` 为 `null`、
收到确认就立刻提交的会话。这个形态不是设想出来的，**它已经在跑了**——`ERASE` 在预选情况下
`prompt` 就是 `null`，命令行走的正是「立即 accept」那一支。

合并还缺一样：**可用性**。八条绘图命令恒可用，因此命令行至今只有「未知命令」一种拒绝。编辑器
动作不是——没选中两个对象时编组不能执行。把动作放进命令行而不带可用性，用户敲 `GROUP` 会得到
**什么都没发生**，而这与敲错字在屏幕上无法区分。

## What Changes

- **`commands`**：抽出 `ComposeCommandDescriptor`（`id`/`aliases`/`title`/`category`/
  `keywords`/`shortcut`/`disabledReason`），`ComposeCommandDefinition` 继承它。新增
  `createComposeImmediateCommand`（把一次性动作包成退化会话）与 `runComposeCommandImmediately`
  （跑退化会话的**唯一**实现，命令行今天那段内联分支改为调用它）。
- **`editor`**：动作目录产出**命令定义**而不是面板动作，并注入 Stage。面板列表从**同一份目录**
  派生，因此两个入口不可能列出不同的东西。
- **`stage`**：新增 `commands` prop 接收宿主注入的定义，与内建的八条合成**一个**注册表。提交
  一个命令名时先看 `disabledReason`：不可用就把原因显示在命令行，**不启动会话**。
- **`stage-engine`**：八条内建命令带上 `category`，与宿主动作在同一份目录里可分组。
- **命令历史**：`ComposeCommandLine` 用上下箭头召回敲过的行（组件会话状态）；Stage 在空闲时把
  空 Enter 解释成**重复上一条命令**（宿主状态）。两者与 `operation-log` 的事务日志分属两件事
  ——一个记「我敲了什么」，一个记「文档变了什么」，一条命令可能产生零条或多条事务。
- **`command-panel`**：`ComposeCommandAction` 改为 `ComposeCommandDescriptor & { run(): void }`；
  检索把 `aliases` 一并纳入匹配，用户搜 `UNDO` 能找到「撤销」。

## Non-Goals

- **面板不启动画布会话。**`LINE` 需要在画布上取点，而「哪块画布」随当前标签页而变——CAD 标签页
  的 `LINE` 是另一条命令。让面板跑画布会话需要一条画布 → 宿主的命令上报通道，那是独立的一刀；
  本刀要解决的「敲不出来」发生在命令行。
- **不合并上下文。**`StageDraftingContext` 保持窄（文案 + 选择集），宿主动作的依赖在**注册时
  闭包捕获**。硬合并会让每加一条命令就往上下文里塞一个字段，而绝大多数命令用不到它。
- **CAD 侧不注入宿主动作。**`cad-canvas` 的注册表形状相同，合并方式照搬即可，但它今天没有
  「宿主动作」这个东西。

## Impact

- Specs：`commands`（ADD 2）、`command-panel`（MODIFY 1）、`stage`（ADD 2）、
  `editor-preferences`（MODIFY 1、ADD 1）
- 包：`commands`、`command-panel`、`components`、`stage`、`stage-engine`、`editor`
- 破坏性：`ComposeCommandAction` 的字段是**增量**的（多了 `aliases`），既有宿主不受影响。
