## 1. core 动画清单

- [x] 1.1 在 `packages/core/src/document-types.ts` 定义 `ComposeAnimation`
  （`id` / `name` / `durationMs` / `playbackMode` / 可选 `bindings`）、
  `ComposeAnimationPlaybackMode` 与 `ComposeAnimationBindings`
  （`playing?` / `currentTime?`，值为既有的 `ComposePageExportReference`），
  给 `ComposeDocument` 增加 `animations?: readonly ComposeAnimation[]`。
  `ComposeAnimation` 因含可选字段必须用 `JsonObject & { ... }` 交叉写法——索引签名不接受
  `undefined`，`ComposeAppearance`（`document-types.ts:226`）是同样的处理。
- [x] 1.2 把 `animation.invalid` / `animation.duplicate-id` / `animation.invalid-duration` /
  `animation.invalid-binding` 加进 `DocumentValidationIssueCode`。
- [x] 1.3 Red：清单缺省通过、非数组报 `animation.invalid`、ID 重复、时长非法、
  绑定缺省通过、绑定引用形状非法的 `document.test.ts` 用例。
- [x] 1.4 Green：在 `validateComposeDocument` 中实现清单与绑定校验分支。
- [x] 1.5 新增并导出 `getComposeAnimations(document)` 与 `findComposeAnimation(document, id)`。

## 2. 新建 `@compose-ui/animation` 包

- [x] 2.1 按 `packages/layout-engine` 的形状创建包基建：`package.json`（仅依赖
  `@compose-ui/core`）、`tsconfig.json`、`vite.config.ts`、`vitest.config.ts`、`README.md`。
- [x] 2.2 定义 `Animation` Component 协议：Component key 常量、
  `ComposeAnimationComponent`（动画 ID → 轨道数组）、`ComposeAnimationTrack`
  （`path` / `valueKind` / `keyframes`，无 `entityId`、无独立 `id`）、
  `ComposeKeyframe`、`ComposeKeyframeInterpolation`、`ComposeSpatialTangent`，全部带 TSDoc。
  可选字段用 `JsonObject & { ... }` 交叉写法——索引签名不接受 `undefined`，
  `ComposeAppearance` 是同样的处理。
- [x] 2.3 读取入口：`getComposeAnimationComponent(entity)`、
  `getComposeEntityTracks(entity, animationId)`、`findComposeAnimationTrack(entity, animationId, path)`、
  `listComposeAnimationEntities(document, animationId)`。

## 3. 值语义与插值

- [x] 3.1 Red：值形状判定（`number` / `vector2` / `color`）与三种类型的混合用例，
  含颜色 alpha 与 `transparent` 端点不穿过黑色。
- [x] 3.2 Green：实现 `isComposeAnimationValue` 与 `mixComposeAnimationValue`
  （颜色复用 core 的 `normalizeComposeColor` 做规范化）。

## 4. 校验

- [x] 4.1 Red：路径为空、同分组路径重复、关键帧越界、重复时间、乱序、值形状不符、
  插值与切线形状非法、悬空动画分组的用例。
- [x] 4.2 Green：实现 `collectComposeAnimationIssues(document)` 与单 Entity 级校验，
  定义包自己的稳定问题码类型。
- [x] 4.3 在包 README 与 TSDoc 中写明：core 不认识 `Animation` Component，
  加载期强制校验需要宿主主动调用本入口。

## 5. 采样器

- [x] 5.1 Red：`hold` / `linear` / `cubic` 三种插值的段内与边界值、端点钳制、
  颜色与 vector2 插值。
- [x] 5.2 Green：实现 `sampleComposeAnimationTrack`。cubic 用牛顿迭代解 t（上限 8 次）
  并在导数过小时退化为二分。
- [x] 5.3 Red："未被动画命中的 Entity 保持引用相等"、"失效路径与坏数据被静默跳过"。
- [x] 5.4 Green：实现 `applyComposeAnimationAtTime(document, animationId, timeMs)`，
  只重建被触及的 Entity。

## 6. 运动路径几何

- [x] 6.1 Red：corner 段是直线、smooth 段偏离连线且方向与切线一致、
  cubic 缓动下等时采样点两端密中间疏。
- [x] 6.2 Green：实现 `sampleComposeMotionPath`，输出顶点、切线端点、弧长折线与等时采样点。

## 7. 命令

- [x] 7.1 Red：首次打点建 Component 与轨道、同时间替换值、撤销恢复（含 Component 消失）、
  移动到已占用时间被拒、删除动画清理所有 Entity 分组且不留空壳。
- [x] 7.2 Green：实现 handler 并导出可注入 `TransactionRuntimeOptions.handlers` 的集合：
  `animation.create` / `animation.delete` / `animation.configure` /
  `animation.keyframe.set` / `animation.keyframe.remove` / `animation.keyframe.move` /
  `animation.keyframe.interpolation.set` / `animation.keyframe.spatial.set` /
  `animation.track.remove`。
- [x] 7.3 Red/Green：验证复制粘贴与删除 Entity 时动画随之流动——用既有
  `entity.duplicate` / `entity.delete` 命令断言，不新增补偿逻辑。

## 8. 导出与文档同步

- [x] 8.1 `packages/animation/src/index.ts` 导出全部公共类型与函数，
  写 `@packageDocumentation` 说明包用途与架构边界。
- [x] 8.2 `AGENTS.md` 架构边界新增 `@compose-ui/animation` 条目，并在
  "React 组件架构与依赖方向"的 Headless Domain 层列表中加入该包。
- [x] 8.3 `README.md` 包清单与完成度说明同步。
- [x] 8.4 `openspec/project.md` 同步。

## 9. 验证

- [x] 9.1 `bun run --filter @compose-ui/animation test` / `typecheck` / `lint` / `build`。
- [x] 9.2 `bun run --filter @compose-ui/core test` / `typecheck`。
- [x] 9.3 仓库根 `typecheck` / `build` 全绿。`lint` 与 `test` 各有既有失败，与本变更无关：
  `compose-editor.tsx:1153` 的 `react-hooks/refs`（与 HEAD 一致），以及
  `page-workspace.test.tsx` 的 2 个只读页面 JSON 标签用例（stash 掉本变更后同样失败）。
- [x] 9.4 `openspec validate add-scene-animation-model --strict`。
