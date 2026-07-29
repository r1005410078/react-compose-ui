## 1. OpenSpec 与 Core v4

- [x] 1.1 建立 v4 Entity/Component 类型、访问器、严格校验和 Red 测试
  - Red command: `bun run test --filter=@compose-ui/core`
  - Red result: 3 个 v4 ECS Scenario 失败，现有校验器拒绝 schemaVersion 4 与 entities。
  - Red reason: ComposeDocument v4 Entity/Component 行为尚未实现，现有 v3 测试仍通过。
- [x] 1.2 将 Patch、命令与 TransactionRuntime 切换到 entities 路径
- [x] 1.3 覆盖 Composition 保护、TransformConstraints 和未知 Component
  - Green command: `bun run test --filter=@compose-ui/core`
  - Green result: 5 个测试文件、29 个测试全部通过。
  - Regression command: `bun run typecheck --filter=@compose-ui/core`
  - Regression result: Core v4 公共类型与实现通过 TypeScript 检查。

## 2. Registry 与 Materials

- [x] 2.1 建立 ComposeEntityRegistry 四类定义和校验
  - Red command: `bun run test --filter=@compose-ui/component-registry`
  - Red result: 4 个 Registry/Capability Scenario 在旧单体 Component Registry 上失败。
  - Red reason: 尚无 Entity Preset、Component Definition 或 Capability 规划协议。
- [x] 2.2 实现 Capability 依赖、冲突、添加与移除规划
  - Green command: `bun run test --filter=@compose-ui/component-registry`
  - Green result: 2 个测试文件、6 个测试全部通过。
- [x] 2.3 将 Container、Rectangle、Text、Image、SVG 改为 Entity Presets
  - Green command: `bun run test --filter=@compose-ui/materials`
  - Green result: 1 个测试文件、5 个测试全部通过，覆盖五种 Preset、Renderer 与内建能力。

## 3. Stage、Preview 与 Editor

- [x] 3.1 将 Stage Engine 几何、索引、命令与交互迁移为 ECS 查询
  - Red command: `bun run test --filter=@compose-ui/stage-engine`
  - Red result: ECS scene index、约束手柄和 Entity transform 命令在旧 Node 查询上失败。
  - Green result: 5 个测试文件、16 个测试全部通过。
- [x] 3.2 将 Stage 与 Preview 改为 Renderer/Hierarchy 组合渲染
  - Green commands: `bun run test --filter=@compose-ui/stage`、`bun run test --filter=@compose-ui/preview`
  - Green result: Stage 3 个文件/15 个测试、Preview 1 个文件/8 个测试全部通过。
- [x] 3.3 实现聚合 Inspector、能力菜单和确认移除
  - Red result: Editor Controller 测试先暴露外部 Transform 更新后 Inspector 草稿不同步。
  - Green result: 补充同步回归测试后，Editor 4 个文件、61 个测试全部通过。
- [x] 3.3.1 将聚合 Inspector 收敛为单 Property Panel、多 Component Sections
  - Red command: `bun run test --filter=@compose-ui/property-panel --filter=@compose-ui/editor`
  - Red result: Property Panel 的 2 个 Root/Section Scenario 因公共 API 尚未导出而失败，
    Editor worker 因上游测试失败提前退出。
  - Green result: Property Panel 67 个测试、Editor 63 个测试全部通过；覆盖唯一工具栏、共享列宽、
    跨 Section 搜索、折叠恢复、独立提交、Container 合并、能力增删、锁定与未知 Registry 降级。
- [x] 3.4 迁移 Scene Tree adapter、Editor、Command Panel、app 与 Storybook
  - Regression command: `bun run test`
  - Regression result: 33 个 Turbo tasks 全部通过；Storybook 17 个文件、39 个浏览器测试全部通过。

## 4. 验证与文档

- [x] 4.1 完成受影响包单元与组件测试并记录 Red/Green/Regression 证据
  - Regression result: Core 29、Registry 6、Stage Engine 16、Stage 15、Materials 5、
    Preview 8、Property Panel 67、Editor 63 个测试全部通过。
- [x] 4.2 更新 Editor Playwright 流程和深色中文黄金图
  - Update command: `bun run test:e2e:update`
  - Review result: 人工审阅 SVG 与根组件 Inspector 黄金图；确认单一工具栏、Component 分组、
    对齐和紧凑间距正确。
  - Scenario result: ECS 聚合 Inspector 覆盖跨 Component 搜索、折叠状态恢复、添加几何限制、
    Container 合并、滚动及工具栏吸顶。
  - Regression command: `bun run test:e2e`
  - Regression result: 15 个真实 Chromium 纵向流程全部通过。
- [x] 4.3 更新 README、AGENTS.md 与 openspec/project.md
- [x] 4.4 运行 OpenSpec strict、lint、typecheck、test、build、test:e2e 和 git diff --check
  - `openspec validate replace-nodes-with-ecs-entities --strict`: 通过。
  - `bun run lint`: 通过。
  - `bun run typecheck`: 34/34 tasks 通过。
  - `bun run test`: 33/33 tasks 通过。
  - `bun run build`: 18/18 tasks 通过。
  - `bun run test:e2e`: 15/15 tests 通过。
  - `git diff --check`: 通过。
