# components Specification

## Purpose
TBD - created by archiving change add-asset-browser. Update Purpose after archive.
## Requirements
### Requirement: 通用受控虚拟 Tree

`@compose-ui/components` MUST 提供无场景和资源领域语义的泛型 React Tree。Tree MUST 接受受控
items、selection 与 expansion，通过 adapter 读取稳定 ID、label、children 和能力，并通过插槽
渲染图标、标签与尾部操作。组件 MUST 支持至少 5000 个可见节点的虚拟化。

#### Scenario: 渲染大型受控树

- **WHEN** 宿主传入包含 5000 个可见节点的树及受控选择和展开状态
- **THEN** Tree 只挂载当前 viewport 与 overscan 对应的虚拟行
- **AND** 选择和展开变化只通过回调请求宿主更新

#### Scenario: 组合领域行内容

- **WHEN** SceneTree 或 AssetBrowser 提供 icon、label 和 actions 插槽
- **THEN** Tree 保留统一缩进、展开控件、焦点、选择和 ARIA
- **AND** 插槽可以显示自己的领域内容而不取得 Tree 内部状态所有权

### Requirement: Tree 选择、键盘与过滤

Tree MUST 支持单选、primary 切换、Shift 连续选择、方向键导航、Home/End、左右键展开收起和
Enter 激活。过滤 MUST 保留匹配节点的祖先并把结果路径视为展开，不得改写宿主 expandedIds。

#### Scenario: 使用键盘浏览和选择

- **WHEN** 用户聚焦一行并使用方向键、Home、End、Enter 或带修饰键的选择
- **THEN** 焦点、激活和受控选择按可见树顺序更新
- **AND** 输入控件和 contenteditable 保留原生键盘行为

#### Scenario: 过滤树并保留路径

- **WHEN** filter 只匹配一个深层节点
- **THEN** 结果包含该节点及全部祖先并显示完整路径
- **AND** 过滤结束后使用原受控展开状态

### Requirement: Tree 拖排与可访问性

Tree MUST 提供可选 Pointer 拖排，生成包含顶层 itemIds、parentId 与 index 的单次 move intent。
拖排 MUST 拒绝移入自身、后代、叶节点或宿主禁止的目标，并支持阈值、自动滚动、延迟展开、
pointer cancel 与 Escape 取消。Tree MUST 使用 treegrid/row、level、setsize、posinset、selected
和 expanded ARIA。

#### Scenario: 拖动多选项

- **WHEN** 用户拖动包含祖先和后代的多选集合到合法目标并松手
- **THEN** Tree 只提交顶层选择的一次 move intent
- **AND** 拖动期间显示目标和预览但不修改受控 items

#### Scenario: 取消或拒绝拖排

- **WHEN** Pointer 被取消、用户按 Escape，或目标会形成循环
- **THEN** Tree 清除预览且不提交 move intent
- **AND** 受控选择、展开和 items 保持不变
