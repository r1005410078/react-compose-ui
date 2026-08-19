# 任务

## 1. core：升格纯函数与场景默认外观

- [x] 1.1 `packages/core/src/frame.ts` 新增 `promoteComposeEntityToFrame(entity, size)`：
      缺 `Hierarchy` 就补、`Composition.baseComponentKeys` 补 `Hierarchy`/`Frame`、写入
      `Frame`；其余 Component 原地保留。
- [x] 1.2 新增导出 `COMPOSE_DEFAULT_SCENE_APPEARANCE`（与 Container Preset 默认外观等值）。
- [x] 1.3 `createComposeFrameEntity` 新增 `appearance` 选项，默认改为场景默认外观。
- [x] 1.4 非场景调用方显式传透明：`packages/component-registry/src/registry/registry.ts`
      的 `probeFrame`（Preset 校验探针）。核对 `component-file.ts`、`animation-file.ts` 与
      `migration.ts` 各自内联构造 Frame，不经过该工厂，因此不受默认值变化影响。
      页面默认文档的根场景改用场景默认外观。
- [x] 1.5 单测：升格保留 id/名称/子级/Appearance/Clip 且 `baseComponentKeys` 含 `Frame`；
      对已经是 Frame 的实体升格是幂等的。

## 2. stage-engine：落点解析与去重

- [x] 2.1 `component-extraction.ts` 的内联升格改调 `promoteComposeEntityToFrame`，
      用既有 `component-extraction.test.ts` 做行为不变的回归。
- [x] 2.2 新增 `clampBoundsIntoFrame(bounds, frameSize)` 纯函数 + 单测（完全在外、部分
      重叠、实体大于场景）。
- [x] 2.3 新增 `isComposeContainerEntity(entity)`：有 `Hierarchy` 且不是 Group。

## 3. materials：`frame` Preset

- [x] 3.1 新增 `packages/materials/src/frame/preset.tsx`：id `frame`、label「场景」、
      图标复用 `ComposeContainerMaterialIcon`、`paletteHidden: true`、
      `createComponents` 与 Container 相同再加 `Frame`。
- [x] 3.2 挂进 `DEFAULT_COMPOSE_BASIC_PRESETS` 与 `createComposeBasicMaterials`。
- [x] 3.3 单测：`frame` 与 `container` 的默认 `Appearance` 深相等（防 core/materials 漂移）；
      物料面板列表不因新 Preset 变化。

## 4. stage：落点回退改写与删除描边

- [x] 4.1 三处 `parentId: parent?.id ?? rootIds[0] ?? null`（资源拖放、绘制提交、物料拖放）
      抽成共用落点解析：容器类升格建场景（`parentId: null`、世界坐标、名称 `场景 N`）；
      非容器落进 `resolveTargetFrameId(document, [], activeFrameId)` 并钳制。
- [x] 4.2 解开世界→局部换算与 `parent` 是否存在的耦合——这是坐标缺陷的修复点。
- [x] 4.3 粘贴给 `resolveSuggestedEntityInsertion` 传 `fallbackFrameId = activeFrameId`
      （两处：执行与 `canPaste` 计算）。
- [x] 4.4 删除 `.compose-stage__output-decoration` 的四条 `<line>` 与 `styles.css` 里
      `.compose-stage__output-edge` / `.is-selected` 规则；保留边界 `<rect>`。
- [x] 4.5 给 `.compose-stage__label-row.is-scene` 补上 CSS 规则，让场景标题在视觉上成为
      「头部」；这个类此前没有任何规则。

## 5. editor：场景树落点与图标

- [x] 5.1 `controller.tsx` 的 `iconLabel` 补 `presetId === 'frame'`。
- [x] 5.2 `scene-operations.ts` 的 `planCreate` 与 `resolveDropParentId` 按同一规则分流；
      `SceneOperationContext` 增加 `activeFrameId`，由 controller 传入。
- [x] 5.3 `planMove` 不改：已存在实体拖到树根仍落进当前解析出的场景。

## 6. 验证

- [x] 6.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [x] 6.2 `e2e/editor-workspace.spec.ts` 去掉 `stage-frame-edge-*` 的 stroke/opacity 断言。
- [x] 6.3 新增 `e2e/scene-parity.spec.ts`：空白处画容器得到并排的第二块场景且不自动激活；
      空白处画矩形落进激活场景且完整可见；切换激活后再画落进新的激活场景；
      场景树里场景行图标与容器行相同。
- [x] 6.4 `bun run test:e2e`，重出受影响的黄金图并逐张目视确认只有场景底色/边框变化。
- [x] 6.5 `openspec archive update-scene-container-parity --yes` 后
      `openspec validate --all --strict`。

## 7. 实施中发现的、与计划不同的裁定

- **场景不带默认边框。** 计划里写的是「外观与 Container 逐字段相同」。实做后 4 条 e2e 吸附
  断言直接变红：布局求解把 `borderWidth` 计入内容盒（`layout-runtime.ts` 的 `node.setBorder`），
  而场景是绝对坐标原点，1px 边框让每个直接子级的属性面板坐标读成 7、15、23 而不是 8、16、24。
  最终裁定：背景与容器一致，`borderWidth` 为 0，理由写在常量的 TSDoc 里。
- **点击添加不走升格。** 物料面板的「添加 X」按钮没有落点意图，`externalDrop` 在无选区时
  `parentId` 为 null，会被落点解析当成「在所有场景之外新建」而升格出一块场景。修正为无选区时
  按视口中心 `containerAtPoint` 兜底（`interaction-controller.ts`）。
- **`??` 串联吞掉了 `parentId: null`。** 升格分支的 `parentId` 就是 null，`?? rootIds[0]` 会继续
  下落，新场景被塞回第一块场景里变成嵌套 Frame。三处落点改成显式条件。
- **`openPageInspector` 不得缩放视图。** 空白区不足时缩小视图只属于「要在空白处绘制」的用例；
  `openPageInspector` 被夹在测量前后的用例里调用，缩放会让那些几何断言凭空偏移。
