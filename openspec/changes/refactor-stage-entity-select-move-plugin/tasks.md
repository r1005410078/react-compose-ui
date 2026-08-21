# 任务：把实体选中并拖动拆成交互插件

- [x] 1.1 新增 700 入口插件，复用 `claimStageMove`
- [x] 1.2 决策树三条出口：双击编辑 / 开始移动 / 仅改选区，一律 `consumed`
- [x] 1.3 删除失效的 legacy 移动机制：Gesture 变体、update / finish 分支、会话 Space 处理
- [x] 1.4 `startTransform` 收窄为 `startResize`
- [x] 1.5 内核 temporary-pan 分派不再问 legacy 的 `gesture`
- [x] 2.1 补 11 条测试：优先级、选区与移动、效果顺序、Shift 组合、失效引用、双击两态、锁定、
      非 select/move 工具、不存在的 Entity
- [x] 2.2 e2e 暴露右键菜单失效：`event.button > 1` 的总闸被插件绕过，判定移到询问插件之前
- [x] 2.3 lint、typecheck、test、build、e2e 全绿；`interaction-controller.test.ts` 一行未改
