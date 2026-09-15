## 1. stage-engine
- [x] 1.1 `ComposeDuplicateInsertion.position`：显式落点压过来源坐标与同父级错开，副本定为 absolute
- [x] 1.2 `createPasteFromClipboard(..., anchor)`：整组包围盒中心落到锚点、网格吸附、跨父级换算局部坐标；剪切走带 dragged 变换的 reparent
- [x] 1.3 用例：锚点复制、跨父级换算、锚点剪切同父级也搬位置

## 2. stage
- [x] 2.1 根元素一直记着指针的图面局部坐标（ref），离开即清
- [x] 2.2 `executeClipboard` 第三参数为世界坐标；父级取 `containerAtPoint`，剪切排除来源
- [x] 2.3 键盘粘贴读指针、右键粘贴读菜单锚点；`onShortcutAction` 随 `edit.paste` 交出落点

## 3. editor
- [x] 3.1 `edit.paste` 动作把落点交给 `pasteSelection`
- [x] 3.2 controller 在有落点时走 stage-engine 规划，否则退回场景树建议粘贴
- [x] 3.3 用例：接管粘贴按落点落地

## 4. 验证
- [x] 4.1 `openspec validate add-paste-at-pointer --strict`
- [x] 4.2 `bun run lint && bun run typecheck && bun run test && bun run build`
- [x] 4.3 `bun run test:e2e`（新增 `e2e/paste-at-pointer.spec.ts`）
