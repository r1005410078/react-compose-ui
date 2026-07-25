## 1. OpenSpec 与包基座

- [x] 1.1 proposal、design、tasks 与四项能力增量通过 strict validate
- [x] 1.2 新增 stage-engine 包、依赖边界测试、构建与公共 TSDoc

## 2. 坐标、场景索引与空间命令

- [x] 2.1 Red：坐标、SceneIndex、缓存更新和滚动/吸附测试在新包缺失时失败
  - Red command/result/reason：`bun run --cwd packages/stage-engine test` 在依赖链接完成后
    4/18 失败；SceneIndex 返回空索引，controller 尚未计算 move preview 或 external drop，
    失败由目标行为未实现导致。
- [x] 2.2 Green：迁移几何/画布几何并实现 StageSceneIndex
- [x] 2.3 Red/Green：迁移 group、ungroup、reparent、duplicate 与 transform 空间规划
  - Red command/result/reason：新增 Group resize 后代映射测试后，
    `bun run --cwd packages/stage-engine test` 因只返回 Group transform 而失败；实现按拓扑顺序
    计算父级目标 world matrix 后转 Green。
- [x] 2.4 Refactor/Regression：新包纯逻辑测试、typecheck、build 通过

## 3. Headless Interaction Controller

- [x] 3.1 Red：连接边界、phase、snapshot、effect、取消和 context 更新测试失败
  - Red command/result/reason：初始 controller 测试与 SceneIndex 一起运行时 4/18 失败，
    move preview、context 取消和 effect 尚未实现。
- [x] 3.2 Green：实现纯 reducer/session 与 StageInteractionController
- [x] 3.3 Red/Green：实现 move、resize、rotate、pan、marquee、guide 和滚动 session
- [x] 3.4 Refactor/Regression：pointermove 无提交、pointerup 单提交、取消零提交

## 4. 统一 Palette 外部拖入

- [x] 4.1 Red：Component/Frame descriptor、Frame 命中、键盘新增和取消测试失败
  - Red command/result/reason：切换为必填 `interactionController` 后原 Palette 用例 7/7
    因旧 `dragController` 协议失败；descriptor 与 external effect 尚未接入。
- [x] 4.2 Green：external begin/move/end/add 进入同一 controller
- [x] 4.3 Refactor/Regression：factory 异常、Frame 外 rejection 和实例隔离保持

## 5. React Stage、Palette 与 Editor 适配

- [x] 5.1 Red：Stage DOM adapter、rAF flush、pointer capture 与 snapshot 渲染测试失败
  - Red command/result/reason：Chromium 合成 Pointer 回归因 `setPointerCapture` 抛错后没有保存
    活动 pointer ID 而缺失 snap preview；先记录 ID、再尝试 capture 后转 Green，并增加组件回归测试。
- [x] 5.2 Green：Stage 改为 engine surface adapter 并拆分 Scene/Overlay/Ruler/Scrollbar
- [x] 5.3 Red/Green：Palette 与 Editor 共享 interactionController，SceneTree 使用 engine 命令
- [x] 5.4 Refactor/Regression：删除旧导出、StageDragController 和 dragController 字段

## 6. 文档、发布与门禁

- [x] 6.1 更新 README、AGENTS、project、包文档、安装示例、pack 顺序和 major changeset
- [x] 6.2 Playwright 回归全部 Stage/Palette/SceneTree 纵向行为且黄金图不变
- [x] 6.3 运行 strict validate、lint、typecheck、test、build、pack dry-run、test:e2e、diff check

## 7. 高速 Pointer 与 Resize 稳定性

- [x] 7.1 Red：使用异步可控 rAF 覆盖 pointerup 最终点、迟到 callback、连续 generation、
  capture 失败、冒泡/迟到 lost capture 与真实取消
  - Red command/result/reason：`bun run --cwd packages/stage-engine test` 新增用例 2/14 失败，
    surface 重测把 phase 变为 idle，且 idle/release 早于 command；`bun run --cwd packages/stage test`
    新增用例 2/37 失败，capture 失败后的 window up 和迟到 lost capture 均未提交。
- [x] 7.2 Green：Stage adapter 分离活动 Pointer session 与 capture 所有权，并统一 window 路由
- [x] 7.3 Green：surface 重测不中断变换；Engine 先冻结并提交最终 command，再清理 preview
  与释放 capture
- [x] 7.4 Refactor/Regression：Playwright 使用 `steps: 1` 压测 move、Frame resize 与多选变换，
  每次 mouseup 后验证正式几何和单事务
  - Regression command/result：`bun run test:e2e -- --grep "高速 move 与 resize"` 在 Chromium
    通过；20 轮 Component move、20 轮 Frame resize 与 6 轮多选 move 每次均检查正式几何和
    History 只增加一个条目。
- [x] 7.5 重新运行 strict validate、lint、typecheck、test、build、pack dry-run、test:e2e 和
  diff check
  - Gate result：OpenSpec strict validate、lint、串行 typecheck、test、build、pack dry-run 与
    Chromium E2E 9/9 通过，现有黄金图未更新；首次并行运行 typecheck/test 曾因两个 Turbo 图
    同时写 materials `dist` 触发 ENOENT，串行重跑后通过。
