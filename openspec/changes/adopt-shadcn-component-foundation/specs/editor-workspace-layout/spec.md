## MODIFIED Requirements

### Requirement: 中央 Canvas Group 承载资源文档

默认 Editor 的中央 Canvas Group MUST 永远包含不可关闭的 Canvas panel，并可在同一 Group 创建临时、可关闭的
资源 document panel。资源 panel MUST 由 `provider.id + assetKey（缺失时 entry.id）` 唯一标识，重复打开同一
资源时 MUST 激活现有 panel 而非创建副本；panel MUST 使用 `renderer: 'always'` 以保留未保存 Monaco 草稿。
资源文档不参与 Dockview 拖放、浮动、布局持久化、ComposeDocument、History 或 Operation Log。

#### Scenario: 从默认资源浏览器打开资源

- **WHEN** 默认 Asset Browser 发出文件打开意图
- **THEN** Editor 在 Canvas Group 打开或激活对应资源 document panel
- **AND** Canvas panel 保持存在且不可关闭

#### Scenario: 关闭 dirty 资源文档或修改已打开资源

- **WHEN** 用户关闭 dirty 资源 tab，或重命名、移动、删除包含 dirty 已打开资源的条目
- **THEN** Editor 提供保存、放弃或取消决策，并只在保存成功或放弃后关闭资源 document
- **AND** 取消、保存失败或 revision conflict 不执行关闭或对应 Provider 操作

### Requirement: 设置入口保持布局独立

默认工作区左侧活动栏底部 MUST 提供可聚焦设置按钮。设置模态 MUST 使用
`@compose-ui/components` 的 ComposeDialog，通过全视口 Portal 覆盖当前浏览器窗口；它不得成为
Dockview 面板，也不得被任一 Edge Group、Canvas 或宿主 Editor root 的尺寸、overflow 或 stacking
context 裁剪。设置模态不得改变左侧 Edge Group 的展开尺寸、Dockview 布局或活动面板。

#### Scenario: 从活动栏打开设置

- **WHEN** 用户通过鼠标或键盘激活左下角设置按钮
- **THEN** 全视口遮罩上显示居中的设置弹框，且弹框内容使用 Compose Theme/I18n
- **AND** 当前 Edge Group、中央 Canvas 与其他面板保持挂载和原尺寸

#### Scenario: 更新设置期间保持布局

- **WHEN** 用户切换主题、语言或修改快捷键
- **THEN** Dockview group 和 panel 实例不被重建
- **AND** 用户已调整的尺寸、折叠状态与活动标签保持不变
