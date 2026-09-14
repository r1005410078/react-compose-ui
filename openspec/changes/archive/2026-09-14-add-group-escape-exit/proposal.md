## Why

进了组之后（双击穿过 Group、选中了它的子级），用户想「出来」只有一条路：点空白。`Escape`
此刻什么都不做——它只中止手势。Figma 在这一档按 `Escape` 回到上一层（选中那个 Group），用户
的手已经记着这个键了。

## What Changes

- `stage-engine` 新增纯函数 `resolveStageGroupExit`：求当前选区共同的最近 Group 严格祖先。
- Stage 空闲时的 `Escape`：选区是某个 Group 的后代就选中那个 Group（回到上一层）；没有更外层的
  Group 时保持既有行为。手势进行中仍只中止手势。
- 点外面本来就退出——「已进入」由选区派生，点空白或别的对象都会换掉选区——本次不改。

## Impact

- 受影响规范：`stage-engine`（Group 门槛那一条加退出解算）、`stage`（Group 先选组那一条加
  `Escape`）。
- 受影响代码：`stage-engine/hit-testing/group-selection.ts`、`stage/stage-surface/keyboard/use-stage-keyboard.ts`。
- 协议不变。行为变更只在「选区是 Group 的后代」这一档；其余 `Escape` 语义（中止手势、命令与几何
  编辑的两级 Escape）不变，它们排在前面。
