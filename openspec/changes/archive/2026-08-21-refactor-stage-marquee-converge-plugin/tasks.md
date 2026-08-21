# 任务：把容器体收敛入口拆成交互插件

- [x] 1.1 `shouldConvergeToMarquee` 迁入 `marquee-plugin.ts` 并导出
- [x] 1.2 `isTopLevelEntity` 内联，约束写在调用处
- [x] 1.3 新增 800 入口插件，复用 `claimStageMarquee`
- [x] 1.4 legacy 删掉 800 分支与两个私有 helper，卸掉两个导入
- [x] 2.1 修正首版夹具：v7 的顶层容器就是场景，`document()` 包的根 Frame 才是收敛目标
- [x] 2.2 补 11 条测试：优先级、四条 controller 行为、六条判定纯函数分支
- [x] 2.3 lint、typecheck、test、build、e2e 全绿；`interaction-controller.test.ts` 一行未改
