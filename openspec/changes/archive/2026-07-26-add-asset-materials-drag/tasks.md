## 1. OpenSpec 与协议

- [x] 1.1 建立并 strict validate change，逐 Scenario 建立测试标题映射。
  - Red command: `bunx openspec validate add-asset-materials-drag --strict`
  - Red result: FAIL，change 与 capability 增量尚不存在。
  - Red reason: 新资源协议、资源物料和拖入场景尚未进入正式变更边界。
  - Green command: `bunx openspec validate add-asset-materials-drag --strict`
  - Green result: PASS，change proposal/design/tasks 与八个 capability 增量有效。
  - Regression command: `bunx openspec validate --all --strict`
  - Regression result: PASS，18 个 change/spec 项全部有效；PostHog 离线遥测失败不影响校验退出码。
- [x] 1.2 新增 assets 包并迁移 Provider 类型，asset-browser 保持兼容转导。
  - Red command: `bun run --cwd packages/assets test`
  - Red result: FAIL，测试无法解析尚不存在的 `src/index.ts`。
  - Red reason: 稳定引用、resolver 与 Provider 引用能力尚未实现。
  - Green command: `bun run --cwd packages/assets test`
  - Green result: PASS，3 个稳定引用、Provider 匹配、订阅和 capability 用例通过。
  - Regression command: `bun run --cwd packages/asset-browser test`
  - Regression result: PASS，20 个兼容转导、本地 session 引用和浏览器行为用例通过。

## 2. Registry 与物料

- [x] 2.1 Red → Green：Registry asset seed、Palette hidden 与 resolver 透传。
  - Red command: `bun run --cwd packages/component-registry test`
  - Red result: FAIL，definition 不接受 `paletteHidden`/`assetDrop`，registry 无 `createAssetSeed`。
  - Red reason: Registry 尚无资源创建和 renderer resolver 协议。
  - Green command: `bun run --cwd packages/component-registry test`
  - Green result: PASS，14 个测试覆盖匹配顺序、隐藏 Palette、factory 错误和 resolver 透传。
  - Regression command: `bun run test`
  - Regression result: PASS，全部 workspace 单元与组件测试通过。
- [x] 2.2 Red → Green：Image renderer/Inspector、固有尺寸与 Blob URL 生命周期。
  - Red command: `bun run --cwd packages/materials test`
  - Red result: FAIL，registry 中不存在 Image definition，资源 renderer 与 Inspector 无法创建。
  - Red reason: Image props、固有尺寸和 Blob URL 生命周期尚未实现。
  - Green command: `bun run --cwd packages/materials test`
  - Green result: PASS，Image 渲染、fit、资源更新、缺失占位和 URL 回收用例通过。
  - Regression command: `bun run --cwd packages/materials test`
  - Regression result: PASS，15 个基础物料测试全部通过。
- [x] 2.3 Red → Green：SVG 净化、填充/描边覆盖、Inspector 与资源更新。
  - Red command: `bun run --cwd packages/materials test`
  - Red result: FAIL，SVG definition、净化边界和 paint 覆盖尚不存在。
  - Red reason: 原始 SVG 不能安全进入 renderer。
  - Green command: `bun run --cwd packages/materials test`
  - Green result: PASS，恶意标签/事件/外链剥离、片段渐变与填充/描边覆盖用例通过。
  - Regression command: `bun run lint && bun run --cwd packages/materials test`
  - Regression result: PASS，React 纯度、迟到资源身份和 15 个物料回归均通过。

## 3. 拖入链路

- [x] 3.1 Red → Green：Asset Browser 树/网格普通数据拖拽、批量过滤与内部 move 取消。
  - Red command: `bun run --cwd packages/asset-browser test`
  - Red result: FAIL，AssetBrowser 无 `onCanvasDrag`，树选择也未启用多选拖入。
  - Red reason: 资源浏览器只支持资源内部交互。
  - Green command: `bun run --cwd packages/asset-browser test`
  - Green result: PASS，20 个测试覆盖树/网格拖入、支持格式过滤、多选顺序和内部 move 取消。
  - Regression command: `bun run test`
  - Regression result: PASS，SceneTree 共享 Tree 与 Asset Browser 回归同时通过。
- [x] 3.2 Red → Green：Stage Engine assets phase、命中、取消与实例隔离。
  - Red command: `bun run --cwd packages/stage-engine test`
  - Red result: FAIL，external descriptor 不接受 `assets` 批次。
  - Red reason: Engine 尚不能携带纯数据资源拖入会话。
  - Green command: `bun run --cwd packages/stage-engine test`
  - Green result: PASS，39 个测试覆盖资源 Frame/Canvas 命中、取消和既有交互隔离。
  - Regression command: `bun run --cwd packages/stage-engine typecheck`
  - Regression result: PASS，包继续保持无 React/DOM UI 依赖边界。
- [x] 3.3 Red → Green：Stage 异步解析、批量布局、部分失败和原子事务。
  - Red command: `bun run --cwd packages/stage test`
  - Red result: FAIL，Stage 无 resolver、异步资源 effect 或批量创建事务。
  - Red reason: Engine drop effect 尚未映射为资源节点。
  - Green command: `bun run --cwd packages/stage test`
  - Green result: PASS，65 个测试覆盖尺寸、布局、部分失败、目标失效、resolver 更换取消和唯一事务。
  - Regression command: `bun run test`
  - Regression result: PASS，Stage 既有 move/resize/guide/scroll 交互全部通过。
- [x] 3.4 Red → Green：Editor 自动 bridge/resolver 与 Preview 渲染。
  - Red command: `bun run --cwd packages/editor test && bun run --cwd packages/preview test`
  - Red result: FAIL，Editor/Preview props 不接受 resolver，默认 Assets 生命周期未连接 controller。
  - Red reason: 资源运行时尚未贯通组合入口。
  - Green command: `bun run --cwd packages/editor test && bun run --cwd packages/preview test`
  - Green result: PASS，Editor 64 个、Preview 11 个测试通过。
  - Regression command: `bun run typecheck`
  - Regression result: PASS，17 个 workspace 包共 33 个 typecheck/build 任务通过。

## 4. 集成与质量

- [x] 4.1 更新示例、文档、依赖边界、pack 顺序、concurrency 与 changeset。
  - TDD exemption: README、AGENTS、架构说明、changeset 与纯构建配置不改变运行行为。
  - Green command: `bun run build && bun run pack:dry-run`
  - Green result: PASS，17 包构建成功，assets 按依赖顺序进入全部 16 个发布包 dry-run。
  - Regression command: `git diff --check`
  - Regression result: PASS，无空白错误。
- [x] 4.2 Playwright 覆盖图片/SVG/批量拖入、撤销重做、改色和资源更新，生成黄金图。
  - Red command: `bunx playwright test e2e/integration.spec.ts -g "批量拖入 Image 与 SVG"`
  - Red result: FAIL，资源树未保留多选且 Stage 中不存在 Image 节点。
  - Red reason: Tree 多选与资源批次桥接尚未形成完整用户流程。
  - Green command: `bunx playwright test e2e/integration.spec.ts -g "批量拖入 Image 与 SVG" --update-snapshots=all`
  - Green result: PASS，生成 Image/SVG 批量拖入和 SVG Inspector 黄金图并人工核对。
  - Regression command: `bun run test:e2e`
  - Regression result: PASS，13 个 Chromium E2E 与全部黄金图比较通过。
- [x] 4.3 运行 OpenSpec strict、lint、typecheck、test、build、pack、E2E 与 diff check。
  - Green command: `bunx openspec validate --all --strict && bun run lint && bun run typecheck && bun run test`
  - Green result: PASS，18 个规范项、lint、33 个类型任务和 32 个测试任务通过。
  - Regression command: `bun run build && bun run pack:dry-run && bun run test:e2e && git diff --check`
  - Regression result: PASS，17 包构建、全部发布包 dry-run、13 个 Chromium E2E 和 diff check 通过。
