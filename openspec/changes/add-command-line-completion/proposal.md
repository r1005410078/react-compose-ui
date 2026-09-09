# 变更：命令行提示可键入的命令

## 原因

**命令行是绘图命令唯一的说明书，而它什么都不说。**绘图入口已经收敛成命令（工具栏按钮只是
其中一条的快捷入口），`POLYGON` 这类不在工具栏上的命令只能靠敲；但用户面对的是一个写着
「键入命令」的空框——能敲什么、别名是什么、此刻哪些可用，屏幕上没有任何地方回答。
命令面板搜不到绘图命令（它们不在动作目录里），`+`/`-`、`Alt` + 滚轮这类能力也只在命令行的
关键字里出现过。少了提示，「能力不可发现」那条毛病只是从「不进模式看不见命令行」换成了
「看见了也不知道敲什么」。

AutoCAD 的 AutoComplete 是既有解法：打字即提示、Enter 接受高亮项；`/` 列出全部是 Slack /
VS Code 这一代工具的通行约定，本仓库的用户不熟 AutoCAD、熟这些。

## 变更内容

### 新增

- `ComposeCommandLine` 加可选 `completions`（一组 `ComposeCommandDescriptor`）：空闲且缓冲非空时
  提示匹配的命令，`/` 列出全部；方向键移动高亮、`Enter` 提交高亮项的 `id`、`Tab` 填进缓冲、
  第一级 `Escape` 只收起列表。输入框随之成为 WAI-ARIA combobox。
- `matchComposeCommandCompletions` 纯函数住 `components`：整词 > 前缀 > 显示名/检索词包含，
  同档保持词汇表次序。
- 文案加 `completionsLabel`（列表的可访问名称）。
- Stage 把合并后的词汇表（内建 + 宿主注入）交给命令行做补全，与提交时解析的是同一份；
  文案加 `draftingCommandCompletions`，placeholder 改成「键入命令，/ 列出全部」。

### 修改

- Stage 的命令行输入框角色从 `textbox` 变为 `combobox`：既有端到端与组件测试的定位随之更新。

## 影响

- 规范：`components`（命令行 Pattern）、`stage`（词汇表）。
- 代码：`packages/components/src/command-line/`、`packages/stage/src/drafting/use-stage-drafting.ts`、
  `packages/stage/src/stage-surface/compose-stage.tsx`、`packages/stage/src/stage-i18n.ts`、
  既有测试里 `getByRole('textbox', { name: '命令行' })` 的定位。
