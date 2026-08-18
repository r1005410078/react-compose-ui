# 变更：容器标题标签与命中收敛

## 原因

容器在 Stage 上是一个"无名的大盒子"，带来四个互相关联的可用性问题：

1. 工具栏的容器图标是一个普通矩形轮廓，与 rectangle 工具难以区分；快捷键 `C` 与业界的
   Frame/Artboard 约定（`F`）不一致。
2. 画布上没有任何容器名称。用户只能到场景树里辨认哪个盒子是哪个容器，也无法就地重命名。
3. 容器体在任何情况下都是选中入口：pointer 一压在容器空白处就选中容器并进入 move 手势，
   于是**在容器内部无法框选子元素**——这正是用户反馈的冲突。目前只能切到 marquee 工具绕开。
4. 从左侧面板拖入的容器默认 `1280×720`，在正常缩放下几乎铺满视口；用容器工具单击不拖时
   反而落到 `Math.max(1, 0)` 的 1×1 退化尺寸。

Figma Frame 与 Rive Artboard 对前三点给出的是同一套约定：名称标签画在容器左上角外侧、
恒定屏幕尺寸、**标签本身是主要命中目标**，容器体在有内容时不再抢占选中。本变更把这套约定
落到 Compose Stage。

## 变更内容

- **图标与快捷键**：容器工具图标改为井号（`#`）字形；`stage.drawContainerTool` 默认键位
  `C` → `F`；被占用的 `stage.fitSelection` 迁到 `Shift+2`（对齐 Figma 的 zoom to selection），
  `stage.fitContainer` 的 `Shift+F` 不变。
- **容器标题标签**：Stage 新增标签层，为**顶层容器**（`rootIds` 的直接成员且含 Hierarchy）
  在左上角外侧渲染恒定屏幕尺寸的名称标签。标签可点击选中、可双击就地重命名；重命名不由
  Stage 自行写文档，而是通过新的受控回调交回宿主，与场景树重命名共用同一条命令。
- **命中收敛**：`StageInteractionHit` 的 entity 分支增加 `source: 'body' | 'label'`。
  `select`/`move` 工具下，从**容器体**按下且该容器**已有子元素**且**不在当前选区内**时，
  不再选中容器，改为起框选。空容器、已选中的容器、标签命中、Shift 加选、marquee 与绘制
  工具的既有行为全部不变。
- **默认尺寸**：`DEFAULT_CONTAINER_SIZE` 由 `1280×720` 改为 `320×240`；容器工具的"单击不拖"
  也回退到该默认尺寸，不再产生 1×1 容器。

## 影响

- 受影响的规范：`stage`、`stage-engine`、`editor-preferences`、`basic-materials`
- 受影响的代码：
  - `packages/stage/src/container-label-layer/`（新增）、
    `packages/stage/src/stage-surface/compose-stage.tsx`、`packages/stage/src/styles.css`
  - `packages/stage-engine/src/interaction-controller.ts`
  - `packages/editor/src/editor-preferences/preferences.ts`、
    `packages/editor/src/stage-toolbar/stage-toolbar-icons.tsx`、
    `packages/editor/src/editor-controller/` 与 `editor-i18n.ts`（重命名回调接线）
  - `packages/materials/src/container/defaults.ts`、`packages/materials/src/material-icons.tsx`
- 破坏性：`C` 不再切换容器工具、`F` 不再是"缩放到选中"；已保存的自定义快捷键偏好不受影响。
