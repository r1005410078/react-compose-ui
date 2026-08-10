## ADDED Requirements

### Requirement: Component Document v1
系统 MUST 以独立版本化 JSON 文件保存一个单根 ComposeDocument、稳定组件 ID 和显式属性定义，并严格拒绝非法版本、多个根、无效属性目标和循环嵌套。

#### Scenario: 解析合法项目组件
- **WHEN** 宿主读取合法的 `.component.json` 文件
- **THEN** 系统返回可序列化的 Component Document v1 和稳定引用

#### Scenario: 拒绝非法项目组件
- **WHEN** 文件包含多个根、无效暴露属性或循环组件引用
- **THEN** 系统返回结构化校验问题且不创建实例

### Requirement: 项目组件 Store
系统 MUST 从 Asset Provider 列举、读取、创建、保存和订阅项目组件，并保留取消、缓存与 revision 冲突语义。

#### Scenario: 列举项目组件
- **WHEN** Provider 同时包含普通文件和带稳定 assetKey 的组件媒体类型文件
- **THEN** Store 只返回可引用的项目组件描述并按稳定 key 排序

#### Scenario: 保存冲突
- **WHEN** 组件文件的 Provider revision 已变化
- **THEN** Store 拒绝普通保存并允许宿主显式选择重新载入或强制覆盖

### Requirement: 混合组件目录
组件面板 MUST 同时展示 Registry 中可见 Preset 与 Component Store 中的项目组件，并把两者转换为既有 Stage 外部创建意图。

#### Scenario: 无 Store 保持兼容
- **WHEN** 宿主未配置 Component Store
- **THEN** 面板继续只展示和创建 Registry Preset

#### Scenario: 拖入项目组件
- **WHEN** 用户点击或拖动项目组件到 Stage
- **THEN** 面板使用其稳定资源描述发出 assets 创建意图
