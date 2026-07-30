## ADDED Requirements

### Requirement: 节点引用属性 Schema 工厂

基础物料包 MUST 导出用于声明节点引用属性的同步 Schema 工厂，其产出的 Schema MUST 允许空值、
MUST 校验页面引用的完整形状，并 MUST 通过 metadata 指定 `node` 基础 editor。该工厂 MUST NOT 要求
`core` 依赖 Schema 库。

#### Scenario: 声明节点引用属性

- **WHEN** 物料以该工厂声明一个节点引用属性并渲染 Inspector
- **THEN** 该字段使用 node 基础 editor
- **AND** 空值与完整页面引用都通过校验，字段缺失或类型错误的引用不通过校验

### Requirement: Page Slot 基础物料

基础物料包 MUST 提供 Page Slot 物料，其含唯一的节点引用属性用于指向一个页面。Page Slot
MUST 通过渲染上下文的页面文档加载端口加载被引用页面，并 MUST 递归渲染该页面的根实体。
Page Slot MUST 在编辑模式下使嵌套内容整体不参与命中测试。未设置引用或未注入加载端口时
MUST 呈现可访问的占位状态。

#### Scenario: 渲染被引用页面

- **WHEN** Page Slot 的引用指向一个含内容的页面且加载端口已注入
- **THEN** 该页面的每个根实体都在 Page Slot 内渲染，并各自按其几何绝对定位
- **AND** 容器实体递归渲染其 `Hierarchy` 子节点
- **AND** 不可见实体及其子树不渲染
- **AND** 预览与编辑画布中呈现的实体逐个一致

#### Scenario: 编辑态不抢命中测试

- **WHEN** Page Slot 在编辑模式下渲染嵌套内容，用户在其区域内按下指针
- **THEN** 命中的是 Page Slot 实体本身
- **AND** 嵌套内容不接收指针事件

#### Scenario: 未设置引用

- **WHEN** Page Slot 的引用为空，或未注入加载端口
- **THEN** 呈现可访问的占位状态
- **AND** 不发起任何加载

### Requirement: Page Slot 加载状态与嵌套护栏

Page Slot MUST 覆盖加载中、加载失败、目标页面为空与加载成功四种状态，加载失败 MUST 提供重试入口
并以警示语义呈现。Page Slot MUST 依据祖先页面链与深度上限阻断循环引用与超出深度的嵌套，被阻断时
MUST 以警示语义呈现且 MUST NOT 发起加载。引用变化或组件卸载后的迟到结果 MUST 被丢弃。

#### Scenario: 加载中与加载成功

- **WHEN** Page Slot 开始加载被引用页面
- **THEN** 先呈现具备忙碌语义的加载状态
- **AND** 加载完成后替换为页面内容

#### Scenario: 加载失败可重试

- **WHEN** 页面文档加载失败
- **THEN** 以警示语义呈现失败状态并提供重试入口
- **AND** 重试重新发起加载

#### Scenario: 目标页面为空

- **WHEN** 被引用页面不含任何根实体
- **THEN** 呈现可访问的空状态

#### Scenario: 阻断循环引用

- **WHEN** Page Slot 直接或间接引用了祖先链中已存在的页面
- **THEN** 以警示语义呈现循环引用状态
- **AND** 不发起加载且不进入无限递归

#### Scenario: 阻断超出深度

- **WHEN** 嵌套深度达到深度上限
- **THEN** 以警示语义呈现超出深度状态
- **AND** 不再向下加载

#### Scenario: 丢弃迟到结果

- **WHEN** 组件在加载完成前卸载，或引用在加载期间变化
- **THEN** 迟到结果被丢弃
- **AND** 不产生卸载后的状态更新

### Requirement: 页面拖入画布创建 Page Slot

基础物料包 MUST 允许把页面文件从资源面板拖入画布以创建 Page Slot 实体。创建的实体 MUST 携带指向
该页面的引用；能够读取被引用页面的输出尺寸时 MUST 以该尺寸作为初始尺寸，否则 MUST 使用默认尺寸。
非页面文件 MUST NOT 被 Page Slot 接受。

#### Scenario: 拖入页面创建实体

- **WHEN** 用户把一个页面文件拖入画布空白处并放置
- **THEN** 创建一个引用该页面的 Page Slot 实体
- **AND** 其初始尺寸取被引用页面的输出尺寸

#### Scenario: 拒绝非页面文件

- **WHEN** 拖入的文件不是页面文件
- **THEN** Page Slot 不接受该拖入
- **AND** 既有的图片等物料拖入行为不受影响
