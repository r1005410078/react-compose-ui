## 上下文

`Bindings.version: 1` 只表达 Renderer Props 绑定，且校验时强制 Entity 拥有 Renderer。Component 字段
绑定与 Renderer 无关（例如 Hierarchy 容器上的 Component），因此不能复用同一前置条件，必须扩展协议。

本变更只做绑定协议与端口，不引入任何具体的可绑定字段消费者；`add-animation-asset-runtime` 是它的
第一个下游使用者。

## 目标/非目标

- 目标：Component 字段可绑定页面 setup value；解析、诊断与 Inspector 端口和 Renderer Props 对称。
- 非目标：method 绑定、双向绑定、跨页面/跨文档 scope、表达式或计算绑定、绑定的批量编辑 UI。

## 决策

### 单一 Bindings Component 内分区，而不是新增 Component

Component 字段绑定放进现有 `Bindings` 的 `componentFields` 分区，而不是新增一个内建 Component。
理由：绑定是"引用页面 scope"的同一类事实，集中在一个 Component 里可以让"Entity 上是否存在绑定"
保持单一查询点，也让解绑清理、移除 Component 时的级联清理只处理一处。

代价是 `rendererProps` 与 `componentFields` 的前置条件不同（前者要求 Renderer，后者要求对应
Component 存在）。校验按分区分别执行，不上提为 Component 级前置条件。

### version 2 只在写入时出现

加载旧文档不迁移、不改写 version；只有首次保存 Component 字段绑定时，才把该 Entity 的 Bindings
候选整体规范化为 version 2。这样绝大多数既有文档在磁盘上保持字节稳定，diff 噪音只出现在用户
真正使用新能力的 Entity 上。

Core 校验 v2 时不要求 `rendererProps` 存在，也不要求 `componentFields` 存在，但要求两者至少有一个
非空——空 Bindings 仍然是非法的，避免留下无意义的 Component。

### Contract 由 Definition 声明，Core 不参与

Field 是否存在、kind 是否匹配由 Registry 的 Definition Contract 判断，Core 只校验 JSON 形状。这与
现有 Renderer Props 的分工一致：文档层保留未知合法引用，运行时负责诊断与 authored fallback。
好处是外部/未来 Component 的绑定不会因为当前 Registry 未注册而在加载时被丢弃。

validator 要求纯同步：绑定值解析发生在渲染路径上，异步校验会引入无法确定性测试的中间态。
getter 与 validator 的异常必须逐字段隔离，一个 Component 的实现错误不能让同 Entity 的其他绑定失效。

## 风险/权衡

- 公共协议面扩大 → 保留 v1 解析路径与既有 Renderer 行为不变，新增路径使用独立 validator 与回归测试。
- 两种前置条件容易写错 → 校验按分区拆成两个纯函数，并对"Renderer 缺失"与"Component 缺失"分别
  断言精确 issue 路径。

## 迁移计划

不升级 ComposeDocument v6，不做加载时迁移。未使用 Component 字段绑定的文档、宿主与 Preview 行为
完全不变。
