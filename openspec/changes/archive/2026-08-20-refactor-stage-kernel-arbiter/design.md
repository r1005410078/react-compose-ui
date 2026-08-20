## 上下文

步骤 2 的目标是给步骤 3 造一个「可搬入的地方」，而不是改善任何现有行为。验收标准是
`interaction-controller.test.ts`（2225 行）与全部 e2e **一行不改**仍然全绿——它是本仓库
对 Stage 交互行为最完整的描述，改动它等于放弃了唯一的验收依据。

## 目标/非目标

- 目标：插件与会话契约、Session Arbiter、Plugin Registry、legacy 单体插件包装、显式优先级表。
- 非目标：搬迁任何手势（步骤 3）；Overlay Registry 与 Overlay 拆分（步骤 4）；
  `compose-stage.tsx` 瘦身（步骤 5）。本步**不减少 `interaction-controller.ts` 的行数**，
  只增加内核文件。

## 决策

### 决策一：claim 是三态，不是两态

架构稿里写的是 `claim(event, ctx): StageSession | null`。读代码后发现两态表达不了现有行为：

```ts
// interaction-controller.ts:1702-1714，文字编辑守卫
if (onEditingTarget || onEditingHandle) return   // 已消费：不开会话，且必须阻止后续全部判定
```

```ts
// interaction-controller.ts:2197，兜底
if (context.tool === 'rotate') return            // 同上
```

这两处的语义是「这次按下已经被处理掉了，不要再问别人，也不产生拖拽会话」。用 `null`
表达会让仲裁器继续问下一个插件，行为立刻改变；用一个空 Session 表达则会凭空产生一次
`commit`。因此契约定为：

```ts
type StageClaimResult = StageSession | 'consumed' | null
```

考虑过的替代方案：把守卫留在内核里做前置 pass（可行，但等于承认内核仍有硬编码的交互知识，
步骤 3 把 text-edit 变成插件时还要再改一次契约，否决）。

### 决策二：commit 前保证一次最终点 update

`finish()` 的第一件事是 `updateGesture(event.point, event.modifiers)`（`:2205`）：提交用的
几何是「最终点推进之后」的状态，不是最后一帧 move 留下的状态。这条不写进契约的话，12 个
插件会各自重复实现，而且很容易漏——漏掉的表现是「松手位置和落点差最后一帧」，属于极难
定位的偏移类 bug。

契约：Arbiter MUST 在调用 `session.commit()` 前，先以 pointerup 的点与修饰键调用一次
`session.update()`。插件的 `commit` 因此只读自身状态，不接收终点参数。

### 决策三：Session 自持状态，不共享可变 `gesture` 变量

现在 12 个变体共用一个模块级 `let gesture`，`updateGesture` 就地改它的可变字段
（`currentWorld`、`transforms`、`dropTarget` 等）。插件模型里每个 Session 是自己的闭包/对象，
自持这些字段。语义等价（同一时刻本就只有一个手势），但消除了「谁能改 gesture」的隐式共享。

### 决策四：legacy 插件通过工厂接收内核服务

`begin`/`updateGesture`/`finish` 依赖内核持有的 `context`、`index`、`publish`、`apply`。
绞杀式重构的常规做法：legacy 插件由工厂创建，工厂参数就是这些内核服务。

```ts
createLegacyMonolithPlugin({ getContext, getIndex, publish, apply })
```

这样 legacy 内部实现一行不改，只是从「模块内自由变量」改为「工厂参数」。步骤 3 每搬走一个
手势，就从 legacy 的三个 switch 里删掉对应分支，legacy 行数单调递减，最终在步骤 5 归零。

### 决策五：优先级表是本步唯一的真实风险

级联顺序目前只体现为行序。固化成 `priority` 数字时，任何一处顺序错位都会静默改变
「同一个点击谁接管」，而且多数情况下不会有测试直接失败——只有特定命中组合才暴露。

缓解：
1. 优先级表按 `begin()` 的**实际行序**逐条抄录，并在表旁标注原行号，评审时可逐行核对。
2. 本步 legacy 是**单个**插件，内部仍走原级联——因此步骤 2 实际上**还没有**用到优先级表。
   表在本步只被单测锁定，真正生效是在步骤 3 拆出第二个插件时。这把「建立表」与「依赖表」
   分成两步，风险不叠加。

### 决策六：Overlay Registry 推迟到步骤 4

路线图原本把两个 Registry 都放在步骤 2。但 Overlay 贡献在步骤 4 之前没有任何消费方，
提前建注册表就是仓库明令禁止的提前抽象。路线图随本变更修订。

## 风险/权衡

- **snapshot 派生耦合**：`enrich()`（`:1285-1362`）在每次 publish 前统一补齐派生字段，
  legacy 插件必须继续走同一个 `publish`，不得自己组装 snapshot，否则派生字段会缺失。
- **`finish` 内联调用 `updateGesture`**：包装成插件后这条内部调用要改为由 Arbiter 驱动
  （决策二），是本步唯一触碰 legacy 内部的地方，需单独提交并单独验证。
- **本步没有行为收益**：纯结构投入。若评审认为应该合并进步骤 3 的第一个手势一起做，
  代价是那次提交同时包含「建内核」与「搬手势」，回退粒度变粗。建议保持分开。

## 迁移计划

1. 落契约与 Arbiter/Registry，不接线（纯新增，无风险）。
2. 把 legacy 包成插件并让 `createStageInteractionController()` 改走内核组合。
3. 把 `finish` 里的内联 `updateGesture` 改为 Arbiter 驱动。

每步独立提交，任一步测试变红即回退该步。

## 待解决问题

- `externalDrop`（`:2544`）不属于指针手势生命周期，本步保留在内核里。它究竟是内核能力
  还是一个「非指针来源的会话」，留到步骤 3 搬迁 draw/marquee 时一并判断。
