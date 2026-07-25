## 1. OpenSpec 与行为映射

- [x] 1.1 proposal、design、tasks 与六项能力增量通过 strict validate
  - Validate command/result：`openspec validate add-editor-preferences-shortcuts --strict` 通过；
    遥测发送因沙箱网络限制失败，不影响本地 strict validate 结果。
- [x] 1.2 每个新增 Scenario 建立 `OpenSpec: <capability> / <Requirement> / <Scenario>` 测试映射
  - Mapping result：editor、stage、scene-tree、history、command-panel 组件测试及 Playwright
    已覆盖六项增量的全部新增 Scenario。

## 2. 偏好与键位纯逻辑

- [x] 2.1 Red：默认/规范化、平台显示、匹配、清除/恢复和冲突检查测试失败
  - Red command/result/reason：`bun run --cwd packages/editor test -- preferences.test.ts`
    6/6 失败；默认 factory 尚未实现，键位规范化、平台匹配/显示、作用域冲突和 editable guard
    均返回占位结果，失败原因正是目标行为缺失。
- [x] 2.2 Green：实现 editor 偏好类型、factory、规范化与键位工具
  - Green command/result：`bun run --cwd packages/editor test -- preferences.test.ts`
    6/6 通过。
- [x] 2.3 Refactor/Regression：公共 API TSDoc、独立纯逻辑测试、typecheck 通过
  - Regression command/result：`bun --filter @compose-ui/editor test` 56/56 通过；公共入口类型、
    factory、匹配/显示/冲突工具均已补充 TSDoc。

## 3. 设置面板与 Editor 状态

- [x] 3.1 Red：齿轮按钮、面板开关/焦点、受控/非受控回调、搜索和冲突测试失败
  - Red command/result/reason：`bun run --cwd packages/editor test -- index.test.tsx`
    新增 9 项设置行为全部失败；现有齿轮仍为 role=img，根节点无主题/语言偏好，设置覆盖层、
    受控回调、快捷键捕获与搜索均不存在。
- [x] 3.2 Green：实现设置覆盖层、偏好状态与快捷键捕获
- [x] 3.3 Red/Green：实现 system theme 监听、root theme/lang 与实例卸载边界
- [x] 3.4 Refactor/Regression：Editor 组件测试与现有 Dockview 测试通过
  - Green/Regression command/result：`bun --filter @compose-ui/editor test` 4 个测试文件、
    56/56 通过，覆盖焦点恢复、Escape、受控状态、system 监听、搜索、捕获、冲突与恢复。

## 4. Stage 快捷键与临时平移

- [x] 4.1 Red：Space 从节点/Frame 开始、输入隔离、失焦/取消清理和自定义键位测试失败
  - Red command/result/reason：`bun run --cwd packages/stage test -- stage.test.tsx`
    新增 3 项均失败；节点/Frame pointerdown 在 Space 状态下提前停止冒泡，window blur 不清理，
    Stage 也尚未消费自定义临时平移键。
- [x] 4.2 Green：统一 pointer capture 临时平移与可配置 Stage 快捷键
- [x] 4.3 Refactor/Regression：文档、选择、History 不变及现有 Stage 手势测试通过
  - Green/Regression command/result：`bun --filter @compose-ui/stage test` 4 个测试文件、
    50/50 通过；临时平移只改变 viewport，节点、选择和事务记录保持不变。

## 5. 本地化与主题

- [x] 5.1 Red/Green：Stage、SceneTree、History、CommandPanel 与默认 Palette 中英文精确文案
  - Red command/result/reason：`bun run --cwd packages/history test -- history.test.tsx` 新增英文和
    默认语言用例 2/2 失败；`bun run --cwd packages/command-panel test -- command-panel.test.tsx`
    英文用例失败。locale 当前被泄漏为 DOM 属性，内建文案仍固定中文。
- [x] 5.2 Red/Green：Dark/Light/System token 与默认工作区完整主题层级
- [x] 5.3 Refactor/Regression：独立包默认 locale/样式保持兼容，Dark Stage 无非预期变化
  - Green/Regression command/result：Stage 50/50、SceneTree 65/65、History 18/18、
    CommandPanel 11/11 通过；独立包默认语言保持原行为，Editor 默认注入 `zh-CN`。

## 6. E2E、文档与完成门禁

- [x] 6.1 更新 README/package 文档、示例和 changeset
- [x] 6.2 Playwright 覆盖设置、Light/English、重绑临时平移与恢复默认
  - E2E command/result：`bun run test:e2e:update` 8/8 通过。
- [x] 6.3 新增深色设置、浅色工作区、英文工作区黄金图并人工审查
  - Visual result：`editor-preferences-dark.png`、`editor-workspace-light.png`、
    `editor-workspace-english.png` 已人工检查；浅色 Dockview/Stage/历史/属性层级完整，英文仅
    翻译内建 chrome。
- [x] 6.4 运行 strict validate、lint、typecheck、test、build、pack dry-run、test:e2e、diff check
  - Final result：`openspec validate add-editor-preferences-shortcuts --strict`、`bun run lint`、
    `bun run typecheck`、`bun run test`、`bun run build`、`bun run pack:dry-run`、
    `bun run test:e2e`（8/8）与 `git diff --check` 全部通过。

## 7. 共享 UI Context 架构增量

- [x] 7.1 修订 proposal/design 与十项能力增量并通过 strict validate
  - Validate command/result：`openspec validate add-editor-preferences-shortcuts --strict` 通过；
    遥测网络失败不影响本地校验结果。
- [x] 7.2 Red：Provider 嵌套、system、token 合并、消息回退/覆盖测试失败
  - Red command/result/reason：刷新 workspace 链接后运行
    `bun --filter @compose-ui/ui-context test`，6/6 按行为断言失败；占位 Provider 未提供 Context，
    因此 theme/locale/token/message 均为空且 system listener 未注册。
- [x] 7.3 Green：新增 `@compose-ui/ui-context` 公共包、类型、Provider、Hook 和 styles
  - Green command/result：`bun --filter @compose-ui/ui-context test` 6/6 通过；Provider 嵌套、
    system 监听、Dark/Light token 合并、消息回退/覆盖和模板变量均已实现。
- [x] 7.4 Refactor/Regression：公共 API TSDoc、独立构建、测试和 pack dry-run 通过
  - Regression result：Provider、Hook、CSS 变量转换器拆为独立 Fast Refresh 模块；公共类型及
    属性补齐 TSDoc，`@compose-ui/ui-context` build、typecheck、test 和 pack dry-run 均通过。

## 8. 第一方组件 Context 迁移

- [x] 8.1 Red：Editor 插槽 Context、显式 locale 优先级、独立默认和 token 应用测试失败
  - Red command/result/reason：Editor 1/57、Stage 1/51、SceneTree 1/66、History 1/19、
    CommandPanel 1/12 的新增 Context 行为断言失败；组件尚未消费共享 Provider，宿主 token 和
    message 覆盖无法跨包传播。
- [x] 8.2 Green：迁移 Editor、Stage、Palette、SceneTree、History 与 CommandPanel
  - Green result：Editor 57/57、Stage 51/51、SceneTree 66/66、History 19/19、
    CommandPanel 12/12 通过；显式 locale → Context → 独立默认优先级均有测试。
- [x] 8.3 Red/Green：迁移 PropertyPanel issue/chrome、OperationLog 和基础材料 Inspector
  - Green result：PropertyPanel 54/54、OperationLog 17/17、Materials 11/11 通过；结构化
    issue code 保持稳定，材料 Inspector 的本地化 Schema 不重建 registry 或产生额外 dispatch。
- [x] 8.4 Refactor/Regression：删除 locale clone 与 editor 逐包浅色覆盖，现有独立 API 保持兼容
  - Regression result：Editor 不再 clone locale；逐包主题规则下沉，各消费包构建均把
    `@compose-ui/ui-context` 保持为 external，避免生成多个 Context 实例。

## 9. VS Code 式设置模态

- [x] 9.1 Red：dialog 语义、分类、跨分类搜索、inert、焦点陷阱、遮罩和 Escape 层级测试失败
  - Red reason：原 `SettingsPanel` 是 `role=region` 的左侧覆盖层，不具备 dialog、分类导航、
    inert、焦点陷阱、遮罩关闭和捕获态 Escape 分层，新契约断言在旧实现上不成立。
- [x] 9.2 Green：实现 editor 范围模态、左侧分类与即时设置
  - Green result：Editor 组件测试 57/57 通过；覆盖 dialog 语义、三类导航、跨分类搜索、
    即时主题/语言/键位更新和每次重开的状态重置。
- [x] 9.3 Refactor/Regression：Dockview 实例与布局状态不重建，设置关闭恢复焦点
  - Regression result：Dockview 仅切换 inert，实例和布局保持不变；关闭按钮、遮罩、
    设置快捷键与 Escape 均恢复齿轮焦点，捕获快捷键时 Escape 只取消捕获。

## 10. 架构增量 E2E 与门禁

- [x] 10.1 Playwright 覆盖模态分类、Light/English、消息覆盖、重绑平移与重新打开
  - E2E result：`bun run test:e2e` 8/8 通过；设置纵向流程覆盖初始焦点、inert、分类、
    Light/English、宿主消息覆盖、重绑/恢复临时平移和重新打开回到外观。
- [x] 10.2 更新深色模态、浅色完整工作区和无第一方残留中文的英文黄金图
  - Visual result：三张黄金图已更新并人工检查；模态层级与裁切正常，浅色工作区层级完整，
    英文工作区无第一方固定中文，宿主 `Initial state` 等业务内容保持原样。
- [x] 10.3 更新架构文档、README、依赖、pack 脚本和 changeset
  - Documentation result：根 README、AGENTS、OpenSpec project、相关包 README、安装示例、
    workspace 依赖、changeset 与按依赖拓扑排列的根 pack 脚本均已同步。
- [x] 10.4 运行 strict validate、lint、typecheck、test、build、pack dry-run、test:e2e、diff check
  - Final result：`openspec validate add-editor-preferences-shortcuts --strict`、`bun run lint`、
    `bun run typecheck`（25/25 tasks）、`bun run test`（24/24 tasks）、`bun run build`
    （13/13 tasks）、`bun run pack:dry-run`、`bun run test:e2e`（8/8）均通过；
    `git diff --check` 通过。
