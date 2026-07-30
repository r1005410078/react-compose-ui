## MODIFIED Requirements

### Requirement: Compose Color/Paint Picker 与会话颜色历史

ComposePaintPicker MUST 在单个紧凑 Theme/I18n Popover 中提供 Solid、Gradient 和 Image 页签；不得打开嵌套 Picker 或全屏 Dialog。Gradient MUST 支持 2–8 个稳定、可选择、可移动和可删除的色标，并为 Linear、Radial 与 Angular 提供与其几何模型一致的直接操纵和精确输入。图片选择和上传 MUST 由宿主适配器完成，组件不得依赖 Asset Browser；当适配器提供完整图片集合时，Picker MUST 在同一 Popover 内提供无滚动分页选择。

#### Scenario: 完整管理渐变色标

- **WHEN** 用户添加、选择、拖动或删除 Gradient 色标
- **THEN** Picker 以稳定唯一 ID 提交按位置排序的 2–8 个色标
- **AND** 连续添加色标时使用最大空档中点并自动选中新色标
- **AND** 一次指针拖动最多提交一个受控值变化

#### Scenario: 编辑三类渐变几何

- **WHEN** 用户通过预览手柄、方向盘、快捷方向或精确输入编辑 Gradient
- **THEN** Linear 更新起止点，Radial 更新中心与水平/垂直半径，Angular 更新中心与起始角
- **AND** Pointer cancel、Escape 或外部值变化取消未提交草稿
- **AND** 默认折叠状态保持紧凑且没有内部滚动条

#### Scenario: 选择图片填充

- **WHEN** 用户在图片页选择最近图片或完成宿主上传
- **THEN** Picker 实时提交带稳定资源引用的 Image Paint
- **AND** 首次创建时使用填充、100% 图片透明度和 40% 紫色叠加，使图片设置卡完整呈现
- **AND** 用户可以编辑适配模式、透明度和颜色叠加

#### Scenario: 在 Popover 内浏览完整图片库

- **WHEN** 图片适配器提供超过四张可引用图片且用户选择浏览图片
- **THEN** Picker 在同一 Popover 内以每页八张展示图片并提供上一页和下一页
- **AND** 主图片页最多展示四张最近使用图片
- **AND** 主页面和资源页面均不产生横向或纵向内部滚动

#### Scenario: 替换图片并保留设置

- **WHEN** 当前值已经是 Image Paint 且用户选择另一张图片
- **THEN** Picker 仅替换稳定资源引用
- **AND** 保留当前适配模式、图片透明度和颜色叠加

#### Scenario: 图片资源加载与上传状态

- **WHEN** 图片适配器正在加载、加载失败、不支持稳定引用或不支持上传
- **THEN** Picker 显示对应的紧凑状态和可用操作
- **AND** 不可用操作被禁用而不是静默无响应
- **AND** 加载失败时用户可以重试

#### Scenario: 兼容宿主一次性资源选择器

- **WHEN** 旧宿主只提供最近图片和 onBrowse
- **THEN** Picker 继续调用宿主一次性资源选择器
- **AND** 不要求宿主迁移现有调用

### Requirement: Editor 图片资源自动适配

ComposeEditor MUST 在配置 Asset Provider 且未显式提供图片适配器时，自动派生 Picker 所需的图片列表和上传能力。自动适配 MUST 只写入稳定资源引用，并正确释放临时预览资源。

#### Scenario: 从 Provider 自动加载图片

- **WHEN** Editor 配置支持稳定引用的 Asset Provider
- **THEN** 默认 Inspector 图片页递归展示具有 assetKey 的图片文件
- **AND** 非图片文件、没有稳定引用的文件和无法解析的单项资源不会写入 Paint

#### Scenario: 上传图片到配置目录

- **WHEN** Provider 支持 createFile 且用户上传有效图片
- **THEN** Editor 把图片保存到配置的父目录或 Provider 根目录
- **AND** 重名文件使用最小可用数字后缀
- **AND** 成功后返回并选择稳定资源引用

#### Scenario: 显式图片适配器覆盖自动适配

- **WHEN** 宿主同时配置 Asset Provider 和 paintImageLibrary
- **THEN** 默认 Inspector 只使用显式 paintImageLibrary
- **AND** Editor 不启动 Provider 图片扫描或上传适配
