# asset-browser Specification

## Purpose
TBD - created by archiving change add-asset-browser. Update Purpose after archive.
## Requirements
### Requirement: Asset Provider 协议

`@compose-ui/asset-browser` MUST 提供单根、异步、可取消的 `ComposeAssetProvider` 协议和稳定
entry/capability/error 类型。list 与 read MUST 支持 AbortSignal；写入 MUST 使用 revision
进行乐观并发。资源状态 MUST NOT 进入 ComposeDocument、History 或 Operation Log。

#### Scenario: 使用宿主 Provider

- **WHEN** 宿主向 AssetBrowser 提供一个 Provider
- **THEN** Browser 按文件夹懒加载 entries 并通过 Provider 执行全部文件操作
- **AND** Browser 不创建文档事务或编辑器历史

#### Scenario: 拒绝并发覆盖

- **WHEN** writeFile 的 expectedRevision 已过期且 force 未启用
- **THEN** Provider 以 conflict 拒绝写入
- **AND** Browser 提供重新载入、确认强制覆盖或取消，不静默丢弃任一版本

### Requirement: 文件树与资源网格

AssetBrowser MUST 使用公共 Tree 在左侧显示懒加载文件树，在右侧为文件夹显示直属子项缩略图
网格。选择、展开和 split 尺寸 MUST 属于当前 Browser 会话；异步迟到结果不得覆盖新选择。

#### Scenario: 浏览目录

- **WHEN** 用户展开目录并在树或网格中选择文件夹
- **THEN** Browser 只加载所需目录并按文件夹优先、locale 名称排序
- **AND** 右侧显示该文件夹直属子项网格

#### Scenario: 快速切换资源

- **WHEN** 第一个 list/read 尚未完成时用户选择另一个资源
- **THEN** 前一个请求被取消或其结果被忽略
- **AND** 右侧只显示最新选择对应内容

### Requirement: 图片、SVG 与未知文件预览

Browser MUST 使用 `<img>` 和可回收 Blob URL 预览 SVG 与浏览器支持的图片，不得使用
`dangerouslySetInnerHTML` 注入 SVG。未知二进制文件 MUST 显示元数据和下载入口。

#### Scenario: 安全预览 SVG

- **WHEN** 用户选择 SVG 文件
- **THEN** Browser 通过 `<img src="blob:…">` 显示内容
- **AND** SVG markup 不进入宿主 DOM，切换或卸载后 Blob URL 被回收

#### Scenario: 查看不支持文件

- **WHEN** 用户选择首期不支持预览的二进制文件
- **THEN** Browser 显示名称、类型、大小、修改时间和下载入口
- **AND** 不尝试把内容作为文本或图片执行

### Requirement: Monaco 脚本编辑

Browser MUST 为 JS、JSX、TS、TSX、JSON、CSS、SCSS、HTML 与 Markdown 动态加载 Monaco。
编辑 MUST 产生 dirty 状态并只在 primary+S 或明确保存时写入；切换、删除和关闭 dirty 文件前
必须选择保存、放弃或取消。Theme MUST 跟随共享 Context。

#### Scenario: 按需加载并保存脚本

- **WHEN** 用户在未打开过脚本的 Browser 中浏览图片后再选择 TypeScript 文件
- **THEN** 图片流程不加载 Monaco，选择脚本时才加载 Monaco 与所需 worker
- **AND** 编辑后 primary+S 使用当前 revision 保存并清除 dirty 状态

#### Scenario: 处理未保存切换

- **WHEN** 当前脚本 dirty 且用户选择另一个资源
- **THEN** Browser 显示保存、放弃和取消选择
- **AND** 取消保持当前编辑器和选择，保存或放弃后才完成切换

### Requirement: 完整首期资源操作

Browser MUST 支持新建文件、新建目录、文件导入、重命名、移动、递归删除和脚本写入。方法或
entry capability 不允许时入口 MUST 禁用。同名目标 MUST 拒绝且不得覆盖；多项操作 MUST 报告
每项成功或失败。

#### Scenario: 管理资源

- **WHEN** 用户通过工具栏、菜单、键盘或拖拽执行合法资源操作
- **THEN** Browser 调用对应 Provider 方法并刷新受影响目录
- **AND** rename/move 返回新 ID 时选择跟随返回 entry

#### Scenario: 确认删除并报告部分失败

- **WHEN** 用户确认删除多个文件和非空目录且部分 Provider 调用失败
- **THEN** Browser 对目录请求 recursive 删除并保留成功结果
- **AND** 界面精确报告成功数、失败项和原因

### Requirement: File System Access 适配器

包 MUST 提供支持检测、目录选择和从 DirectoryHandle 创建 Provider 的公共 API。适配器 MUST
支持 list/read/create/import/write/delete，不得自动持久化 handle。move/rename 只有运行时明确
支持时才启用，不得使用复制后删除回退。

#### Scenario: 打开本地目录

- **WHEN** 用户在安全上下文和用户手势中授权 readwrite 目录
- **THEN** Browser 在当前实例浏览和修改该目录
- **AND** 卸载或刷新后包不从 IndexedDB 自动恢复 handle

#### Scenario: 浏览器不支持本地移动

- **WHEN** 普通磁盘 handle 不提供稳定 move/rename
- **THEN** 适配器关闭对应 capability 并显示原因
- **AND** 其他读取、写入、新建、导入和删除能力继续可用
