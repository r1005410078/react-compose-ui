## ADDED Requirements

### Requirement: 宿主接管 Stage 快捷键动作

`ComposeStage` MUST 接受可选的快捷键动作接管回调。命中某个可配置动作时，Stage MUST 先询问宿主；
宿主表示已接管时 Stage MUST 阻止浏览器默认行为并停止内建处理，不得重复执行。宿主未接管或未提供
该回调时，Stage MUST 保持既有内建实现。

按住不放的临时平移 MUST NOT 参与接管，始终由 Stage 自身的手势生命周期处理。方向键微调与 Escape
取消不属于可配置动作，同样不参与接管。

#### Scenario: 宿主接管编辑动作

- **WHEN** 宿主提供接管回调并对 group 动作返回已接管
- **THEN** Stage 不再自行规划或派发 group 命令
- **AND** 浏览器默认行为被阻止，事务由宿主一侧产生

#### Scenario: 宿主拒绝接管

- **WHEN** 宿主提供接管回调但对某个动作返回未接管
- **THEN** Stage 继续执行该动作的内建实现
- **AND** 行为与未提供回调时一致

#### Scenario: 临时平移不受接管影响

- **WHEN** 宿主提供接管回调并按住临时平移键拖动
- **THEN** Stage 仍按自身手势生命周期临时平移 viewport
- **AND** 接管回调不会因该动作被调用

#### Scenario: 独立使用保持内建行为

- **WHEN** 宿主未提供接管回调
- **THEN** 全部既有 Stage 快捷键行为不变
