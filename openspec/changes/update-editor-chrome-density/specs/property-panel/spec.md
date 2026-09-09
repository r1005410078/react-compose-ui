## ADDED Requirements

### Requirement: 搜索工具带的宿主动作槽

`ComposePropertyPanelRoot` MUST 接受一个 `toolbarActions` 槽，渲染在**搜索工具带这一行**的
右端，MUST NOT 在它上面或下面另起一条。缺席时这一行的布局 MUST 与今天逐像素相同——它是一个
可选槽，不是新的常驻结构。

槽的内容由宿主给出，本包 MUST NOT 对它做任何领域假设：它不认识实体、能力或组件实例。

#### Scenario: 不传时布局不变

- **WHEN** 宿主不提供 `toolbarActions`
- **THEN** 搜索、筛选与显示设置的位置与尺寸不变

#### Scenario: 传入时与搜索同行

- **WHEN** 宿主提供两个按钮作为 `toolbarActions`
- **THEN** 它们出现在筛选与显示设置之后、同一行的右端
- **AND** 面板没有因此多出一行
