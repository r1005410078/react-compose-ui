## MODIFIED Requirements

### Requirement: Component Asset v1 判别协议

系统 MUST 以 `application/vnd.compose-ui.component+json` 和 `.component.json` 保存严格
`schemaVersion: 2` 的 Base/Variant 判别联合。Base MUST 保存稳定 ID、名称与 ComposeDocument v7；
该文档 MUST 恰好有一个根，且该根 MUST 拥有 `Frame` Component。Variant MUST 保存同 Provider 的直接
父引用、appliedLineage、规范操作和 resolvedSnapshot。Parser MUST 只验证当前文件；`schemaVersion: 1`
文件、缺少 `kind` 的旧草案以及含 `properties` 暴露属性的旧文件只能显式迁移。

#### Scenario: 解析 Base 与 Variant

- **WHEN** Parser 收到合法 Base 或 Variant 组件文件
- **THEN** 返回对应判别分支及稳定引用所需字段
- **AND** 不访问 Provider 或解析父链

#### Scenario: 要求单个 Frame 根

- **WHEN** Base 文档的唯一根拥有 `Frame` Component
- **THEN** Parser 接受该文档
- **AND** 多根文档以及根不是 Frame 的文档被拒绝并返回稳定 issue

#### Scenario: v1 到 v2 显式迁移

- **WHEN** 宿主对 `schemaVersion: 1` 的 Base 文件执行显式迁移
- **THEN** 若原根已是带 `Frame` 的 Container 则原地通过，否则包一层 Frame，`Frame.size` 取原根
  `Transform.size` 且原根成为唯一子级
- **AND** 普通解析对 v1 文件返回结构化 legacy issue，且迁移不修改输入

#### Scenario: 拒绝旧草案并显式迁移

- **WHEN** 文件缺少 `kind` 但满足历史草案结构
- **THEN** 普通解析返回结构化 legacy issue
- **AND** 显式迁移返回等价 `kind: "base"` 候选且不修改输入

#### Scenario: 暴露属性显式迁移

- **WHEN** Base 文件含 `properties` 暴露属性声明
- **THEN** 普通解析返回结构化 legacy issue
- **AND** 显式迁移删除该字段且不改变文档内容

### Requirement: 组件继承解析

Resolver MUST 按 Base、从根到叶 Variant 的顺序应用操作，并分别返回 `resolved`、`orphaned`、
`invalid` 或 `pending-update`。Variant MUST 与父源位于同 Provider 和兼容 scope，继承最多八层；
缺父源可使用保存快照，循环、超深和非法操作不得产生有效解析文档。解析结果 MUST 保持单个 Frame 根；
任何使根失去 `Frame` Component 或产生多根的操作 MUST 被判定为非法。

#### Scenario: 解析多层 Variant

- **WHEN** Variant 链具有可达父源、合法 lineage 和操作
- **THEN** 返回根到叶确定应用后的单 Frame 根 v7 文档与继承属性定义

#### Scenario: 父源离线

- **WHEN** Variant 的父源不可读取但 saved resolvedSnapshot 合法
- **THEN** 返回 orphaned 并允许使用该快照渲染

#### Scenario: 拒绝循环与超深继承

- **WHEN** 父链形成循环、跨 Provider 或包含超过八个资源
- **THEN** 返回 invalid 和稳定 issue，且不返回半解析文档

#### Scenario: 拒绝破坏 Frame 根的操作

- **WHEN** 某个 Variant 操作移除根的 `Frame` Component 或把根替换为多个 Entity
- **THEN** 返回 invalid 与稳定 issue
- **AND** 不返回半解析文档

## ADDED Requirements

### Requirement: Frame 资产即模板

系统 MUST NOT 为模板引入独立协议：模板即一个 Frame 组件资产，复用既有 Base/Variant 代数。
一次性模板 MUST 通过 detach 实现——把实例展开为普通 Entity 树并解除与源资产的继承关系，
展开后的根 MUST 保留其 `Frame` Component。持续跟随的模板即 Base，多分辨率或多状态模板即 Variant。

#### Scenario: 一次性模板 detach

- **WHEN** 用户对某个 Frame 资产的实例执行 detach
- **THEN** 实例被替换为等价的普通 Entity 子树，根仍是 Frame
- **AND** 后续修改源资产不再影响该子树，且操作可撤销

#### Scenario: 持续跟随的模板

- **WHEN** 用户修改作为模板的 Base 组件并 Apply
- **THEN** 所有未 detach 的实例按既有 Apply 语义更新
- **AND** 实例上的 `instanceOverrides` 按既有规则保留

### Requirement: 组件实例与 Page Slot 统一为 Frame 引用嵌套

组件实例与 Page Slot MUST 使用同一套 Frame 引用嵌套语义：两者都引用一个 Frame（组件资产的根
Frame，或目标页面的默认 Frame），都以被引用 Frame 为坐标、布局、裁剪、动画与脚本作用域边界，
都使用 `实例ID/内部ID` 复合地址在编辑期寻址内部层级。持久化文档中两者都 MUST 是单个 Entity。
循环引用与超出深度的嵌套 MUST 被阻断并以警示语义呈现。

#### Scenario: 两种嵌套共享寻址

- **WHEN** 用户在场景树中分别展开一个组件实例和一个 Page Slot
- **THEN** 两者内部层级都以 `实例ID/内部ID` 复合地址呈现为只读子树
- **AND** Undo/Redo 都作用在宿主实体的 Patch 上

#### Scenario: 阻断循环嵌套

- **WHEN** 某个 Frame 直接或间接引用了包含自身的 Frame
- **THEN** 嵌套被阻断并呈现警示占位
- **AND** 文档仍可渲染其余内容
