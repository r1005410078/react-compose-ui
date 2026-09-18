# 任务

## 1. 契约

- [x] 1.1 `ComposeEditorLibraryConfig` 增加 `openOnStart?: boolean`，TSDoc 写明缺席即 `true`
      以及「只喂初值、不是受控属性」
- [x] 1.2 `compose-editor.tsx` 的 `libraryOpen` 初值读它

## 2. 用例（先红后绿）

- [x] 2.1 组件用例：给了 `library` 不写 `openOnStart` → 起手在页面库（既有行为不变）
- [x] 2.2 组件用例：`openOnStart: false` → 起手在画布，且标志那扇门仍在
- [x] 2.3 组件用例：已经在库里时把 `openOnStart` 改成 `false` → 仍在库里（不是受控属性）

## 3. 示例应用

- [x] 3.1 默认接上 `library`（含 `renderPage`），`?library` 改为控制起手位置
- [x] 3.2 注释改写：说清楚这个开关现在管的是形态而不是能力
- [x] 3.3 `e2e/page-library.spec.ts` 的 `?library` 语义不变，整份跑通

## 4. 验证

- [x] 4.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 4.2 `bun run test:e2e`：`/` 仍落在画布上，既有用例不因本变更改动一处 goto
- [x] 4.3 `npx openspec validate add-library-entry-opt-out --strict`
