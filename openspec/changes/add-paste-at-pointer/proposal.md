# 变更：粘贴落在指针处

## 原因

画布上 `Cmd/Ctrl+V` 粘出来的副本落在**来源旁边**（同父级错开 10，跨父级保留来源坐标）。
用户复制一个符号是为了把它放到**别处**，而不是放在原件上再拖一次；在一张 5000 个 Entity 的
接线图上，来源与目标常常隔着好几屏，「粘完再拖过去」等于每次粘贴都多一次跨屏拖动。
Figma 与 AutoCAD 的粘贴都以指针为落点，用户对这个行为有既成的预期。

## 变更内容

- `@compose-ui/stage-engine` 的 `createPasteFromClipboard` 接受可选的**粘贴锚点**（一个世界
  坐标）：整组副本保持相对位置，整组的世界包围盒**中心**落到锚点，再过一次**网格吸附**
  （只吸网格，不找参考线——粘贴不是拖动，没有辅助线可画）。复制走带显式落点的
  `entity.duplicate`（`ComposeDuplicateInsertion.position`），剪切走带 dragged 变换的 reparent
  ——同父级也搬位置，不再按「顺序没变」拒绝。
- Stage 一直记着指针在图面上的位置（一个 ref，不进 React 状态）。`Cmd/Ctrl+V` 时指针在图面上
  就带锚点粘贴，父级取**指针下的容器**（与拖放落点同一条判据，剪切时排除来源自己），指针
  不在任何容器里时落进激活场景；指针不在图面上退回既有的建议落点。右键菜单的粘贴落在
  **打开菜单的那一下**指着的地方。
- 宿主接管 `edit.paste` 时随动作收到同一份落点（`onShortcutAction(action, detail)` 的
  `detail.pasteTarget`），编辑器据此直接走 stage-engine 的规划，规划不出来退回场景树的建议
  粘贴——两条路径粘出来的位置因此一致。

## 影响

- 受影响的规范：`stage`（Stage 复制剪切粘贴）、`stage-engine`（Entity 会话剪贴板规划）。
- 受影响的代码：`packages/stage-engine/src/commands/{clipboard,structure-commands}.ts`、
  `packages/stage/src/types.ts`、`packages/stage/src/stage-surface/{compose-stage.tsx,
  use-stage-clipboard.ts,pointer-session/use-stage-root-handlers.ts}`、
  `packages/editor/src/editor-controller/{action-catalog,controller}.ts(x)`。
- 公共 API：`onShortcutAction` 多一个可选的第二参数；既有只读第一个参数的宿主一行不改。
