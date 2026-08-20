# 任务：Stage 交互内核仲裁器与插件注册表

**验收铁律**：`interaction-controller.test.ts`（2225 行）与全部 e2e **一行不改**仍然全绿。
它是本仓库对 Stage 交互行为最完整的描述；改动它等于放弃唯一的验收依据。本步允许新增测试，
不允许修改既有断言。

## 1. 契约与内核（纯新增，不接线）

- [ ] 1.1 新建 `packages/stage-engine/src/interaction-kernel/`：`StageInteractionPlugin`、
      `StageSession`、`StageClaimResult`（三态）、`StageSessionEffect` 类型定义与 TSDoc
- [ ] 1.2 实现 Session Arbiter：按 `priority` 询问、`consumed` 短路、单会话独占、
      `commit` 前强制一次最终点 `update`
- [ ] 1.3 实现 Plugin Registry：注册、按优先级排序、重复 id 拒绝
- [ ] 1.4 Arbiter 与 Registry 的纯状态机单测（用伪插件，不碰真实手势）

## 2. legacy 单体插件

- [ ] 2.1 `createLegacyMonolithPlugin({ getContext, getIndex, publish, apply })`：
      内部转调既有 `begin`/`updateGesture`/`finish`，本体一行不改
- [ ] 2.2 `createStageInteractionController()` 改为「内核 + legacy 插件」的组合；
      公共签名与 snapshot/effect/event/surface port 协议逐字不变
- [ ] 2.3 `bun run test` 与 `bun run test:e2e` 全绿（既有断言未改动即为无行为变化证据）

## 3. commit 语义归位（单独提交）

- [ ] 3.1 把 `finish()` 开头内联的 `updateGesture(event.point, event.modifiers)`
      改为由 Arbiter 在 `commit` 前驱动
- [ ] 3.2 单独验证：move / resize / rotate / draw 的松手落点与提交几何不变（e2e 重点核对）

## 4. 优先级表（本步只建立、不依赖）

- [ ] 4.1 按 `begin()` 实际行序逐条抄录优先级表，每条标注原行号以便评审逐行核对
- [ ] 4.2 单测锁定该表的顺序；legacy 仍走原级联，因此本步表未生效——真正依赖它是步骤 3

## 5. 导出与验证

- [ ] 5.1 从 `stage-engine` 公共入口导出内核协议；确认未泄漏 Yoga/DOM/React 类型
- [ ] 5.2 `bun run lint && bun run typecheck && bun run test && bun run build`
- [ ] 5.3 `bun run test:e2e`：黄金图零差异
- [ ] 5.4 `docs/stage-plugin-kernel-roadmap.md`：标记步骤 2 完成，并把 Overlay Registry
      从步骤 2 移到步骤 4（见 design.md 决策六）
