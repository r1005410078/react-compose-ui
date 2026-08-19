## MODIFIED Requirements

### Requirement: 受约束的 Frame 升格入口

Editor MUST NOT 提供裸露的“升格为 Frame”命令。Container 升格为 Frame MUST 只作为以下四个
用户动作的隐含结果发生：从场景选择创建项目组件、新建场景、为该容器绑定动画、把该容器设为
独立导出目标。每次隐含升格 MUST 作为同一个可撤销事务的一部分，并 MUST 在 UI 中说明该容器
已成为独立作用域边界。「新建场景」MUST 同时可以由空间化操作触发：在所有场景之外新建一个
容器等价于新建场景。全部隐含升格入口 MUST 复用 core 的升格纯函数，MUST NOT 各自内联实现。

#### Scenario: 创建组件时隐含升格

- **WHEN** 用户对一个普通 Container 执行“从选择创建项目组件”
- **THEN** 该 Container 获得 `Frame` Component 且 id 与子级保持不变
- **AND** 升格与创建组件在同一个事务中，可一次撤销

#### Scenario: 不提供裸升格命令

- **WHEN** 用户在场景树或画布上右键一个普通 Container
- **THEN** 菜单中不出现独立的“升格为 Frame”项

#### Scenario: 在场景外新建容器即新建场景

- **WHEN** 用户在所有场景之外新建一个容器
- **THEN** 该容器直接以场景形态出现在 `rootIds` 中，而不是成为某块既有场景的子级
- **AND** 用户不需要先创建容器再执行任何额外的升格命令

## ADDED Requirements

### Requirement: 场景树根级落点

场景树的“根级”就是场景所在的那一层。在根级新建容器 MUST 得到一块新场景，其摆位 MUST 与
命令面板的「新建场景」一致。把已经是场景的 Entity 拖动或复制到根级 MUST 让它留在根级，
MUST NOT 塞进某块既有场景——否则在树里既无法给场景排序，也无法复制出一块平级的场景。
把非场景 Entity 落到根级时 MUST 解析为一块既有场景。

#### Scenario: 场景树根级新建容器

- **WHEN** 用户在场景树的根级新建一个容器
- **THEN** 场景树根层多出一块场景，与既有场景平级，摆在既有场景右侧

#### Scenario: 在场景树里给场景排序

- **WHEN** 用户把第二块场景拖到根级第一位
- **THEN** 它仍然是一块根场景，只是顺序变了，而不是成为第一块场景的子级

#### Scenario: 复制场景得到平级场景

- **WHEN** 用户在场景树里复制一块场景
- **THEN** 副本是一块与它平级的根场景

### Requirement: 场景与容器同图标

场景树、拖拽预览与其余按 `Composition.presetId` 取图标的位置 MUST 为场景与容器呈现同一个
图标——场景就是放在顶层的容器。Registry MUST 注册与场景 `presetId` 对应的 Preset，使这些
位置 MUST NOT 掉到通用兜底图标。可访问名称 MUST 仍然区分场景与容器。

#### Scenario: 场景行与容器行图标一致

- **WHEN** 场景树同时显示一块场景与一个普通容器
- **THEN** 两行使用同一个图标
- **AND** 两行的可访问名称仍分别表述为场景与容器
