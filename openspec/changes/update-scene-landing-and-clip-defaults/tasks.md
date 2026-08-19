# 任务：场景外落点保留位置，场景默认统一不裁剪

## 1. 实现

- [x] 1.1 `root-landing.ts`：非容器分支去掉 `clampBoundsIntoFrame`，局部坐标直接取
      世界落点换算结果；升格分支把新画容器的 Clip 归一为不裁剪后再 promote
- [x] 1.2 `materials/frame/preset.tsx`：frame Preset defaultClip 改为不裁剪
- [x] 1.3 单测：root-landing 落点保留（越界局部坐标不钳制）、升格场景 Clip 不裁剪、
      frame Preset Clip 默认值

## 2. 测试同步

- [x] 2.1 更新既有「在场景外绘制矩形落进激活场景」相关单测/e2e 的钳制断言为保留落点
- [x] 2.2 e2e：物料拖到所有场景之外 → 对象出现在拖放处、属于激活场景、画布可见

## 3. 验证

- [x] 3.1 `bun run lint && bun run typecheck && bun run test && bun run build` 与
      `bun run test:e2e`
- [x] 3.2 同步 AGENTS.md「根层落点按类型分流」段落（钳制表述改为保留落点）
