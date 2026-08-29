# 变更：绘图命令的单键快捷键

## 原因

七条绘图命令今天只有工具栏按钮和命令行两个入口——想画一条线，要么把鼠标移到工具栏，
要么把焦点交给命令行敲 `LINE↵`。而 `V`/`F`/`T` 这些工具早就是按下即生效。`todo` 第 3 条
「快捷键画线不好使」说的就是这件事。

SDD 2.1 已确认：常用绘图命令各绑一个单键，按下即开始，没有确认键（AutoCAD 敲 `L` 之后
那个空格不携带任何信息）。

## 变更内容

- `ComposeStageShortcutAction` 新增七个 `drafting.*` 动作，`DEFAULT_STAGE_SHORTCUTS`
  给出默认键位：`L`/`P`/`R`/`C`/`A`/`X`/`W`。
- 补三个单字母别名：`PLINE` += `P`、`RECTANGLE` += `R`、`WIRE` += `W`、`ARROW` += `X`。
  规则是**单键快捷键 MUST 同时是该命令的一个别名**，用户只记一套词。
- 快捷键经 `ComposeStageHandle.startCommand` 已在用的那条启动路径生效，不另走一条。
- 命令会话进行中，图面上的单键**不**启动新命令。

## 影响

- 受影响的规范：`stage`、`stage-engine`
- 受影响的代码：
  - `packages/stage/src/types.ts`
  - `packages/stage/src/stage-surface/keyboard/stage-shortcuts.ts`
  - `packages/stage/src/stage-surface/keyboard/use-stage-keyboard.ts`
  - `packages/stage/src/stage-surface/compose-stage.tsx`
  - `packages/stage-engine/src/drafting/line-command.ts`
  - `packages/stage-engine/src/drafting/shape-commands.ts`
