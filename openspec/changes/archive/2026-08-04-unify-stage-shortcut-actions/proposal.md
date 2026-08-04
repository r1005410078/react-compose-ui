# 变更：Stage 快捷键动作可由宿主统一接管

## 原因

同一个动作目前在三处各有实现：Stage 的键盘处理、Editor 工具栏，以及新增的命令面板动作目录。
这已经造成可观察的行为分歧——「适配选择」按键盘用 `min(w/target.w, h/target.h) * 0.85`，
按工具栏用 `min((w-128)/b.w, (h-128)/b.h)`，同一个动作两种结果。

`@compose-ui/stage` 不得依赖 `@compose-ui/editor`，因此不能反向引用动作目录。需要由 Stage 声明
协议、宿主注入实现。

## 变更内容

- `ComposeStage` 新增可选 `onShortcutAction`：宿主返回 `true` 表示已接管该动作，Stage 阻止默认
  行为并停止内建处理；返回 `false` 或未提供该属性时，Stage 保持现有内建实现。
- 按住不放的临时平移始终由 Stage 自己处理，不参与委派。
- `@compose-ui/editor` 把动作目录拆为与界面语言无关的执行层与本地化呈现层，并将执行层同时提供
  给命令面板与 Stage，使编辑器内键盘、工具栏与命令面板走同一条路径。

## 影响

- 受影响规范：`stage`、`editor-preferences`
- 受影响代码：`packages/stage` 键盘处理与公共属性、`packages/editor` 动作目录与控制器
- Stage 独立使用时行为不变：`onShortcutAction` 是可选属性，内建实现作为回退保留
- 不改动 `@compose-ui/core` 协议，不改动既有键位默认值
