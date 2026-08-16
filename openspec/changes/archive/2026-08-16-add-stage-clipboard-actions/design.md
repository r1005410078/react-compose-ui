# 设计：画布与场景树共享会话剪贴板

## 上下文

场景树已有 `useComposeSceneTreeCommands` 内存剪贴板，复制后粘贴发 `duplicate`，剪切后粘贴发
`move`。`ComposeSceneTree` 已接受外部 `commands`。Stage 不得依赖 scene-tree，Editor 可以组合两者。

画布已有 `edit.duplicate`（Primary+D，立刻复制）和共享 `ComposeContextMenuShortcut` /
`ComposeKeybinding.primary` 平台键位展示。复制/剪切是另一条「先入剪贴板、再粘贴」路径。

## 目标/非目标

- 目标：画布右键与快捷键提供复制、剪切、粘贴。
- 目标：macOS 显示并匹配 ⌘，其他平台显示并匹配 Ctrl。
- 目标：Editor 内画布与场景树共用同一份会话剪贴板。
- 目标：独立 Stage 不依赖 Editor 也能复制/剪切/粘贴。
- 非目标：系统剪贴板、跨文档、跨页面或跨编辑器实例粘贴。
- 非目标：改变「创建副本」或场景树菜单分组。

## 决策

### 1. 剪贴板只存规范化 Entity ID

载荷为 `{ kind: 'copy' | 'cut', entityIds }`。复制可重复粘贴；剪切在成功移动后清空。祖先与后代
同时入选时只保留最外层祖先。复制包含锁定节点；剪切只包含未锁定且可移动的节点。

规划器放在 `@compose-ui/stage-engine`，独立 Stage 直接调用。Editor 把场景树命令控制器提升到
`useComposeEditorController`，通过已有 `commands` 注入 SceneTree；Stage 只接收剪贴板快照以计算
粘贴可用状态，键盘和菜单动作走 `onShortcutAction`。

### 2. 粘贴使用建议落点

与场景树键盘 `paste-suggested` 一致：

- 选中可容纳子项的未锁定容器：追加为最后一个子项
- 选中叶节点：插到该节点之后
- 空白画布或空选区：追加到根级

`createDuplicateCommand` 接受可选插入位置。复制到原父级时 Absolute 节点仍偏移 10；跨父级粘贴
不再额外偏移，由插入点决定结构位置。剪切跨父级继续走现有 reparent 规划器以保持世界几何。

### 3. 快捷键与菜单

Stage 与 Editor 增加 `edit.copy` / `edit.cut` / `edit.paste`，默认 `{ code: 'KeyC'|'KeyX'|'KeyV',
primary: true }`。`primary` 已按平台匹配 Command/Control，菜单用 `formatComposeKeybindings`
展示。裸 `C` 仍是绘制容器工具，不与 Primary+C 冲突。

文字编辑或可编辑输入中的 Cmd/Ctrl+C/X/V 仍交给浏览器，Stage 不拦截。

## 风险/权衡

- 场景树粘贴为子/兄弟/根仍不显示 Cmd+V，因为键盘只会走建议粘贴。画布菜单的「粘贴」对应建议
  粘贴，因此显示快捷键。
- 旧偏好对象缺少新动作时由 normalize 补默认值。
- 实例内部复合地址的复制/粘贴仍受现有场景树操作接线限制，本变更不补齐实例内 duplicate。
