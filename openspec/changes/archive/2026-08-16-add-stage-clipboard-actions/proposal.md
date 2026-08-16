# 变更：画布复制、剪切与粘贴

## 原因

画布右键已有「创建副本」和删除，但没有复制/剪切，也无法用平台主修饰键（macOS ⌘、其他平台 Ctrl）
把选区放入会话剪贴板。场景树已有独立内存剪贴板，画布与场景树之间不能互粘。

## 变更内容

- 画布右键菜单增加复制、剪切、粘贴，并显示当前平台键位。
- 新增可配置快捷键 `edit.copy` / `edit.cut` / `edit.paste`，默认 Primary+C/X/V。
- 编辑器会话持有一份内存剪贴板，画布与场景树共用；不写入系统剪贴板。
- 独立 Stage 保留内建剪贴板回退；嵌入 Editor 时由动作目录接管。
- 粘贴走建议落点：容器追加子项，叶节点插到自身之后，空白画布落到根级。

## 影响

- 受影响规范：`stage`、`stage-engine`、`editor-preferences`、`editor-workspace-layout`
- 受影响代码：`packages/stage-engine` 剪贴板规划，`packages/stage` 右键菜单与快捷键，
  `packages/editor` 动作目录、偏好、本地化和控制器
- 公共 API：扩展 Stage/Editor shortcut action union，新增会话剪贴板类型与规划函数
- 文档模型：ComposeDocument v6 Schema 不变
