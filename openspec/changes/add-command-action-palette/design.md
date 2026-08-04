# 设计：命令面板检索与动作目录

## 背景调研

命令面板是成熟模式，但各产品对「所有操作都走命令」的实现方式有一条共同的限制值得先记下：

| 产品 | 入口 | 架构要点 |
| --- | --- | --- |
| Figma | `Cmd+K` 浮层 | 覆盖菜单命令、插件与 AI，官方文档明确是子集 |
| VS Code | `Cmd+Shift+P` 浮层 | command 是执行单元；`when` 子句控制是否出现在面板；单输入框用 `>` `@` `:` `#` 切模式 |
| Blender | `F3` 搜索 | 最纯粹：快捷键、按钮、gizmo、脚本全部调 operator |
| Notion / Jira | 文本框内 `/` | `/` 是输入框内约定，`Cmd+K` 是全局浮层约定 |

Blender 的 operator 带 `bl_options` 标志：`UNDO`（是否入撤销栈，并非全部 operator 都有）、`INTERNAL`
（从搜索结果隐藏），另有 `poll()` 判可用性。VS Code 的 `when` 子句是同一思路。

结论：**「所有操作可被命令调用」与「所有操作都进历史」是两件事**，必须分开控制。

## 决策 1：新增 Action 层，而非改造 EditorCommand

`EditorCommand` 是文档变更载荷，经 `dispatch` 必然产生 transaction。若把视口、工具、面板操作改造成
`EditorCommand`，则需要在 core 协议上增加「不入历史」标志并修改 20 余处调用点，且会让「文档变更」这一
清晰语义变得含糊。

改为在 `dispatch` 与会话状态之上新增 `ComposeCommandAction` 层：

- 该发命令的动作在 `run()` 里调 `dispatch` —— 进历史，语义不变
- 该改会话状态的动作在 `run()` 里调 setter —— 不进历史，与 `viewport-store` 既有注释的设计意图一致

对应 Blender 的 `UNDO` 标志，但无需新增标志位：由 `run()` 的实现自然表达。

## 决策 2：`disabledReason?: string` 而非 `isEnabled(): boolean`

`stage-engine` 的 `getGroupCommandAvailability` / `getUngroupCommandAvailability` 已经返回
`{ available: false, reason }`。用 `disabledReason` 可直接复用该 reason，并把「为什么不能编组」呈现给用户，
比单纯灰掉信息量更大。有值即不可用，无需第二个字段表达同一事实。

## 决策 3：动作由宿主预先本地化

`ComposeCommandAction.title` 是成品字符串，面板不做 i18n。理由：

- 与包内既有 `ComposeCommandPreset.label`、`ComposeAssetContextMenuItem.label` 惯例一致
- 避免 `command-panel` 反向依赖 `editor` 的 i18n key，违反架构边界
- 面板自身的 chrome 文案（占位符、空态、分组标题）仍走包内 `commandMessages` 字典

## 决策 4：`/` 是可选前缀，不是模式选择器

输入框只检索动作，因此 `/` 不承担区分模式的职责，仅作为习惯性前缀被剥离。保留 VS Code 式多模式前缀
（`@` 图层、`#` 页面）的空间，但本次不实现——那需要同时接入场景树与页面目录。

三态行为：

| 输入 | 结果区 |
| --- | --- |
| 空 | 不渲染，面板与变更前完全一致 |
| `/` | 全部动作，按 category 分节 |
| 文本 或 `/文本` | 过滤结果 |

空查询不渲染结果区是为了保住调试台的既有形态与既有测试语义。

## 决策 5：排除 `stage.temporaryPan`

该动作是按住不放的临时手势，做成一次性列表项没有意义。对应 Blender 的 `INTERNAL`：不放进目录即可，
不需要在协议上增加隐藏标志。17 条动作实得 16 条。

## 键盘隔离

搜索框是可编辑元素，因此既有「快捷键输入隔离」需求自动覆盖：在框内输入 `v` 不会切换工具，`Delete` 不会
删除实体。该需求同时规定 History 的文档级撤销重做语义不受隔离影响，因此不得断言 `Cmd+Z` 在框内失效。
本次为该既有需求补充针对搜索框的场景，不新增需求。

## 与 Stage 键盘处理的关系

`edit.*` 的执行目前写在 `compose-stage.tsx` 的 if 阶梯中。动作目录不复制该逻辑——真正的 planner 位于
`stage-engine/src/commands.ts`，两侧都只是调用它，重复的仅是调用点。本次不改 stage；让其键盘处理反向
走动作目录是后续独立变更。
