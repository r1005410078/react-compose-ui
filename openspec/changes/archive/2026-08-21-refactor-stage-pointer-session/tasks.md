# 任务：把指针会话生命周期切成独立 Hook

- [x] 1.1 `use-stage-pointer-session.ts`：会话类型与七个 ref
- [x] 1.2 按下归一化、capture 接管与归还、window 路由、逐帧推进
- [x] 1.3 结束 / 取消 / 卸载清理 / capture 丢失处理
- [x] 2.1 `compose-stage.tsx` 接线，2034 → 1621 行
- [x] 2.2 修正渲染期写 ref（改用 useLayoutEffect）与依赖告警
- [x] 2.3 既有测试与 e2e 一行不改仍全绿
- [x] 3.1 lint、typecheck、test、build、e2e 五道门槛
- [x] 3.2 更新路线图步骤 5 进度
