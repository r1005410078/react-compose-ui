# 新增命令与键位包

## Why

「一个动作、它的键位、它的显示名」这一件事的五个组成部分现在散在三个包里，其中两个还是重复的：

| 组成 | 位置 | 状态 |
| --- | --- | --- |
| 键位类型 | `ComposeKeybinding`(components) / `ComposeStageKeybinding`(stage) / `ComposeEditorKeybinding`(editor) | **三份，字段与语义逐字相同** |
| 归一化 + 序列化 | `normalizeComposeEditorKeybinding` / `serializeBinding`（editor 私有） | 一份，别人用不到 |
| 事件匹配 | `isStageShortcutMatch`（stage 私有） | 一份，别人用不到 |
| 平台格式化 | `formatComposeKeybinding`（components） | 一份 |
| 可编辑目标判定 | `isEditableTarget`(stage) / `isEditableKeyboardTarget`(editor) | **两份，实现逐字相同** |

**没有任何一个包同时拥有这五样。** 归一化在 editor、匹配在 stage，于是 editor 无法自己判定
一次按键命中了哪个动作，stage 也无法自己检测键位冲突。

更重的一处是默认键位表：`DEFAULT_STAGE_SHORTCUTS`（stage，30 项）与
`createDefaultComposeEditorPreferences().shortcuts`（editor，36 项）**逐字重复了 30 项**。
运行时 editor 的表经 `renderStage` 覆盖 stage 的表，stage 那份只在脱离编辑器时兜底。今天
两份完全一致，但**没有任何测试守住这件事**——改一处漏一处，表现是「设置里改了键位，脱离
编辑器使用 Stage 时还是旧键位」。

CAD 的命令行（见 `docs/cad-document-roadmap.md` 步骤 5）会成为第四个消费者。

## What Changes

新增 `@compose-ui/commands`：无 React、无 DOM、**零运行时依赖**（连 `core` 都不依赖，动作只是
`run(ctx)`，引擎不认识文档），按五层模型落在 Layer 1。承载：

- `ComposeKeybinding` 单一权威定义
- `normalizeComposeKeybinding` / `serializeComposeKeybinding`
- `matchesComposeKeybinding(event, binding)`——事件形状是结构化鸭子类型，不引用 DOM 类型
- `formatComposeKeybinding` / `formatComposeKeybindings`——**platform 必填**的纯函数
- `ComposeKeybindingMap<TAction>` 与 `normalizeComposeKeybindingMap` /
  `findComposeKeybindingConflict` / `resolveComposeKeybindingAction`

随后接线：

- `components` 从 `commands` 转导 `ComposeKeybinding`，`formatComposeKeybinding` 收窄为读取
  `navigator.platform` 的薄封装；公共 API 名称与签名不变
- `stage` 的 `ComposeStageKeybinding` 成为别名，`isStageShortcutMatch` 转调共享实现
- `editor` 的 `ComposeEditorKeybinding` 成为别名，归一化、序列化与冲突检测转调共享实现
- **editor 的默认键位表由 `DEFAULT_STAGE_SHORTCUTS` 展开而来**，只补自己独有的 6 项；
  30 项重复就此在结构上消失，而不是靠新增一条断言去守

## 本刀只做 Layer 1

多步提示会话协议（`指定第一点` → `指定下一点或 [闭合(C)/放弃(U)]`）形状通用，但**今天没有
消费者**。按 AGENTS.md「不得以未来可能复用为理由提前抽象」，它随 CAD 命令引擎
（路线图步骤 5）落进同一个包，届时由真实消费者定形。

`isEditableTarget` 那两份**不在本刀范围**：它依赖 `Element`/`HTMLElement`，放进无 DOM 的
Layer 1 包会破坏包的定位。记为已知遗留。

## Impact

- Affected specs: `commands`（新增）。`components` 的「共享键位格式化」、`editor-preferences`
  的默认键位与冲突规则**继续原样成立**——公开的名称、签名与默认值都没有变化，因此不产生
  MODIFIED 增量
- Affected code: 新增 `packages/commands/`；改动 `packages/components/src/context-menu/`、
  `packages/stage/src/types.ts` 与 `stage-surface/keyboard/`、
  `packages/editor/src/editor-preferences/preferences.ts`
- **BREAKING（类型归属）**：`ComposeKeybinding` 的定义处从 `components` 下沉到 `commands`。
  `components` 继续导出同名类型，消费者无需改动
