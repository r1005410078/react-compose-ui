# compose-document 规范增量

## ADDED Requirements

### Requirement: 可选 Ports Component

文档协议 MUST 支持可选的 `Ports` Entity Component，声明这个 Entity 身上可以接线的点。
`items` 是 `{ id, position }` 的列表，`position` MUST 是 **Entity 局部坐标**（盒左上角为原点），
与 `Curve` 的盒局部几何同一个空间。

`Ports` MUST 能挂在**任意** Entity 上，MUST NOT 绑定到某一种物料或组件实例——端口是 Entity
的能力，与 `Interaction` 是同一条判断：画一个矩形给它两个端口，与放一个组件实例，在捕捉、
校验与导线求解眼里必须是同一件事。

同一个 Entity 内端口 id MUST 唯一。id 稳定是导线绑定不断的前提，重复 id 会让绑定指向「其中
一个」，而运行期没有正确答案。位置 MUST 是有限数。

`items` 为空的 `Ports` MUST 判为非法：一个不带任何端口的端口声明读不出意图。不再需要端口时
MUST 删掉整个 Component，与曲线外观「三项全清就整个删掉」是同一条判断。

`Ports` 缺席时文档行为 MUST 与今天完全一致，协议版本 MUST NOT 变化。

#### Scenario: 任意 Entity 都能带端口

- **WHEN** 一个矩形 Entity 声明两个端口
- **THEN** 文档校验通过，端口位置按该 Entity 的局部坐标解释

#### Scenario: 重复端口 id 非法

- **WHEN** 同一个 Entity 的两个端口用同一个 id
- **THEN** 校验产出可判别的问题码

#### Scenario: 空端口列表非法

- **WHEN** 一个 Entity 带 `Ports` 但 `items` 为空
- **THEN** 校验产出可判别的问题码

#### Scenario: 缺席即今天

- **WHEN** 文档中没有任何 `Ports`
- **THEN** 校验、渲染与命中与引入该 Component 之前逐字相同

### Requirement: 组件实例的端口从离线快照读出

读取一个 Entity 对外提供的端口 MUST 只有一个入口，它 MUST 合并两个来源：Entity 自己声明的
`Ports`，以及组件实例从 `resolvedSnapshot` 里带出来的**组件根 Frame** 的 `Ports`。实例自己
声明的端口 MUST 压过组件根的——那是作者在这一个实例上的显式覆盖。

组件根的端口 MUST NOT 被复制到实例 Entity 上。复制要在创建实例与**每一次刷新快照**的地方各
写一遍，漏一处的症状是「端口停在符号搬走之前的位置」，看起来像捕捉坏了而不是同步坏了。
读取入口住在本包，因此捕捉一侧不需要认识组件协议——「命中与捕捉路径读的字段必须是文档级
契约」这条边界由**入口的归属**满足，而不是由复制满足。

快照形状不合法时 MUST 当作没有端口，MUST NOT 抛出：快照由宿主写入，端口读取不是校验它的地方。

组件根上声明一次，全部实例 MUST 都有；变体覆盖端口 MUST NOT 需要任何新机制——端口是根 Frame
上一个 Component 的字段，既有的 `set-field` 覆盖它本来就合法。

#### Scenario: 实例带出组件根的端口

- **WHEN** 组件根 Frame 声明两个端口，页面上放置该组件的实例
- **THEN** 从实例 Entity 读出的端口就是这两个

#### Scenario: 实例自己声明的端口优先

- **WHEN** 实例 Entity 自己也带 `Ports`
- **THEN** 读出的是实例自己声明的那一份

#### Scenario: 快照不合法时当作没有端口

- **WHEN** 实例的 `resolvedSnapshot` 不是预期形状
- **THEN** 读出空列表，不抛出
