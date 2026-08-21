# 任务：把 Stage Overlay 拆成可注册的层

- [x] 1.1 新增 `overlay-types.ts`：`StageOverlayContribution` 与上下文
- [x] 1.2 纯几何助手与尺寸常量迁入 `overlay-geometry.ts`
- [x] 1.3 13 个图层拆成 `layers/` 下 12 个文件，JSX 原样保留
- [x] 1.4 `overlay-registry.ts`：显式 order + 宿主追加 + id 去重
- [x] 1.5 `stage-overlay.tsx` 收敛成只挂 `<svg>` 并按序铺开各层（37 行）
- [x] 2.1 补 6 条注册表测试：降序、order 唯一、两处硬约束、追加、重复
- [x] 2.2 lint、typecheck、test、build 全绿
- [x] 2.3 e2e 99/99，其中 41 张黄金图逐像素一致——本变更零视觉差异的证据
