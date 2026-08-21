# 泛型化交互内核契约

## Why

CAD 文档类型（见 `docs/cad-document-roadmap.md`）要复用 Stage 打磨过的手势仲裁：优先级
询问、三态 claim、提交前吃掉最终点、会话自检上下文兼容性、`release` 与 `cancel` 的区分。
这些规则合计 358 行，且其中若干条是踩坑之后才补上的（顺序反转、并发中止、Space 归属）。

但内核当前把文档类型焊死在类型签名里：`kernel-types.ts`、`session-arbiter.ts` 与
`plugin-registry.ts` 直接 import `StageInteractionContext`、`StageInteractionSnapshot`、
`StageInteractionEffect` 与 `StageSceneIndex`。三个文件的**逻辑**完全不认识文档，只有
**类型**认识。

不泛型化，CAD 只有两条路：依赖整个 `stage-engine`（连带拖进 ComposeDocument 专有的几何、
场景索引与空间命令），或者复制那 164 行仲裁逻辑（复制的同时也复制了将来所有分叉）。

## What Changes

- 引入 `InteractionKernelProfile`——把 context / index / event / claimEvent / effect /
  snapshot 六个类型打成一个类型级记录，使内核只需要一个类型参数而不是六个。
- `kernel-types.ts`、`session-arbiter.ts`、`plugin-registry.ts` 改为对该 profile 泛型，
  并**移除对 stage 专有类型的全部 import**。
- 新增 `stage-kernel-profile.ts`：绑定 Stage 的六个类型，并把 `StagePluginContext`、
  `StageSession`、`StageInteractionPlugin`、`StageClaimResult`、`StagePluginRegistry`、
  `StageSessionArbiter`、`StagePointerDownEvent` 全部定义为该绑定上的别名。
- `dependency-boundary.test.ts` 增加守卫：三个泛型文件 MUST NOT import stage 专有模块。

**无行为变化，且现有公共 API 一个名字都不改。** 18 个插件、`interaction-controller.ts`
与全部既有测试的 import 与调用**一行不动**——泛型化只在类型层发生。

## Impact

- Affected specs: `stage-engine`
- Affected code: `packages/stage-engine/src/interaction-kernel/`
  （`kernel-types.ts`、`session-arbiter.ts`、`plugin-registry.ts`、`index.ts`、
  新增 `stage-kernel-profile.ts`、`dependency-boundary.test.ts`）
- 不影响 `packages/stage`、`packages/editor` 或任何下游包
