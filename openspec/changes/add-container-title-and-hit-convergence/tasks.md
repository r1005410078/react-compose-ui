## 1. 图标与快捷键

- [x] 1.1 `stage-toolbar-icons.tsx` 的 `container` glyph 改为井号字形
- [x] 1.2 `material-icons.tsx` 的 `ComposeContainerMaterialIcon` 同步井号字形
- [x] 1.3 `preferences.ts`：`stage.drawContainerTool` → `KeyF`，`stage.fitSelection` → `Shift+Digit2`
- [x] 1.4 `compose-stage.tsx` 的 `DEFAULT_STAGE_SHORTCUTS` 同步
- [x] 1.5 单测：默认偏好无冲突、F 切容器工具、Shift+2 缩放到选中

## 2. 命中收敛（stage-engine）

- [x] 2.1 `StageInteractionHit` entity 分支增加 `source?: 'body' | 'label'` 与 TSDoc
- [x] 2.2 抽出纯判定并在 entity 分支前收敛到 `startMarquee()`
- [x] 2.3 单测：非空容器体起框、空容器点体选中、已选容器拖体移动、label 来源始终选中、
      marquee/绘制工具与 Shift 加选不受影响

## 3. 容器标题标签（stage）

- [x] 3.1 新增 `packages/stage/src/container-label-layer/`：纯模型 `container-labels.ts`
      （顶层容器筛选、屏幕坐标、maxWidth、低缩放阈值）
- [x] 3.2 `container-label-layer.tsx`：绝对定位恒定字号标签、选中态、pointerdown 交回
      `{ kind: 'entity', source: 'label' }`
- [x] 3.3 双击就地重命名：Enter/失焦提交、Escape 取消、无回调时只读
- [x] 3.4 `ComposeStage` 新增受控 prop `onEntityRename`，挂载在 SceneLayer 之后、Overlay 之前
- [x] 3.5 Stage i18n 补标签相关文案
- [x] 3.6 单测：`container-labels.test.ts` 与 `container-label-layer.test.tsx`

## 4. Editor 接线与默认尺寸

- [x] 4.1 Editor 把 `onEntityRename` 接到既有场景树 `rename` 操作路径，Undo/Redo 语义一致
- [x] 4.2 `materials/src/container/defaults.ts`：`DEFAULT_CONTAINER_SIZE` → `320×240`
- [x] 4.3 容器工具单击不拖时回退默认尺寸（`compose-stage.tsx` 的 drawing commit 分支）
- [x] 4.4 单测：drawing seed 的点击回退

## 5. 深色默认与锁定语义

- [x] 5.1 Container 默认外观改深色底与深色描边，Stage 容器内继承文字色同步翻转
- [x] 5.2 锁定的容器与 Group 完全退出画布选中（body 与 label 都收敛为框选）
- [x] 5.3 锁定容器的标签只显示名称，禁用选中、拖动与重命名
- [x] 5.4 单测：锁定容器/Group 不产生 selection.change；锁定非容器 Entity 仍可选中

## 6. 验证

- [x] 6.1 E2E：容器内空白处拖动可框选子元素；标签点击选中并可拖动移动；双击重命名
- [x] 6.2 `bun run lint && bun run typecheck && bun run test && bun run build && bun run test:e2e`
- [x] 6.3 `openspec validate add-container-title-and-hit-convergence --strict`
