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

## 5. 衔接层 Review 修复（数据流精化）

- [x] 5.1 core：createComposeBatchCommand 构造器与 targetIds 措辞
  - Red: `builtin-commands.test.ts` 新增 batch 构造器测试，因导出缺失失败。
  - Green: 实现构造器并从公共入口导出；12/12 通过。
- [x] 5.2 component-registry：listCapabilityAvailability 携带移除可行性
  - Red: `registry.test.ts` 断言已附加项 disabled/issue，旧实现恒为 disabled: false。
  - Green: 抽取 removalBlocker 与 planRemoveCapability 共用；5/5 通过。
- [x] 5.3 component-registry：错误边界 resetSignal 数据修复后恢复
  - Red: `compose-registry-renderers.test.tsx` 修复 props 后仍显示失败占位。
  - Green: identity 或输入数据引用变化时清除失败状态；3/3 通过。
- [x] 5.4 component-registry：composeEntityVisualStyle / composeEntitySceneStyle 共享样式
  - Red: `entity-scene-style.test.ts` 模块不存在。
  - Green: 实现并导出；stage/preview 切换为共享实现，各自测试通过。
- [x] 5.5 materials：内建 Component inspectors 迁入 + Text props 合并
  - Red: `component-inspectors.test.tsx` 6 项失败（工厂缺失、Text 整体替换 props）。
  - Green: createComposeBuiltinComponentDefinitions 携带 inspectors，Text 合并当前 props；
    11/11 通过。
- [x] 5.6 core：resolveComposeAppearance 收窄为仅接受 Entity（移除鸭子类型联合）
- [x] 5.7 editor：通用 Registry inspector 循环、availability 驱动移除按钮、
  EntityInspector 按 entity.id 重挂载、containerPresetId 选项与缺失警告
  - Red→Green: `controller.test.tsx` 迁移为聚合契约测试并新增 2 项；65/65 通过。
  - 内建 inspector 行为测试随实现迁至 materials。
- [x] 5.8 全量验证 lint、typecheck、test、build、test:e2e

## 6. Editor controller 分派表重构

- [x] 6.1 补 delete、move、duplicate 场景树操作的特征测试作为重构安全网
  - Baseline: 6 项场景树测试在重构前对现有实现全部通过。
  - 过程发现：测试内联 `idFactory: ids()` 会在每次重渲染重置计数器，导致后续
    操作复用已存在 Entity ID 被运行时拒绝；已改为跨渲染稳定的 factory 并加注释。
- [x] 6.2 抽出 `scene-operations.ts`：7 个纯函数规划器 + 判别键分派表
  - `planSceneOperation` 返回 planned / skipped / unavailable 判别结果，
    命令规划与 React 副作用（dispatch、console.warn）分离。
  - 分派表以 `ComposeSceneTreeOperation['type']` 为映射键，新增操作类型缺少
    规划器时直接编译报错。
- [x] 6.3 controller 接入分派表并把 inspectorPanel 三元提出返回对象
  - `onSceneOperation` 从 140 行 7 分支 if/else 降到 16 行；controller.tsx 727 → 579 行。
- [x] 6.4 为纯函数规划器补充 8 项单元测试（无 React，覆盖分派完整性、
  Preset 缺失、根级/嵌套创建、reparent 与重排序、跳过与 batch 合并、标签与来源）
- [x] 6.5 全量验证 lint、typecheck、test、build、test:e2e

## 7. Editor 包 Feature-first 目录分层

- [x] 7.1 按用户能力建立功能目录，各自用 `index.ts` 控制导出
  - `compose-editor/`（Shell）、`editor-controller/`（受控会话）、
    `workspace-layout/`（面板拓扑与标签页）、`inspector/`（属性检查）、
    `stage-toolbar/`（工具栏与画布设置）、`editor-preferences/`（偏好与设置中心）。
- [x] 7.2 拆分语义模糊的 `default-workspace-content.tsx`
  - `DefaultEmptyInspector` → `inspector/empty-inspector.tsx`；
    `DefaultStageToolbar` → `stage-toolbar/default-stage-toolbar.tsx`。
- [x] 7.3 `editor-i18n.ts` 与 `styles.css` 保留在 src 根
  - 前者被全部 5 个功能目录消费，属稳定跨功能职责；后者维持包级样式入口，
    宿主 `@compose-ui/editor/styles.css` 深引用路径不变。
- [x] 7.4 公共入口 `src/index.tsx` 导出面保持不变，无破坏性变更
- [x] 7.5 验证 check:architecture、lint、typecheck、test、build、test:e2e
  - 76/76 editor 测试通过；e2e 15/15 通过（含视觉黄金文件）。
