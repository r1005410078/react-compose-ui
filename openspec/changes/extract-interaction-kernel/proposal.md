# 把交互内核抽成独立包

## Why

路线图 6c 要让 CAD 的点选、框选与命令取点竞争同一个指针，这正是仲裁器该干的活。但**依赖
方向走不通**：AGENTS.md 规定 `@compose-ui/cad` 只能依赖 `core` 与 `assets`，而内核今天住在
`@compose-ui/stage-engine` 里。

让 CAD 去依赖 `stage-engine` 不是省事而是错位：那个包的职责是「坐标、场景索引、吸附、手势
状态机与空间命令」，整包都绑在 `ComposeLayoutSnapshot` 与盒模型上，CAD 一样都用不上，却要
连带吃下 `@compose-ui/core` 这个内核本身并不需要的依赖。

步骤 1 泛型化内核时**刻意没有抽包**，理由是「只有一个消费者，AGENTS.md 禁止提前抽象」。
现在有第二个了——这正是 AGENTS.md 给出的准入线：「只有已经被至少两个第一方包复用……才能
上移」。

## What Changes

新增 `@compose-ui/interaction-kernel`：**零运行时依赖**、无 React、无 DOM、不认识任何文档
协议的交互内核包。内容是步骤 1 已经泛型化完毕的三个模块，原样搬迁：

- `InteractionKernelProfile`：把内核用到的六个类型打成一条类型级记录。
- `createInteractionPluginRegistry`：按 `priority` 排序、拒绝重复 id。
- `createInteractionSessionArbiter`：三态 `claim`、同时至多一个会话、`commit` 前先吃掉终点、
  `isCompatibleWith` 自检。

`@compose-ui/stage-engine` 依赖新包，只保留 `stage-kernel-profile.ts` 这一处绑定与既有别名。
**公共入口一个名字都不变**，因此 `stage`、`editor` 与全部插件零改动。

## 边界从「正则守卫」变成「包依赖」

今天守着「内核不认识文档」的是 `dependency-boundary.test.ts` 里的一条正则
（`/\bStage[A-Z]\w*/`）。它拦得住 `StageSceneIndex`，拦不住一个叫 `SceneIndex` 的类型被
import 进来。

抽包之后，内核在一个 `dependencies: {}` 的包里——**想引用文档类型必须先加依赖**，而那条
依赖会被新包自己的边界用例挡下。这是把口头约定换成结构约束，正是 AGENTS.md 说的
「不得通过深层源码导入、循环依赖或在低层复制领域类型绕过边界」。

## 顺带补上步骤 5 漏掉的两处

`@compose-ui/cad-canvas` 在步骤 5 建包时没写进 AGENTS.md 的架构边界，也没进根
`pack:dry-run` 链。两处都是一行，与本刀同属「包的登记」，一并补齐。

## 本刀不做

不改任何行为，不动任何插件，不碰 CAD。仲裁器在 CAD 侧的接入是下一刀
（`add-cad-selection`）——两件事捆在一起时，一旦接入出问题就分不清是搬迁搬坏了还是接线接
错了。

`pointerId` 仍是内核里唯一一处指针语义泄漏，本刀不动它：CAD 的会话身份要等接线之后才看得清。

## Impact

- Affected specs: `interaction-kernel`（新增）、`stage-engine`
- Affected code: `packages/interaction-kernel/`（新增）、
  `packages/stage-engine/src/interaction-kernel/`、`AGENTS.md`、根 `package.json`
- 公共 API 无变化；`@compose-ui/stage-engine` 的导出逐字不变
