## ADDED Requirements

### Requirement: 适配层的用户能力按 Hook 划分

Stage 适配层中构成一条完整用户能力的逻辑 MUST 住在独立的 Hook 模块，MUST NOT 作为渲染函数
里的闭包依赖作用域捕获取得依赖——键盘操作是其中一条。

Hook 的参数对象 MUST 是它的完整依赖清单。它 MUST NOT 接受把多项依赖打包在一起的可变聚合
引用（例如「最新值」ref），否则依赖只是换了个位置继续隐藏。

#### Scenario: 键盘能力的依赖可从签名读出

- **WHEN** 阅读键盘 Hook 的参数类型
- **THEN** 该能力触达的文档、视口、控制器与宿主回调全部列在其中

#### Scenario: 判定次序属于行为

- **WHEN** 键盘动作级联被搬进 Hook
- **THEN** 分支次序与提前返回保持不变，因为次序本身决定了哪些分支可达

### Requirement: 方向键微调的命令规划可独立求值

方向键微调把选中对象的世界位移换算成 `setTransform` 更新，这段换算 MUST 是不依赖 React 的
纯函数，MUST 独立于键盘事件处理被断言。

换算 MUST 按 Entity 自身 offset 反推父级内容盒原点，MUST NOT 另按父级边框宽度再内缩一次
——边框已经含在求解位置里，重复计算会让对象每次微调都额外偏移。`fill` 尺寸 MUST 沿用求解
结果而非 authored 值，否则一次微调就把「填满父级」固化成固定尺寸。

#### Scenario: 给定文档与方向得到确定的更新

- **WHEN** 给定文档、布局快照、一组 Entity、方向与步长
- **THEN** 产出的更新完全由输入决定，不需要挂载任何组件

#### Scenario: Flow 子级不参与微调

- **WHEN** 选中项里包含 `positioning` 为 `flow` 的子级
- **THEN** 它被排除在更新之外，因为其位置由 Auto Layout 决定，写入 offset 只会产生空事务
