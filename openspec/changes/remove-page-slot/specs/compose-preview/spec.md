## REMOVED Requirements

### Requirement: 嵌套页面脚本实例隔离

**原因**：该需求只约束 Page Slot 的递归渲染与每槽位独立 setup scope。Page Slot 已删除。

**迁移**：页面之间的脚本实例隔离改由 `ComposePageHost` 在切页时保证——上一页的 scope
在新页 scope 建立前被 dispose。组件实例的隔离由「组件实例预览」需求独立承担。

## MODIFIED Requirements

### Requirement: Preview 页面文档加载注入

Preview MUST 接受可选的页面加载端口，供页面导航按页面引用加载目标页面。Preview MUST NOT
自行实现页面加载逻辑，也 MUST NOT 因此依赖 `editor`、`stage` 或页面 Store 实现包——端口
类型来自 `core`，实现来自 `@compose-ui/pages`。未注入端口时 Preview MUST 正常渲染当前文档。

Preview MUST NOT 再把该端口注入 Registry 渲染上下文，也 MUST NOT 递归渲染任何"引用了页面
的实体"——页面嵌套已被删除，端口现在只服务导航。

#### Scenario: 注入端口供导航加载

- **WHEN** 宿主向 Preview 注入页面文档加载端口并发生跳转
- **THEN** 目标页面通过该端口加载
- **AND** Preview 不为文档中的任何实体递归加载其他页面

#### Scenario: 未注入端口

- **WHEN** 宿主未注入页面文档加载端口
- **THEN** Preview 正常渲染当前文档的全部内容
- **AND** 不发起任何页面加载

### Requirement: Preview 只渲染 WidgetSwitcher 的活动子项

Preview MUST 跳过 core 派生的隐藏集合中的 Entity，只渲染每个 WidgetSwitcher 的活动子项。Preview
MUST NOT 应用任何编辑期预览覆盖——运行期只认 `activeIndex`。嵌套文档 Runtime（Component Instance）
MUST 遵守同一规则。

#### Scenario: 运行期只显示活动子项

- **WHEN** Preview 渲染含三个子项、`activeIndex` 为 1 的 WidgetSwitcher
- **THEN** 只有第二个子项及其后代出现在输出中

#### Scenario: 嵌套文档中的 switcher

- **WHEN** Component Instance 的内部文档含 WidgetSwitcher
- **THEN** 嵌套 Runtime 同样只渲染其活动子项

### Requirement: Preview 嵌套 Frame 动画播放

ComposePreview MUST 按 Frame 播放动画：每个 Frame 使用自己 `Animations` 清单中的动画和自己的
时间轴。嵌套 Frame（组件实例）MUST 拥有独立播放状态，宿主 MUST 只能通过播放控制
（play/pause/seek/mode）影响嵌套 Frame，MUST NOT 采样或覆写嵌套 Frame 内部 Entity 的属性。

#### Scenario: 组件实例播放自己的动画

- **WHEN** 一个组件根 Frame 定义了动画，其实例被放入宿主 Frame 并预览
- **THEN** 实例按组件自身时间轴播放
- **AND** 宿主 Frame 的播放头不改变实例内部的采样结果

#### Scenario: 宿主控制嵌套播放状态

- **WHEN** 宿主对某个嵌套 Frame 发出 pause 与 seek
- **THEN** 该嵌套 Frame 停在指定时刻
- **AND** 宿主与其它嵌套 Frame 的播放状态不受影响
