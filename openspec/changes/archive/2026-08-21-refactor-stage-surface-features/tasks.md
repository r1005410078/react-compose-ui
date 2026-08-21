# 任务：把 stage-surface 按用户能力分目录

- [x] 1.1 按准入标准筛出六个目录，其余留根
- [x] 1.2 `git mv` 迁移，重写相对导入
- [x] 2.1 每个目录写 `index.ts` 公共入口
- [x] 2.2 目录之间与宿主改走目录入口，合并宿主重复导入
- [x] 3.1 修复分目录暴露的 `entity-creation ⇄ preview-document` 循环：`ShapeDirection` 归位
- [x] 3.2 补齐目录入口缺失的导出（由 vitest 抓到，typecheck 因 turbo 缓存漏报）
- [x] 4.1 lint、typecheck（`--force`）、test、build、e2e 五道门槛
