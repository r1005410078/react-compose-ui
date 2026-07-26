# 变更：新增 Asset Browser 与共享 Tree 组件

## 原因

编辑器缺少独立的资源浏览、文件管理和资源预览入口，现有 SceneTree 又把通用树交互与场景
可见性、锁定及结构命令耦合在同一包内，无法安全复用于文件系统。需要先抽出稳定的通用 Tree，
再建立不进入 ComposeDocument 的资源 Provider 与 Asset Browser。

## 变更内容

- 新增 `@compose-ui/components`，提供受控、虚拟化、可拖排的通用 React Tree。
- 让 `@compose-ui/scene-tree` 组合公共 Tree，同时保持现有公共 API、行为和视觉。
- 新增 `@compose-ui/asset-browser`，支持目录树、文件夹网格、图片/SVG 预览、Monaco 脚本编辑
  以及资源新建、导入、重命名、移动、删除和显式保存。
- 提供宿主 `ComposeAssetProvider` 协议与浏览器 File System Access 适配器。
- 在 Editor 底部 Edge Group 增加 inactive 的“资源 / Assets”标签和显式覆盖插槽。
- **BREAKING**：无；现有 SceneTree 与 Editor 输入保持兼容，本次只新增公共成员和包依赖。

## 影响

- 受影响的规范：`components`、`asset-browser`、`scene-tree`、`editor-workspace-layout`、
  `editor-preferences`
- 受影响的代码：新 packages、SceneTree 内部结构、Editor Dockview、示例、发布与测试配置
- 新外部依赖：`monaco-editor`
