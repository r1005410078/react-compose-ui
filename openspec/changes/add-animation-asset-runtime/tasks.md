# 任务

## 1. OpenSpec 与包基座

- [ ] 1.1 验证 animation、compose-preview 增量规范，并建立 Scenario 到测试的映射清单。
- [ ] 1.2 创建 `@compose-ui/animation` 双入口、构建/发布配置与架构检查（根入口禁止 React/DOM，
      整包禁止依赖 `materials`/`stage`/`preview`/`editor`）；同步 README、openspec/project.md 与 Changeset。

## 2. Animation Asset v1 与 Store

- [ ] 2.1 Red → Green → Refactor：为 Asset v1 解析、序列化、时间/槽位/轨道/关键帧/easing 校验建立
      单元测试并实现最小协议。
- [ ] 2.2 Red → Green → Refactor：实现 Animation Store 的读取、创建、按 expected revision 保存、
      订阅失效、冲突拒绝与 Abort。

## 3. Animation 能力与 play 绑定

- [ ] 3.1 Red → Green → Refactor：实现 Animation Component 与 Capability（至多一个、可空引用、
      槽位映射、播放参数默认值、移除时清理字段绑定）。
- [ ] 3.2 Red → Green → Refactor：基于 `add-component-field-binding` 的 Contract 暴露 boolean `play`，
      覆盖绑定、解绑、类型不匹配回退与诊断。
- [ ] 3.3 Red → Green → Refactor：实现资源与槽位 Inspector（含锁定节点禁用编辑），由组合层注册
      Definition，验证 `materials` 不依赖 `animation`。

## 4. Headless 插值与播放 Runtime

- [ ] 4.1 Red → Green → Refactor：实现 Linear、Bezier、Spring、Hold 及 number/vector/color 插值，
      使用注入时钟验证边界、钳制与 overshoot。
- [ ] 4.2 Red → Green → Refactor：实现 delay、speed、once、loop、ping-pong、停止恢复、初始 true
      上升沿与资源 revision 切换。
- [ ] 4.3 Red → Green → Refactor：实现 self/后代槽位解析、实例边界拒绝、失效映射诊断与跨资源属性
      冲突检测（会话内按事务顺序、外部输入按稳定遍历顺序）。
- [ ] 4.4 Red → Green → Refactor：输出位置、旋转、缩放、透明度与纯色背景 FrameSnapshot，断言不修改
      Document 或 LayoutSnapshot。

## 5. Preview 集成

- [ ] 5.1 Red → Green → Refactor：Preview 按页面 scope 为每个合法 Animation 创建独立播放器，验证
      play 绑定、多节点独立时钟与资源错误局部降级。
- [ ] 5.2 Red → Green → Refactor：实现非 React 的逐帧提交路径，断言渲染次数不随帧数增长。
- [ ] 5.3 Red → Green → Refactor：验证卸载/页面切换释放 scheduler 与订阅、丢弃迟到结果，以及未注入
      Animation 配置时保持既有静态渲染。
- [ ] 5.4 添加确定性 Playwright 纵向流程：预置 fixture 动画资源 → 添加能力并绑定资源 → 绑定
      `playFault` → Preview 在受控时钟下播放到末帧并在 false 时恢复 authored 视觉。

## 6. 验证与交付

- [ ] 6.1 为每个任务在本文件记录实际 Red command/result/reason、Green command/result 与
      Regression command/result。
- [ ] 6.2 运行 `openspec validate add-animation-asset-runtime --strict`。
- [ ] 6.3 运行 `bun run lint`、`bun run typecheck`、`bun run test`、`bun run build` 与
      `bun run test:e2e`，修复全部回归后更新完成状态。
