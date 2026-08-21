# 变更：把 Stage Overlay 拆成可注册的层

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 4。步骤 3 让手势变成可替换的插件，
呈现侧却仍是一个 871 行的 `stage-overlay.tsx`：13 个图层塞在同一段 JSX 里，前面还压着一段
约 100 行的共享派生。新文档类型（CAD）要贡献自己的标注层，只能改这个文件。

**SVG 没有 z-index，绘制顺序即命中顺序**，因此层与层之间的先后是硬约束而不是审美——它决定
重叠区域归谁接收指针。原先这层关系只隐含在 JSX 的书写次序里。

## 变更内容

- 新增 `stage-overlay/` 功能目录：`overlay-types.ts`（`StageOverlayContribution`）、
  `overlay-registry.ts`、`overlay-geometry.ts`（纯几何助手与尺寸常量）、
  `layers/`（12 个层）、`stage-overlay.tsx`（只挂 `<svg>` 并按序铺开各层）。
- `createStageOverlayRegistry(extra)` 让宿主追加层，与第一方层按同一套 `order` 排序，id 重复
  时抛错。
- 绘制顺序从 JSX 书写次序变成显式 `order` 数值，理由与手势的 `STAGE_GESTURE_PRIORITY` 完全
  一致：顺序错位会静默改变「重叠区域归谁」，而那是最难定位的一类问题。两处硬约束写进注释
  并由测试锁定——路径顶点必须压在缩放手柄之上（关键帧顶点常与对象角点重合），吸附参考线
  必须在最上层（被盖住等于没画）。
- **层之间不共享派生值**：各自从同一份上下文取自己需要的字段并自行换算。刻意不预先算一个
  共享派生包——那会让每加一层就往包里塞几个字段，最终又变回一个谁都在读、谁都不敢改的大
  对象。重复几次 `worldToScreen` 的代价远小于它。

## 影响

- 受影响的规范：`stage`（Overlay 呈现）
- 受影响的代码：`stage-overlay.tsx`（删除）、`stage-overlay/`（新增 16 个文件）、
  `stage-surface/compose-stage.tsx`（仅导入路径）
- 用户可见行为：无。41 张黄金图逐像素一致。
