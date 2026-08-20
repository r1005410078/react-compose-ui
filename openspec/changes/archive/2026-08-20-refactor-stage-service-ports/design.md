## 上下文

Stage 插件化路线图的第一步。目标不是让 Stage 变好用，而是把注入面整理成步骤 2 的
`createComposeStageRuntime({ plugins, overlays, services, policy })` 能直接接收的形状，
同时消灭 `cloneElement` 注入这个类型系统看不见的旁路。

约束：**零行为变化**。现有单测与 e2e 黄金图是唯一验收标准，任何断言需要修改的地方
都说明搬迁越界了。

## 目标/非目标

- 目标：`services` / `policy` 两个聚合对象落地；`cloneElement` 注入删除；
  动画模式以组装 policy 表达。
- 非目标：内核、Arbiter、插件契约（步骤 2）；手势搬迁（步骤 3）；Overlay 拆分（步骤 4）；
  运动路径 prop 与 `compose-stage.tsx` 瘦身（步骤 5）。**本步不减少任何文件的行数。**

## 决策

### 决策一：两个对象，不是一个

`services` 与 `policy` 的**生命周期和所有者不同**，合成一个对象会立刻制造引用抖动：

- `services` 在组合根创建一次，整个会话内引用不变（端口本身是稳定的）。
- `policy` 随宿主模式切换而变（进出动画模式、切换框选判定）。

合并后每次模式切换都会换掉整个对象的引用，逼迫 Stage 内部对端口做二次记忆化。分开后
`services` 天然稳定，`policy` 变化频率与它表达的语义一致。

考虑过的替代方案：单个 `stage` 配置对象（引用抖动，否决）；保持全平铺只删 cloneElement
（解决不了布尔累积，且步骤 2 仍要再搬一次，同一批 prop 搬两次，否决）。

### 决策二：只搬迁步骤 2 会被内核消费的 prop

判据是「这个 prop 在步骤 2 是否会成为内核的构造参数」。是则本步搬进聚合对象，否则原地不动。

因此**保持平铺**的三类：

1. **受控组件协议**：`viewport`、`tool`、`selectedIds`、`activeFrameId` 及其 `onChange`。
   它们是 React 受控模式的一部分，埋进对象会破坏既有的受控语义表达。
2. **逐帧数据**：`document`、`layoutSnapshot`、`layoutPreviewSnapshot`、`layoutError`、
   `scriptScope`。这些每帧都可能换引用，包进对象等于每帧多分配一个对象。
3. **快捷键**：`shortcuts` 与 `onShortcutAction` 在步骤 2 归入内核输入管线的动作表，
   届时形状会再变一次。本步搬进 `services` 等于搬两次，故原地不动。

### 决策三：不提供兼容层

`docs/vnext-react-api-migration.md` 已确立取向：第一方 React 包不提供旧名称、兼容入口或
运行时迁移层。平铺 prop 直接删除，TypeScript 编译错误就是迁移清单。仓库内全部调用点
（`app/`、`apps/storybook/`、单测、e2e）在同一变更内改完。

### 决策四：`cloneElement` → 显式组合函数

现状：`controller` 计算出 `stageProps`，`ComposeEditor` 用 `addDefaultElementProps` 向
`controller.stage` 这个已构造元素克隆注入九项宿主属性，优先级「注入值覆盖 controller 默认值」
只写在注释里。

改为 controller 暴露可组合的 stage props 数据，编辑器调用一个显式组合函数把宿主覆盖合上去，
优先级由函数签名与类型表达。`controller.stage` 元素入口保留——直接渲染它的宿主不受影响，
只是编辑器自己不再走克隆。

`addDefaultElementProps` 仍被 inspector、toolbar、command panel 使用，**本变更不动它们**，
只摘掉 Stage 这一处。

## 风险/权衡

- **对象 prop 的引用稳定性**：`services` 未记忆化会导致 Stage 每次宿主渲染都认为端口变了。
  缓解：Stage 侧对端口对象按字段浅比较消费，且在 TSDoc 中把「引用稳定」写成契约；
  编辑器侧用 `useMemo` 构造。这一点从「隐性假设」变成「显式契约」本身就是收益——
  现有代码已经有两层 memo 在守护集合引用稳定，端口没有理由例外。
- **搬迁越界的信号**：任何现有断言需要改动即为越界信号，必须回退该处而不是改断言。
  唯一允许改动的是调用点的 prop 写法本身。
- **动画模式回归**：`lockGestureParent` 的语义（拖拽锁定原父级，防止对象被静默挂进
  激活场景）必须逐字保留到 `policy.lockGestureParent`，相关 e2e 是硬门槛。

## 迁移计划

1. 先加聚合对象并让 Stage 同时接受两种形状，内部一律读聚合对象（平铺值在入口归一）。
2. 逐个改完仓库内调用点。
3. 删除平铺 prop 与归一代码，`cloneElement` 一并摘除。

回滚：三步各自独立提交，任一步 e2e 变红即回退该步。

## 待解决问题

- `gridVisible` 归入 `policy` 是否合适：它是会话视图开关而非模式语义。当前按
  「宿主拥有事实来源、Stage 只消费」的统一判据归入 policy；若步骤 2 发现内核不消费它，
  再单独退回平铺。
