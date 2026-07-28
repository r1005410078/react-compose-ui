## 1. Implementation

- [x] 1.1 Red: 为共享确认框和四个菜单场景补充组件测试。
- [x] 1.2 Green: 实现 ConfirmDialog 及画布、日志、历史、命令右键菜单。
- [x] 1.3 Refactor: 统一 I18n、焦点恢复和菜单启用条件。

## 2. 右键菜单快捷键提示

- [x] 2.1 Red/Green: 在 components 添加跨平台 `ComposeKeybinding` 格式化测试和
  `ComposeContextMenuShortcut` 复用展示；初始失败为新公开入口与 formatter 缺失。
- [x] 2.2 让 Stage、History、Scene Tree、Asset Browser 按实际生效键位显示提示；覆盖重绑、空数组、
  History 独立使用与 Editor preferences 同步。
- [x] 2.3 为 Operation Log、Command Panel 补充没有键盘动作时不显示快捷键的回归测试，并验证场景树
  粘贴目标不显示误导性提示。
- [x] 2.4 运行 OpenSpec strict、全仓 lint/typecheck/test/build/test:e2e 与 `git diff --check`。
  - 通过：`bunx openspec validate add-panel-context-menus --strict`、受影响包测试与 typecheck、
    `bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`、`git diff --check`。
  - `bun run test:e2e` 在提升权限后完成浏览器执行；资源右键菜单遮挡场景通过，10/14 通过。
    其余 4 个失败分别为既有 SVG inspector 黄金图、两项 Stage Pointer 几何及设置面板 inert 属性，
    均不经过本变更的菜单或键位代码，未在本变更中修改。
