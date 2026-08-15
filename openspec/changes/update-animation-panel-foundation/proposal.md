# 变更：让动画面板脱离原型约束

## 原因

`add-animation-panel-prototype` 交付了可操作的本地动画会话，但代码评审发现四处结构性限制：
面板只在深色主题下可读、动画片段没有轨道归属、演示数据的本地化被编进组件、以及基础控件没有
复用 `@compose-ui/components`。这些都涉及公共 API 或架构边界，必须先立规范再实现。

## 变更内容

- 把 `styles.css` 中硬编码的前景色全部换成 `--compose-*` token，使面板在 light 与 dark 下都可读。
- **BREAKING** 给 `ComposeAnimationClip` 增加必填 `trackId`，删除按 label 猜测轨道归属的启发式。
- 删除 `displayTrackLabel` / `displayPropertyLabel` 的 id 白名单，改由宿主提供本地化 label。
- 时间线与属性面板的按钮、数值输入与颜色字段改用 `@compose-ui/components`。
- 轨道名列表与关键帧轨道共用同一条垂直滚动，消除多轨道时的行错位。
- 用 `ComposeContextMenu` 重新提供轨道与属性行的"更多操作"菜单。

## 影响

- 受影响规范：`animation-panel`
- 受影响代码：`packages/animation-panel`（全部源文件）、`packages/animation-panel/package.json`
  （新增 `@compose-ui/components` 依赖）、`apps/storybook`
