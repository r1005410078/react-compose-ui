## 1. 独立包与设计契约

- [x] 1.1 Red：为默认演示轨道、播放/循环、关键帧选择与属性编辑编写纯状态测试。
  - 记录：初始夹具后执行 `bun run --cwd packages/animation-panel test`，因尚未实现播放按钮而失败。
- [x] 1.2 Green：实现可受控/非受控的会话 Provider 与状态转换。
  - 记录：实现后同一测试通过；状态只存在 Provider 的 React 会话中。
- [x] 1.3 Red：为底部时间线、右侧属性、键盘可访问性和主题/语言兼容编写组件测试。
  - 记录：键盘测试先断言 ArrowRight 后应为 210 ms，未实现键盘处理时仍为 200 ms。
- [x] 1.4 Green：实现时间线与关键帧属性组件，严格对齐参考图布局。
  - 记录：修复播放头键盘处理并完成底部/右侧组件后，组件与纯模型共 7 个测试通过。
- [x] 1.5 Refactor：整理 feature-first 导出、TSDoc、共置 CSS 与演示 Story；重新运行包测试。
  - 记录：公共入口只导出 Compose API，样式随包发布，并加入固定参考尺寸 Storybook Story。

## 2. 验证

- [x] 2.1 运行 `openspec validate add-animation-panel-prototype --strict`。
  - 结果：通过（OpenSpec 的遥测上报因离线网络失败，不影响校验结果）。
- [x] 2.2 运行 `bun run --cwd packages/animation-panel lint`、`typecheck`、`test` 与 `build`。
  - 结果：全部通过；`test` 为 2 files / 7 tests，另以 `pack:dry-run` 验证发布物。
- [x] 2.3 在 Storybook 的固定深色尺寸下检查正常、播放、关键帧选中和曲线标签状态；记录人工比对结果。
  - 结果：以 `1672 × 941` 深色 Storybook 画板人工核对，右侧为 332 px、底部为 300 px；默认 200 ms 选中态、自动记录、4 个菱形关键帧和曲线标签均与 `design/animation.png` 对齐。主区刻意为空，不接画布。

## 回归校验

- `bun run typecheck`：通过（23 tasks）。
- `bun run build`：通过，包含 Storybook 和新包。
- `bun run lint`：未通过，既有 `packages/editor/src/compose-editor/compose-editor.tsx:1158` 的 `react-hooks/refs` 规则报错，不在本变更范围。
- `bun run test`：未通过，既有 `packages/editor/src/pages/page-workspace.test.tsx` 2 个用例仍查找已不存在的“打开组件 JS/JSON 配置”按钮；其余 175 个 Editor 测试和新动画包 11 项测试通过。

## 3. 编辑器宿主挂载

- [x] 3.1 Red：为底部工具组新增动画标签编写工作区布局测试。
  - 记录：`workspace-layout.test.ts` 先期断言 7 个面板与 `compose-animation`；实现前仅有 6 个面板，测试失败。
- [x] 3.2 Green：将独立包作为 Editor 的纯 UI 依赖，挂载底部时间线并在动画标签激活时显示右侧关键帧属性。
  - 记录：右侧属性区不随动画标签切换，继续显示编辑器原有 Inspector；相关断言见 workspace-panels.test.tsx。
- [x] 3.3 在示例编辑器中确认“动画”标签可见并可展开，右侧显示关键帧属性面板。
  - 结果：本地示例编辑器确认底部依次显示“资源 / 动画 / 命令 / 日志”；激活“动画”后底部显示时间线，右侧保持原有属性面板。
  - E2E：`bun run test:e2e` 在本机受控端口执行，60 条通过；2 条既有组件库用例失败（首页组件库标题等待、组件库黄金图像差异），与动画标签无关。

## 4. 可操作时间线

- [x] 4.1 Red：为每个关键帧属性同步、Play once/Loop/PingPong 推进和关键帧移动规则补充单元与组件测试。
  - 记录：新增测试覆盖后，现有实现缺少播放模式与 Pointer 拖动接口，测试先期失败。
- [x] 4.2 Green：将布尔循环状态升级为三种播放模式，并按边界规则推进播放头。
- [x] 4.3 Green：实现关键帧 Pointer capture 拖动、10 ms 吸附、ArrowLeft/ArrowRight 微调、时间冲突阻止和 Inspector 同步。
- [x] 4.4 验证：运行新包 lint/typecheck/test/build、OpenSpec 严格校验及编辑器相关回归测试。
  - 结果：动画包 `lint`、`typecheck`、`test`（2 files / 11 tests）与 `build` 全部通过；
    `openspec validate add-animation-panel-prototype --strict` 通过；Editor 工作区相关测试 2 files / 7 tests、
    `typecheck` 与 `build` 全部通过。
  - 人工验证：示例编辑器的“动画”标签中选择 `PingPong` 后仍显示右侧关键帧属性；将 200 ms 菱形帧拖到
    250 ms，右侧“时间”字段同步为 `250 ms`。
- [x] 4.5 修复 Editor 构建裁剪动画样式的问题。
  - 记录：动画包 CSS 不再使用 Tailwind 保留的 `components` layer；示例开发态确认时间线恢复 `flex` 布局、
    60 px 控制栏和 1 px 顶部边框。
- [x] 4.6 提供可编辑的尾帧时长。
  - 记录：编辑 300 ms 尾帧时长会同步移动原尾帧、扩展标尺和播放范围；缩短时保留至少 10 ms 的尾帧间隔。
    新增模型和组件测试，动画包共 13 项测试通过；示例中将尾帧改为 500 ms 后确认控制栏样式、滑块最大值和
    500 ms 菱形关键帧均同步更新。
- [x] 4.7 根据尾帧时长动态生成标尺主刻度。
  - 记录：600 ms 显示 0～600 ms 的 100 ms 主刻度，组件测试覆盖完整标注序列。
- [x] 4.8 在相邻关键帧之间提供可选的插值曲线段。
  - 记录：曲线段在悬停、聚焦和选中时显示中点曲线标识；点击后选中终点关键帧、切换右侧曲线标签并展示时间范围，不改变播放头。
- [x] 4.9 让底部工具组横跨编辑器完整底边。
  - 记录：场景与属性面板改为主工作区左右分栏，Dockview 只保留全宽的 bottom Edge Group；动画编辑器不再被左右栏压缩。
- [x] 4.10 对齐 Figma 的紧凑时间线密度与帧线配色。
  - 记录：控制栏、轨道、标尺、Clip 条和右侧关键帧属性均收紧；未选中帧线/关键帧使用低饱和灰，只有当前选中的过渡段保留蓝色强调，并修复基础按钮颜色覆盖导致帧线错误变白的问题。
- [x] 4.11 让动画片段可选中并支持拖动调整。
  - 记录：片段主体可平移、起止手柄可调整范围，并提供 10 ms 键盘微调；范围会限制在时间轴内且不会写入画布或历史。

## 5. 评审修复

- [x] 5.1 修复受控模式下播放头不推进（commit 身份稳定化 + rAF effect 重构 + 亚毫秒余量累积）。
- [x] 5.2 添加关键帧时按会话查重分配 ID，避免关键帧移动后产生同 ID。
- [x] 5.3 时长、时间与颜色字段统一改为草稿 + Enter/失焦提交，单位移出输入框。
- [x] 5.4 关键帧轨道改用独立命中按钮，去除嵌套交互元素；播放头擦洗区收缩到标尺带。
- [x] 5.5 选中态统一改用 `aria-current`，`aria-pressed` 只保留给自动记录开关。
- [x] 5.6 删除无行为的“更多操作”控件；`toolbar` 改为 `group`；缓动标签补齐 `useId`、漫游 tabindex 与方向键。
- [x] 5.7 时间冲突提示改由时间线播报、属性面板常驻可见并挂 `aria-describedby`；当前时间读数关闭隐式播报。
- [x] 5.8 记忆化会话对象，修正无选中关键帧时的头部与序号，清理死样式。
- [x] 5.9 规范与文档同步：右侧属性区行为以现状为准，删除 `animationPanelActive` 死状态，补 AGENTS.md 包清单与架构检查白名单。
