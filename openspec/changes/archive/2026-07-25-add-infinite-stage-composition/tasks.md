## 1. 依赖门禁与规范

- [x] 1.1 确认 `add-command-transaction-runtime` 已获批、实现并通过完整门禁
- [x] 1.2 审批 component-registry、stage、compose-preview 与 editor 增量并通过 strict validate
- [x] 1.3 建立新包、公共入口、TSDoc、样式入口、README 和 workspace 构建配置

## 2. ComponentRegistry Red → Green → Refactor

- [x] 2.1 Red：覆盖合法 definition、重复/空 type、非法默认 props/尺寸、顺序和实例隔离
- [x] 2.2 Green：实现 `@compose-ui/component-registry` 的 registry 与定义上下文
- [x] 2.3 Refactor：隔离 renderer/Inspector 错误并记录 Red/Green/Regression 证据
  - Red command/result/reason：`bun run --cwd packages/component-registry test` 的新增注册、seed、
    renderer/Inspector Scenario 在公共实现加入前失败。
  - Green command/result：component-registry 9/9 通过。
  - Regression command/result：package test、typecheck、lint、build 均通过。

## 3. Stage 坐标与分层 Red → Green → Refactor

- [x] 3.1 Red：覆盖 world/screen/local 矩阵、负坐标、缩放锚点和嵌套旋转往返
- [x] 3.2 Green：实现纯几何模块、DOM viewport/scene 与屏幕坐标 SVG Overlay
- [x] 3.3 Red：覆盖多 Frame、hidden/locked、未知/失败 renderer 与 CSS 网格
- [x] 3.4 Green：实现受控 `Stage` 基础渲染和错误占位
- [x] 3.5 Refactor：减少手势期间 React 更新范围并记录 Red/Green/Regression 证据

## 4. 选择与视口 Red → Green → Refactor

- [x] 4.1 Red：覆盖点击、Shift 多选、marquee、空白清选、select/pan、Space/中键和游标缩放
- [x] 4.2 Green：实现受控 selection/viewport/tool 与 Pointer 状态机基础
- [x] 4.3 Refactor：统一 pointer capture 清理和键盘焦点，记录 Red/Green/Regression 证据
  - Red command/result/reason：`bun run --cwd packages/stage test -- src/stage.test.tsx` 新增 capture
    断言后 1/19 失败；手势尚未调用 `setPointerCapture`。
  - Green command/result：加入 capture/release 与 lost capture 取消后 19/19 通过。

## 5. 变换、吸附与事务 Red → Green → Refactor

- [x] 5.1 Red：覆盖单选/多选 move、八向 resize、rotate 和修饰键
- [x] 5.2 Green：实现 rAF 瞬时预览与 pointerup 单事务提交
- [x] 5.3 Red：覆盖 6px 屏幕吸附、Frame/兄弟候选、禁用吸附和参考线
- [x] 5.4 Green：实现吸附引擎与 SVG guides
- [x] 5.5 Red：覆盖 Escape、pointercancel、lost capture、锁定目标和非法结果
- [x] 5.6 Green/Refactor：完成取消恢复、键盘 nudge/duplicate/delete/group/ungroup 并记录证据
  - Green command/result：geometry 6/6、Stage 19/19、commands 3/3 通过。
  - Regression command/result：吸附视觉测试显示 Frame guide，pointerup 前不增加历史且取消保持文档。
  - Bugfix Red command/result/reason：真实 Chromium 中将 `se` 手柄移动到 `(936, 513)`，预览手柄
    错误停在 `(867, 470)`；geometry 回归同时得到 `x=-40/y=-10` 而非固定边 `x=80/y=80`，
    确认 resize scale 在矩阵分解时被重复用于位置反解。
  - Bugfix Green command/result：位置分解改用剥离 scale 后的纯旋转分量；geometry 7/7 通过，
    Chromium 中 8 个手柄逐一向内、向外拖动均与鼠标目标坐标重合。
  - Group Bugfix Red/Green：Chromium 在 Group 两个子节点之间的空白区域命中 Frame
    `stage-demo-0` 而非 Group `stage-demo-8`；移除 Group 容器的 Pointer 穿透后，Group 可精确移动
    80×40px，内部 Component 仍可单独命中并移动 40×20px。

## 6. ComponentPalette Red → Green → Refactor

- [x] 6.1 Red：覆盖 definition 列表、跨面板 Pointer 拖入、有效 Frame drop 和 Frame 外 rejection
- [x] 6.2 Green：实现 ComponentPalette、StageDragController、拖拽预览和一次创建事务
- [x] 6.3 Refactor：验证监听释放、多个编辑器实例隔离和键盘新增路径并记录证据
  - Red command/result/reason：`bun run --cwd packages/stage test -- src/palette.test.tsx` 在真实
    pointerdown/up/click 序列下 1/4 失败；同一用户意图额外发布 rejected。
  - Green command/result：Pointer click 抑制与计时清理加入后 4/4 通过。
  - Regression command/result：Stage 全量 32/32、typecheck、lint 通过。

## 7. Editor controller Red → Green → Refactor

- [x] 7.1 Red：覆盖 controller 派生树/Stage/历史/Inspector/Command 内容和选择清理
- [x] 7.2 Green：实现 `useComposeEditorController` 与 SceneTreeOperation/Inspector/Stage 适配
- [x] 7.3 Red：覆盖 Component Library 标签、默认 Stage、stageToolbar 优先和旧插槽兼容
- [x] 7.4 Green：实现默认工作区组合与单一 transaction observer
- [x] 7.5 Refactor：确认无 controller 时既有面板数量、内容和快捷键回归，记录测试证据
  - Red command/result/reason：`bun run --cwd packages/editor test`，新增六面板、Library slot、
    toolbar 优先和 controller 默认组合后 7/21 失败；原工作区仍只有五面板并透传未知 props。
  - Green command/result：editor 27/27 通过。
  - Regression command/result：editor typecheck、lint、build 通过；无 controller 的空树、历史
    快捷键、显式 children 和旧 `canvasToolbar` 测试继续通过。
  - Toolbar Refactor：Stage 工具栏恢复为紧凑深色图标栏，交互、Frame、缩放按语义分组；
    Chromium 实测 toolbar 48px、按钮 36×36px、分隔线 24px，图标按钮保留完整可访问名称、
    pressed/disabled 状态和键盘焦点。

## 8. Preview Red → Green → Refactor

- [x] 8.1 Red：覆盖指定 Frame、裁剪、visible、嵌套变换、未知 renderer 和 legacy children
- [x] 8.2 Green：实现 document/registry/frameId 驱动的 ComposePreview
- [x] 8.3 Refactor：确认 Preview 不依赖 editor/stage 且无编辑 Overlay，记录包回归证据
  - Green command/result：preview 6/6 通过。
  - Regression command/result：preview package 只依赖 core/component-registry，typecheck、lint、
    build 通过，测试 DOM 中没有 Stage Overlay。

## 9. 示例与浏览器纵向流程

- [x] 9.1 Red：创建 Frame → 拖入组件 → 多选吸附 → 分组 → 属性编辑 → undo/redo → 日志 → Preview
- [x] 9.2 Green：把 Rectangle、Text、ECharts 迁移为 registry definitions 并接入 controller
  - Green command/result：补充 ECharts 浏览器回归后先命中可访问错误占位；注册 BarChart、
    GridComponent、TitleComponent 与 CanvasRenderer 后，Stage 内实际 Canvas 1/1 通过。
- [x] 9.3 Red/Green：覆盖键盘编辑、失败 drop、未知组件占位和多实例隔离
- [x] 9.4 生成并人工审查默认工作区、选择、吸附和 Command rejection 视觉黄金文件
- [x] 9.5 Refactor：删除示例手写 Canvas/状态 glue，记录 Chromium E2E 与视觉证据
  - Green command/result：目标 Chromium Stage 纵向流程 1/1 通过，覆盖 Frame、Pointer drop、
    多选分组、PropertyPanel、undo/redo、Command rejection、Operation Log 和 Preview。
  - Green command/result：Stage 创建、移动、缩放与旋转事务生成英文数据摘要；History 分行展示
    动作与数值，Operation Log 详情展示相同事务的 Before/After 和 patches。
  - Regression command/result：根路径只挂载 Stage controller 完整示例并从 runtime 派生文档；
    旧手写 Canvas、事务专用入口及其状态 glue 已删除。
  - Visual result：`stage-workspace-default.png`、`stage-workspace-selected.png`、
    `stage-workspace-snapping.png`、`stage-workspace-command-rejected.png` 在锁定 Chromium
    1280×720 下按图标工具栏重新生成并逐张人工审查通过。

## 10. 文档与完成门禁

- [x] 10.1 更新根 README、stage/registry/editor/preview 文档、project、AGENTS、依赖和 changeset
- [x] 10.2 逐项核对 Scenario 与 `OpenSpec: <capability> / <Requirement> / <Scenario>` 测试映射
- [x] 10.3 运行 strict validate、lint、typecheck、test、build、test:e2e、pack dry run 和 diff check
  - Regression command/result：两份 change strict validate 通过；root lint、typecheck、test、build、
    pack dry run 均退出 0；完整 Chromium E2E 6/6 通过并比较 Stage 视觉黄金文件。
- [x] 10.4 补齐每个循环的 Red/Green/Regression 证据并仅勾选实际完成项
