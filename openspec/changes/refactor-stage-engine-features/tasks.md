# 任务：把 stage-engine 按职责分目录

- [x] 1.1 按包的架构边界描述筛出四个新目录，`interaction-kernel/` 保持不动
- [x] 1.2 `git mv` 迁移，重写相对导入
- [x] 2.1 重命名两处与目录同名的文件
- [x] 2.2 每个目录写 `index.ts`；目录之间与公共入口改走目录入口
- [x] 2.3 公共入口按目录合并为 6 块，各带一句职责说明
- [x] 3.1 lint、typecheck、test、build 全部 `--force` 复核；e2e 99/99
