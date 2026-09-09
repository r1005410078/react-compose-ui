# 实施任务

次序是有依赖的：**先补动作，再删按钮**（否则中间会有一段时间某条能力只剩一个改不了的键）；
**先搬模式切换器，再改工具栏行高与按下态**（后者的用例要断行尾那颗控件还在）。

## 1. 先补两条动作

- [x] 1.1 注册 `document.save`：从 `compose-editor.tsx` 的按键处理里拆出来，进动作目录、
      默认绑 `Cmd/Ctrl+S`、没有活动文档时给出不可用原因。
- [x] 1.2 注册 `document.toggleAnimationMode`：进目录、默认不绑键；宿主未启用页面系统时
      整条省略。
- [x] 1.3 组件测试：两条动作在目录里、可用性判断正确、`document.save` 改键后旧键失效。

## 2. 顶栏：先减，再加开关

- [x] 2.1 删掉文档标签条右端的保存按钮。
- [x] 2.2 工作区管理菜单并进切换器活动段的 `▾`，`▾` 不参与 radiogroup 方向键序列。
- [x] 2.3 加三颗布局开关（左 / 底 / 右），复用既有 `toggleSide` 与底栏折叠；实心 = 展开、
      描边 = 收起，两态都渲染，携带 `aria-pressed`。
- [x] 2.4 右端收成两段（视图 | 应用），段间一条竖线。
- [x] 2.5 删 `WorkspaceSideHandle`（8px 把手）与 `WorkspaceHeaderActions` 里的两个组头折叠
      按钮，连同它们的样式与既有用例。
- [x] 2.6 组件测试：三颗开关的按下态跟随面板状态；收起右栏后开关位置不变；折叠不产生事务。

## 3. 模式切换器搬到工具栏行尾

- [x] 3.1 从文档标签条移到画布工具栏行尾，与货架之间一条竖线；形状与原来一致（带文字的
      两段控件）。
- [x] 3.2 它 MUST NOT 进入货架：不出现在「自定义工具栏…」的列表里，右键它没有「从工具栏
      移除」，溢出计算 MUST NOT 把它收进「更多」。
- [x] 3.3 组件测试 + e2e：切换器在行尾、窄窗口下仍在、从命令面板切换时它同步更新。

## 4. 面板头统一成标签加一条 chrome

- [x] 4.1 属性面板：删掉那条 52px 的标题行，对象语义并进 Dockview 标签（`属性 · <对象>`）；
      行里那簇动作（实例 Apply/Revert、添加能力）并进搜索那一行的右端，为此给
      `ComposePropertyPanelRoot` 加一个 `toolbarActions` 槽。119 → 66px。
- [x] 4.2 ~~搜索折成图标~~ **不做**。动作并进 chrome 行之后那一行是常驻的，折叠搜索只再省
      6px（36 → 30），却要动 `property-panel` 与 `scene-tree` 两个包的搜索交互。原稿说的
      「30px」要把动作渲染进 Dockview 组头（portal），那是另一件事，留作后续。
- [x] 4.3 ~~场景图同一条规则~~ **本来就符合**：它是 30 标签 + 32 chrome，没有第二条标题行。
- [x] 4.4 组件测试：属性面板没有第二条标题行；动作与搜索同行；标签文字随选区变。

## 5. 工具栏行与按下态

- [x] 5.1 `.compose-editor__stage-toolbar` / `.compose-editor__canvas-toolbar` 的 `min-h-12`
      → 36px；按钮、间距、命中区不动。
- [x] 5.2 `.compose-editor__toolbar-divider` 24 → 18px 并提亮。
- [x] 5.3 `[aria-pressed='true']` 按角色拆成两条：工具走内缩 2px 的底（26×26 于 30×30），
      开关只改图标颜色且点亮色与静息色**有明度差**；hover 跟着内缩到与工具按下同形。
- [x] 5.4 工具栏项的类型上区分「工具（单选）」与「开关（多选）」——今天两者只差调用方怎么
      传 `pressed`，样式无从分派。
- [x] 5.5 组件测试：同时按下一个工具与两个开关时，只有工具画出底块；命中区仍是 30×30。

## 6. 验证

- [x] 6.1 `bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`。
- [x] 6.2 `bun run test:e2e`；`editor-workspace.spec.ts` 与 `toolbar-shelf.spec.ts` 跟着改。
- [x] 6.3 **整窗黄金图全部重录**：工具栏行矮 13px 会把画布里的一切上移，顶栏与两侧面板头
      也都在取景里。逐张核对是尺寸变化而不是别的东西变了。
- [x] 6.4 `bunx openspec validate update-editor-chrome-density --strict`。
