# 任务

## 1. 包骨架

- [x] 1.1 `packages/commands/`：package.json（零运行时依赖）、tsconfig、vite、vitest、README
- [x] 1.2 根 `pack:dry-run` 脚本加入新包

## 2. 键位能力

- [x] 2.1 `ComposeKeybinding` 单一定义
- [x] 2.2 `normalizeComposeKeybinding` / `serializeComposeKeybinding`（自 editor 迁入）
- [x] 2.3 `matchesComposeKeybinding` 与键码归一（自 stage 迁入）
- [x] 2.4 `formatComposeKeybinding` / `formatComposeKeybindings`，platform 必填（自 components 迁入）
- [x] 2.5 `ComposeKeybindingMap<TAction>` 与归一化 / 去重 / 冲突检测 / 命中解析
- [x] 2.6 共置单测

## 3. 接线

- [x] 3.1 `components`：转导 `ComposeKeybinding`，`formatComposeKeybinding` 收为读取
      `navigator.platform` 的薄封装，公共签名不变
- [x] 3.2 `stage`：`ComposeStageKeybinding` 改为别名，`isStageShortcutMatch` 转调共享实现
- [x] 3.3 `editor`：`ComposeEditorKeybinding` 改为别名，归一化 / 序列化 / 冲突检测转调共享实现
- [x] 3.4 `editor` 默认键位表由 `DEFAULT_STAGE_SHORTCUTS` 展开，只补自己独有的 6 项

## 4. 守卫

- [x] 4.1 `commands` 依赖边界测试：无 React、无 DOM、无 `@compose-ui/*`
- [x] 4.2 Red：确认边界测试在违反时真的失败

## 5. 验证

- [x] 5.1 `bun run lint`
- [x] 5.2 `bun run typecheck --force`
- [x] 5.3 `bun run test --force`
- [x] 5.4 `bun run build --force`
- [x] 5.5 `bun run test:e2e`

## 6. 实施中的发现与偏离

- [x] 6.1 **`isEditableTarget`(stage) 与 `isEditableKeyboardTarget`(editor) 实现逐字相同**，
      `diff` 确认。它依赖 `Element`/`HTMLElement`，放进无 DOM 的 Layer 1 包会破坏包定位，
      因此不在本刀范围，记为已知遗留。
- [x] 6.2 `composeKeyboardEventCode` 由私有改为导出。Stage 的临时平移用它比对按下与松开的
      键（`use-stage-keyboard.ts`），若与匹配各实现一份，`code` 缺失的环境里会出现按下能
      开始、松开却结不掉。
- [x] 6.3 `DEFAULT_STAGE_SHORTCUTS` 新增到 `@compose-ui/stage` 公共入口，供 Editor 展开。
      这是本刀唯一新增的 Stage 公共导出。
- [x] 6.4 核对两张默认表：30 项重叠、当前取值**逐项一致**，因此本刀是消除重复而非修复
      已发生的漂移。展开之后重复在结构上消失，不再依赖人工同步。
- [x] 6.5 `AGENTS.md` 补上新包的架构边界与五层模型归属；根 `pack:dry-run` 加入新包。
