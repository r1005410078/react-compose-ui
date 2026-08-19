## MODIFIED Requirements

### Requirement: Frame 动画关联写入

Frame MUST 支持可选的动画稳定资源引用：`Animations.source` 保存 providerId、assetKey 与
scope。解析 MUST 容忍字段缺失并归一化为 null，非 null 时 MUST 校验引用形状。多个 Frame
MAY 持有指向同一个文件的引用；宿主 MUST 能以关联、更换和解除三种操作原子改写**单个 Frame**
的引用，且 MUST NOT 因此改动其他 Frame 的引用。实现 MUST NOT 解析动画文件内容、
MUST NOT 根据文件名隐式猜测动画关系，也 MUST NOT 因解除引用自动删除动画资源。

`Animations.source` 是**文档状态**，因此 `@compose-ui/animation` MUST 提供一条改写它的文档
命令，使关联/更换/解除成为普通可撤销事务并立即对运行时文档生效。该命令 MUST 保留同一
Component 上的 `items`——`Animations` 整体写入，只写一半就会丢掉另一半。宿主 MUST NOT 要求
目标 Frame 已经存在于**上次保存**的页面文件中：刚创建、尚未保存的场景 MUST 同样可以绑定。

#### Scenario: 旧文档容缺解析

- **WHEN** 解析一个 `Animations` 不含 `source` 的既有文档
- **THEN** 解析成功且动画引用归一化为 null，清单与轨道不受影响

#### Scenario: 关联稳定动画引用

- **WHEN** 宿主把一个可引用动画文件关联到某个 Frame
- **THEN** `Animations.source` 写入其 providerId、assetKey 与持久性 scope
- **AND** 动画文件随后重命名或移动不改变该关联

#### Scenario: 解除动画不删除资源

- **WHEN** 用户解除某 Frame 当前的动画引用
- **THEN** `Animations.source` 被清空且轨道保持不变
- **AND** 原动画文件仍由 Asset Provider 保留

#### Scenario: 绑定写入保留清单

- **WHEN** 对一个已有清单的 Frame 关联或解除动画文件
- **THEN** 该 Frame 的 `Animations.items` 逐条保持不变

#### Scenario: 绑定可撤销

- **WHEN** 用户关联一个动画文件后撤销
- **THEN** `Animations.source` 回到关联前的值
- **AND** 动画文件资源不被删除
