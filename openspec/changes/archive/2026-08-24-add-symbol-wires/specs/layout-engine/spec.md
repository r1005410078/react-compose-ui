# layout-engine 规范增量

## MODIFIED Requirements

### Requirement: 确定的运行时状态

Runtime MUST 以 loading、ready 或 error 描述引擎状态，允许注入 loader，并在失败时保留明确错误而
不是生成旧 Transform fallback。

`ready` 状态里的文档与快照 MUST 是**同一次求解的一致对**，订阅方 MUST 能把它们直接配对使用。
导线解算 MUST 发生在这一对之内：先解布局、再按快照解算导线几何、再把导线自己的盒补回快照。
导线是绝对定位，改它的盒不影响任何其他 Entity 的求解，因此 MUST NOT 触发二次求解。

**求解 MUST NOT 分散到各个渲染入口**：导线解算既改文档又改快照，两者分头产出会让命中读到的盒
与渲染画出的几何差一帧，而这类偏差只在拖动符号的那一瞬出现、极难复现。Runtime 是唯一同时握有
两者的地方。

#### Scenario: Yoga 加载失败
- **WHEN** 注入的 engine loader 拒绝
- **THEN** Runtime 进入 error 并通知订阅方
- **AND** 不产生伪 Snapshot 或文档事务

#### Scenario: 导线随实例位置在同一对里更新
- **WHEN** 一个被导线绑定的实例改变位置后 Runtime 重新求解
- **THEN** `ready` 状态的文档里导线端点已落在端口新位置
- **AND** 同一状态的快照里导线的盒与该几何一致
