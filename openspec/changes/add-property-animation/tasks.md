## 1. OpenSpec 与包基座

- [ ] 1.1 验证 animation 新能力及 compose-document、component-registry、basic-materials、stage、compose-preview、editor-workspace-layout 增量规范，并建立 Scenario 到测试的映射清单。
- [ ] 1.2 创建 `@compose-ui/animation` 双入口、构建/发布配置与架构检查；同步 README、AGENTS.md、openspec/project.md 和 Changeset。

## 2. Animation Asset v1 与 Store

- [ ] 2.1 Red → Green → Refactor：为 Asset v1 解析、序列化、时间/槽位/轨道/关键帧/easing 校验建立单元测试并实现最小协议。
- [ ] 2.2 Red → Green → Refactor：为 Provider 读取、创建、revision 保存、订阅失效、冲突与 Abort 建立测试并实现 Animation Store。
- [ ] 2.3 Red → Green → Refactor：为草稿、dirty、Undo/Redo、显式保存、重新加载和强制覆盖建立会话模型测试。

## 3. Component 字段绑定与动画能力

- [ ] 3.1 Red → Green → Refactor：扩展 Core Bindings v1/v2 校验、序列化兼容、空绑定清理和 v1→v2 写入规范化。
- [ ] 3.2 Red → Green → Refactor：实现 Component Field Contract、runtime value 解析、订阅、diagnostic 与 Inspector binding port。
- [ ] 3.3 Red → Green → Refactor：实现 Animation Component/Capability、资源与槽位 Inspector、播放参数、`play` boolean 绑定和能力移除清理。

## 4. Headless 插值与播放 Runtime

- [ ] 4.1 Red → Green → Refactor：实现 Linear、Bezier、Spring、Hold 及 number/vector/color 插值，并使用注入时钟验证边界和 overshoot。
- [ ] 4.2 Red → Green → Refactor：实现 delay、speed、once、loop、ping-pong、停止恢复、初始 true 与资源 revision 行为。
- [ ] 4.3 Red → Green → Refactor：实现 self/后代槽位解析、实例边界拒绝、失效映射诊断和跨资源属性冲突检测。
- [ ] 4.4 Red → Green → Refactor：输出位置、旋转、缩放、透明度和纯色背景 FrameSnapshot，确认不修改 Document 或 LayoutSnapshot。

## 5. Auto-keyframe 与动画编辑会话

- [ ] 5.1 Red → Green → Refactor：实现视觉安全属性的命令识别与 recording adapter，验证录制关闭时原命令完全透传。
- [ ] 5.2 Red → Green → Refactor：实现自动建轨道、0ms 基础帧、当前帧更新和连续编辑历史合并。
- [ ] 5.3 Red → Green → Refactor：实现活动动画资源、自动槽位草稿、保存后目标映射事务与失败回退。

## 6. React 时间轴与上下文 Inspector

- [ ] 6.1 Red → Green → Refactor：实现全宽受控时间轴、容器范围聚合、节点/属性轨道、菱形关键帧、播放头、缩放和紧凑播放控制。
- [ ] 6.2 Red → Green → Refactor：实现关键帧多选、移动、删除、键盘/ARIA、焦点恢复及自动记录状态；界面不得出现手动添加属性入口。
- [ ] 6.3 Red → Green → Refactor：实现关键帧/区间 Inspector、Bezier 曲线和 Spring 编辑器，并与 Stage/Scene Tree 选择同步。
- [ ] 6.4 Red → Green → Refactor：实现资源草稿保存、冲突对话框、dirty/关闭保护和共享资源提示。

## 7. Editor、Stage 与 Preview 集成

- [ ] 7.1 Red → Green → Refactor：在 bottom Edge Group 增加“动画”标签并保持资源、动画、命令、日志顺序、全宽布局、折叠和用户尺寸。
- [ ] 7.2 Red → Green → Refactor：Stage 应用受控播放头 FrameSnapshot，动画编辑覆盖 setup 播放且不产生文档事务。
- [ ] 7.3 Red → Green → Refactor：Preview 按页面 scope 驱动独立播放器，验证 play 绑定、资源错误降级、订阅清理和 Stage/Preview 帧一致性。
- [ ] 7.4 添加确定性 Playwright 纵向流程和黄金图：创建资源、添加能力、自动记录白→红、四关键帧、绑定 `playFault`、Preview 播放与全宽底部 Dock；时间轴、播放控制区与关键帧 Inspector 的黄金图需与 `design/alimation.png` 设计稿逐项比对（标签顺序、播放控制区图标排布、关键帧菱形/播放头、Curve/Spring Inspector 布局），确认还原后再定稿。

## 8. 验证与交付

- [ ] 8.1 为每个任务在本文件记录实际 Red command/result/reason、Green command/result 与 Regression command/result。
- [ ] 8.2 运行 `openspec validate add-property-animation --strict`。
- [ ] 8.3 运行 `bun run lint`、`bun run typecheck`、`bun run test`、`bun run build` 和 `bun run test:e2e`，修复全部回归后更新完成状态。

