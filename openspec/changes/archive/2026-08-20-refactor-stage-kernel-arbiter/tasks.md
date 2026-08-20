# 任务：Stage 交互内核仲裁器与插件注册表

**验收铁律**：`interaction-controller.test.ts`（2225 行）与全部 e2e **一行不改**仍然全绿。
它是本仓库对 Stage 交互行为最完整的描述；改动它等于放弃唯一的验收依据。本步允许新增测试，
不允许修改既有断言。

## 1. 契约与内核（纯新增，不接线）

- [x] 1.1 新建 `packages/stage-engine/src/interaction-kernel/`：`StageInteractionPlugin`、
      `StageSession`、`StageClaimResult`（三态）、`StagePluginContext` 类型定义与 TSDoc
- [x] 1.2 实现 Session Arbiter：按 `priority` 询问、`consumed` 短路、单会话独占、
      `commit` 前强制一次最终点 `update`
- [x] 1.3 实现 Plugin Registry：注册、按优先级稳定排序、重复 id 拒绝
- [x] 1.4 Arbiter 与 Registry 的纯状态机单测（伪插件，不碰真实手势）：25 个用例

## 2. legacy 单体插件

- [x] 2.1 `legacyClaim` + `createLegacySession` 在 controller 闭包内转调既有
      `begin`/`updateGesture`/`finish`/`reset`，三个函数本体未移动
- [x] 2.2 `createStageInteractionController()` 内建内核：注册表只含 `legacy-monolith`，
      `send` 的指针生命周期改走仲裁器；公共签名与 snapshot/effect/event/surface port 协议未变
- [x] 2.3 `bun run test` 45/45、`bun run test:e2e` 99/99 全绿，既有断言零改动

## 3. commit 语义归位

- [x] 3.1 移除 `finish()` 开头内联的 `updateGesture`，改由 Arbiter 在 `commit` 前驱动；
      legacy 会话记住最近一次指针事件，供 `finish` 读取松手时的修饰键
- [x] 3.2 e2e 重点核对松手落点：move/resize/rotate/draw、Alt 吸入、Space 锁定父级、
      跨场景拖回落点、Auto Layout 重排全部通过

## 4. 优先级表（本步只建立、不依赖）

- [x] 4.1 按 `begin()` 实际行序抄录 18 条分支，每条标注原行号（1702→2198）
- [x] 4.2 单测锁定顺序、priority 严格递减、行号同序、id 唯一、legacy 优先级最低；
      legacy 内部仍走原级联，因此本步该表尚未生效

## 5. 导出与验证

- [x] 5.1 从 `stage-engine` 公共入口导出内核协议；未泄漏 Yoga/DOM/React 类型
- [x] 5.2 `bun run lint`、`typecheck` 46/46、`test` 45/45、`build` 24/24
- [x] 5.3 `bun run test:e2e` 99/99，黄金图零差异
- [x] 5.4 `docs/stage-plugin-kernel-roadmap.md`：标记步骤 2 完成，Overlay Registry 移到步骤 4

## 6. 实施中的一处补充（已在实现内解决）

- [x] 6.1 仲裁器增加 `release()`：丢弃会话引用但不调用 `cancel`。`reset()` 有 6 个调用点，
      其中 4 个在指针生命周期之外（并发文档变化中止手势、surface 断开、dispose、外部拖入
      开始）。这些路径已自行拆除手势，若不同步释放，仲裁器会认为手势仍在进行而拒绝下一次
      接管。`reset()` 统一调用 `release()`，因此 4 个调用点无需各自改写；`release` 不回调
      `cancel`，与 `arbiter.cancel()` 不会互相递归
