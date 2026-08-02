## 1. OpenSpec 与测试契约

- [x] 1.1 严格校验 compose-document 与 basic-materials 增量规范并获得实现批准。
- [x] 1.2 为 Layout JSON、默认值、组合约束与旧文档兼容建立 Core Red 测试。
  - Red command/result: `bun run --cwd packages/core test -- src/document.test.ts src/layout.test.ts`
    → 2 个目标场景失败、其余 12 个测试通过。
  - Red reason: 当前 Core 把非法 `Layout` 当未知 Component 接受，且未发布
    `createDefaultComposeFlexLayout` 与 `isValidComposeLayout`。
- [x] 1.3 为 Container/能力默认数据、Inspector 提交、只读、键盘与预览建立 Materials Red 测试。
  - Red command/result:
    `bun run --cwd packages/materials test -- src/create-basic-materials.test.tsx src/material-inspector-kit/component-inspectors.test.tsx`
    → 5 个目标场景失败、其余 8 个测试通过。
  - Red reason: Container 与“容器”能力尚未创建 `Layout`，Registry 尚未注册 Layout Inspector。
- [x] 1.4 为实际 Inspector 密度、换行和 Stage 不生效建立 Playwright 场景与黄金图。
  - Green command/result:
    `bun run test:e2e -- --grep "Flex Layout 紧凑属性与仅 Inspector 生效" --update-snapshots`
    → 1 个目标场景通过，并生成
    `e2e/__screenshots__/flex-layout-inspector.png`。

## 2. Layout 文档类型

- [x] 2.1 在 Core 发布 `Layout` Key、Flex JSON 类型、独立默认值工厂、读取/校验 API。
- [x] 2.2 严格校验枚举、有限非负 gap 和 Layout→Hierarchy 组合，同时保持无 Layout 的 v5 文档有效。
- [x] 2.3 使 Core Red 测试转绿并回归文档、命令和 Patch 测试。
  - Green command/result: `bun run --cwd packages/core test -- src/document.test.ts src/layout.test.ts`
    → 2 个目标测试文件、14 个测试全部通过。
  - Regression command/result: `bun run --cwd packages/core test`
    → 10 个测试文件、66 个测试全部通过；`bun run --cwd packages/core typecheck` 通过。

## 3. Materials 布局 Inspector

- [x] 3.1 注册 Layout Component Definition，并让 Container Preset 与“容器”能力创建默认 Layout。
- [x] 3.2 实现 feature-first 的 Flex 图标 editor、窄列 3×2 响应布局、单语 I18n、ARIA radiogroup
  与无单位 gap 数字输入。
- [x] 3.3 实现三节点全宽 Inspector 预览，并通过 `entity.component.update` 原子持久化合法候选。
- [x] 3.4 使 Materials Red 测试转绿，确认锁定、无效草稿、外部受控更新和事务语义。
  - Green command/result:
    `bun run --cwd packages/materials test -- src/create-basic-materials.test.tsx src/material-inspector-kit/component-inspectors.test.tsx`
    → 2 个目标测试文件、13 个测试全部通过。
  - Regression command/result: `bun run --cwd packages/materials test`
    → 7 个测试文件、33 个测试全部通过；Materials 的 `lint/typecheck/build` 通过。

## 4. 非渲染边界与验证

- [x] 4.1 添加 Stage/Preview 回归断言，确认 Layout 更新不会改变场景子项排版。
  - Regression command/result:
    `bun run --cwd packages/stage test -- src/stage-surface/compose-stage.test.tsx`
    → 11 个测试通过；
    `bun run --cwd packages/preview test -- src/compose-preview/compose-preview.test.tsx`
    → 10 个测试通过。
- [x] 4.2 更新 Core/Materials README 与公开 TSDoc，记录本阶段仅有 Authoring 面板预览。
- [x] 4.3 运行 `openspec validate add-flex-layout-inspector --strict`、相关包测试、仓库
  `lint/typecheck/test/build/test:e2e` 与 `git diff --check`，在任务下记录 Red/Green/Regression 证据。
  - Repository regression:
    `bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`
    全部通过；`bun run test:e2e` → 26 个浏览器场景全部通过。
  - Spec/patch validation:
    `openspec validate add-flex-layout-inspector --strict` 与 `git diff --check` 全部通过。

## 5. 设计稿重写

- [x] 5.1 更新 Property Panel、Component Registry 与 Materials 增量规范，为标题栏 actions、
  三列卡片、整体重置和实时预览建立 Red 测试。
  - Red command/result:
    `bun run --cwd packages/property-panel test -- src/property-panel/compose-property-panel.test.tsx`
    → 新增标题栏 actions 场景失败、其余 52 个测试通过；
    `bun run --cwd packages/component-registry test -- src/registry-renderers/compose-registry-renderers.test.tsx`
    → 新增 Registry actions 适配场景失败、其余 6 个测试通过；
    `bun run --cwd packages/materials test -- src/material-inspector-kit/component-inspectors.test.tsx`
    → 三列结构、视觉顺序和整体重置 3 个目标场景失败、其余 7 个测试通过。
  - Red reason: Section 尚未呈现 actions，Registry 尚未发布标题栏适配器，Layout 仍使用旧的
    左右属性行、旧图标顺序和旧预览。
- [x] 5.2 为 `ComposePropertyPanelSection` 和 `ComposeComponentDefinition` 实现可选标题栏 actions，
  并由 Editor 通过 Registry 适配器组合。
  - Green command/result:
    `bun run --cwd packages/property-panel test -- src/property-panel/compose-property-panel.test.tsx`
    → 53 个测试全部通过；
    `bun run --cwd packages/component-registry test -- src/registry-renderers/compose-registry-renderers.test.tsx`
    → 7 个测试全部通过。
  - Regression command/result: Property Panel、Component Registry 与 Editor 的 `typecheck` 全部通过。
- [x] 5.3 使用 Schema 字段与自定义 renderer 重写两行三列 Flex 属性区，保留搜索、键盘、只读、
  无效草稿和原子提交语义。
- [x] 5.4 实现 `display: flex` 状态、整体重置和带摘要的三节点实时预览，使新增 Red 测试转绿。
  - Green command/result:
    `bun run --cwd packages/materials test -- src/material-inspector-kit/component-inspectors.test.tsx`
    → 10 个测试全部通过；`bun run --cwd packages/materials typecheck` 通过。
  - Regression command/result:
    `bun run --cwd packages/editor test -- src/editor-controller/controller.test.tsx`
    → 20 个测试全部通过。
- [x] 5.5 更新 Playwright 场景与黄金图，确认实际面板宽度下的分组顺序、卡片布局和非渲染边界。
  - Green command/result:
    `bun run test:e2e:update -- --grep "Flex Layout 紧凑属性与仅 Inspector 生效"`
    → 1 个目标浏览器场景通过并更新 `e2e/__screenshots__/flex-layout-inspector.png`。
  - Visual review: 设计稿三列卡片、5/6 项换行、标题栏状态、双层标签和实时预览均符合预期。
- [x] 5.6 运行严格 OpenSpec 校验、相关包测试及仓库 `lint/typecheck/test/build/test:e2e`，
  并记录 Green/Regression 证据。
  - Repository regression:
    `bun run lint`、`bun run typecheck`、`bun run test` 全部通过；
    `bun run test:e2e` 先完成 19/19 包构建，再通过 26/26 个浏览器场景。
  - Flex regression:
    Materials 5 个测试文件、35 个测试全部通过；新增受控同步断言确认提交 `gap` 后整体重置
    会立即采用外部默认值；目标 Playwright 场景通过并与黄金图一致。
  - Spec/patch validation:
    `openspec validate add-flex-layout-inspector --strict` 与 `git diff --check` 全部通过。

## 6. 浏览器图标优化

- [x] 6.1 对照 Chromium DevTools 当前 Flex 编辑器的 20×20 图标、选项顺序与轴向旋转规则。
- [x] 6.2 重画方向、换行、多行、主轴和交叉轴图标，统一显示尺寸并让相关图标跟随
  `flex-direction`；保留额外的 `wrap-reverse` 镜像图标。
- [x] 6.3 压缩按钮高度、选项间距和卡片纵向留白，更新选项顺序单测及浏览器黄金图。
  - Green command/result: Materials `lint/typecheck/test` 全部通过，5 个测试文件、35 个测试通过。
  - Browser command/result:
    `bun run test:e2e:update -- --grep "Flex Layout 紧凑属性与仅 Inspector 生效"`
    → 19/19 包构建与 1 个目标场景通过，黄金图已人工检查。
- [x] 6.4 运行严格 OpenSpec、差异检查及完整仓库回归。
  - Repository regression: `bun run lint`、`bun run typecheck`、`bun run test` 全部通过；
    `bun run test:e2e` 完成 19/19 包构建并通过 26/26 个浏览器场景。
  - Spec/patch validation: `openspec validate add-flex-layout-inspector --strict` 与
    `git diff --check` 全部通过。
- [x] 6.5 仅在明确选择“拉伸”时让预览节点使用自动交叉尺寸，使默认 `normal` 保持紧凑；分别验证
  横向布局的 Y 坐标/高度和纵向布局的 X 坐标/宽度会随交叉轴选项改变，并更新黄金图。
- [x] 6.6 支持再次点击多行、主轴或交叉轴的当前选项回到 `normal`，恢复无图标选中状态。
