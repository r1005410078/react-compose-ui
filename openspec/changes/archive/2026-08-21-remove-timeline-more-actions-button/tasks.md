# 实施清单

## 1. 规范与提案

- [x] 1.1 写出 `animation-panel` 的 MODIFIED 增量并通过 `openspec validate --strict`

## 2. 移除按钮

- [x] 2.1 Red：改写单测，断言行上不存在「更多操作」按钮，且右键仍打开同一份菜单
      （`2 failed | 63 passed`，两条都失败在按钮仍然存在）
- [x] 2.2 Green：从对象行与属性行移除 `MoreActionsButton`，删除该组件与只服务于它的
      `MoreActionsIcon`、`moreActions` 文案
- [x] 2.3 清理 `styles.css` 中只服务于该按钮的占位与显隐规则（属性行不再有任何行内动作按钮，
      `.property-meta` 的指针事件豁免一并删除）

## 3. 焦点与键盘

- [x] 3.1 验证右键关闭后焦点回到行命中按钮（`resolveFocusTarget` 走 `event.target.closest`）
- [x] 3.2 面板自己处理 Shift+F10 / ContextMenu 键
      实测发现原计划不成立：Chromium 只把独立的 ContextMenu 键翻译成 `contextmenu`，
      Shift+F10 不翻译，而 Mac 键盘上没有 ContextMenu 键——只靠浏览器翻译会让 macOS
      用户在按钮移除后完全没有键盘路径。改为在行命中按钮的 `onKeyDown` 里接管，
      锚点由行矩形推出。规范增量同步修正。

## 4. 验证

- [x] 4.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [x] 4.2 `bun run test:e2e`（e2e 的键盘断言换成真实 `Shift+F10` 按键，
      在真实 Chromium 下守住 macOS 路径）
