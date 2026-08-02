# asset-browser Specification

## Purpose
TBD - created by archiving change add-asset-browser. Update Purpose after archive.
## Requirements
### Requirement: Asset Provider 协议
The asset browser package MUST export compose-prefixed UI contracts only and MUST NOT re-export asset Provider,
resolver, reference or protocol types owned by `@compose-ui/assets`.

#### Scenario: Canonical resource protocol import
- **WHEN** a consumer configures a ComposeAssetBrowser provider or resolver
- **THEN** it imports those protocol types and factories from `@compose-ui/assets`

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

### Requirement: 资源 Canvas 拖拽意图

Asset Browser MUST 从文件树和目录网格发出普通数据的 start/move/end/cancel Canvas 拖拽事件，
且 MUST NOT 依赖 Stage、Core 或 ComposeDocument。内建可拖拽范围为受支持图片，宿主 MUST 能通过
判定回调放宽该范围；该回调只对已满足可引用能力、文件类型与稳定资源 key 的条目调用。只要产出
可拖拽条目，拖拽 MUST 写入始终填充的稳定引用载荷，其内容为带版本号的引用条目集合；既有的内部
移动 id 载荷语义保持不变。

#### Scenario: 拖动单项或多项图片

- **WHEN** 用户拖动 SVG 或受支持位图，且当前多选包含其他兼容图片
- **THEN** start 事件按选择顺序包含兼容且可引用的文件
- **AND** 脚本、目录与不支持文件被排除

#### Scenario: 资源内部移动不创建节点

- **WHEN** 同一拖拽落到 Asset Browser 内的合法目录
- **THEN** Provider move 正常执行
- **AND** Canvas 生命周期以 cancel 结束

#### Scenario: 宿主放宽可拖拽范围

- **WHEN** 宿主通过判定回调接受某类非图片文件，用户拖动该文件
- **THEN** start 事件包含该文件
- **AND** 内建白名单已接受的受支持图片仍然可拖 —— 该回调只放宽范围，不替换白名单
- **AND** 既不在内建白名单、又未被宿主接受的文件被排除

#### Scenario: 写入稳定引用载荷

- **WHEN** 拖拽产出至少一个可拖拽条目
- **THEN** 拖拽数据包含带版本号的稳定引用载荷
- **AND** 该载荷在条目不可移动时同样被写入
- **AND** 内部移动 id 载荷仍只包含可移动条目

### Requirement: 资源右键菜单快捷键提示

资源浏览器 MUST 在右键菜单中为与现有键盘处理器完全对应的动作显示快捷键。

#### Scenario: 显示重命名和删除键位
- **WHEN** 用户在资源树或目录网格打开资源右键菜单
- **THEN** 重命名显示 `F2`，删除显示 `Delete`

### Requirement: 宿主上下文菜单项扩展

Asset Browser MUST 允许宿主追加上下文菜单项，且宿主项 MUST 排在内建项之后。菜单项 MUST 能按
规范化的条目上下文声明可见性与禁用状态。传给菜单项的上下文 MUST 提供命中条目、归一化选择集合、
用于新建的父目录 id、复用内建命名对话框与名称校验的取名入口，以及请求重新列举目录的入口，且
MUST NOT 暴露 React 事件对象、DOM 元素或任何文档语义类型。

#### Scenario: 宿主项排在内建项之后

- **WHEN** 宿主提供上下文菜单项并在条目上右键
- **THEN** 内建的新建、重命名与删除项先出现，宿主项随后出现
- **AND** 声明为不可见的宿主项不渲染

#### Scenario: 复用内建命名对话框

- **WHEN** 宿主菜单项通过上下文请求取名
- **THEN** 弹出与内建新建一致的命名对话框并执行相同的名称校验
- **AND** 用户确认返回名称，取消返回空结果

#### Scenario: 空白区域打开菜单

- **WHEN** 用户在文件树或目录网格的空白区域右键
- **THEN** 菜单打开，且新建项按当前目录的能力启用
- **AND** 上下文的命中条目为空，新建应使用的父目录为当前目录
- **AND** 重命名与删除渲染为禁用

#### Scenario: 宿主写入后刷新目录

- **WHEN** 宿主菜单项完成写入后通过上下文请求刷新
- **THEN** 对应目录被重新列举
- **AND** 新条目在文件树与目录网格中可见

### Requirement: 条目图标插槽

Asset Browser MUST 允许宿主覆盖条目主图标。该插槽 MUST 同时作用于文件树与目录网格，
MUST 接收包含条目、所在表面、选中态与展开态的规范化上下文。宿主未提供或返回空结果时
MUST 回退到内建目录与文件图标。

#### Scenario: 树与网格同时使用宿主图标

- **WHEN** 宿主为某条目返回一个图标节点
- **THEN** 文件树行与目录网格块都使用该图标

#### Scenario: 回退内建图标

- **WHEN** 宿主未提供图标插槽或对该条目返回空结果
- **THEN** 渲染内建目录或文件图标

### Requirement: 条目名称插槽

Asset Browser MUST 允许宿主覆盖条目显示名称。该插槽 MUST 同时作用于文件树与目录网格；
条目的 `title` 与可读名 MUST 仍基于原始名称，使用户能在需要时看到真实存储名。宿主未提供或
返回空结果时 MUST 显示原始名称。

#### Scenario: 宿主覆盖显示名

- **WHEN** 宿主为某条目返回一个显示名称
- **THEN** 文件树行与目录网格块都显示该名称
- **AND** 该条目的 title 仍为原始名称

#### Scenario: 回退原始名称

- **WHEN** 宿主未提供名称插槽或对该条目返回空结果
- **THEN** 显示条目的原始名称

### Requirement: 条目名称转换

Asset Browser MUST 允许宿主提供条目名称在重命名输入与存储之间的双向转换。重命名对话框的初始值
MUST 取宿主给出的可编辑名称，提交时 MUST 先由宿主还原为存储名称再调用 Provider。未提供转换时
MUST 直接使用条目原始名称与用户输入。

#### Scenario: 命名约定不进入输入框

- **WHEN** 宿主为某条目提供可编辑名称与存储名称的转换，用户对其执行重命名
- **THEN** 输入框的初始值为可编辑名称，不含宿主的命名约定
- **AND** 提交后 Provider 收到由宿主还原的存储名称

#### Scenario: 未提供转换

- **WHEN** 宿主未提供名称转换
- **THEN** 输入框初始值为条目原始名称，提交后 Provider 收到用户输入原文

### Requirement: File System 适配器的媒体类型映射

File System Access 适配器 MUST 允许宿主注入由文件名与浏览器推断类型决定上报媒体类型的回调。
未注入时 MUST 沿用浏览器推断结果。

#### Scenario: 宿主映射领域媒体类型

- **WHEN** 宿主注入映射回调，把某命名约定映射为领域媒体类型
- **THEN** 该适配器为匹配的文件上报该媒体类型
- **AND** 未匹配的文件仍沿用浏览器推断结果

### Requirement: 条目标记插槽

Asset Browser MUST 允许宿主在条目名称之后渲染附加标记。该插槽 MUST 同时作用于文件树与目录网格，
MUST 接收包含条目、所在表面、选中态与展开态的规范化上下文，且标记 MUST NOT 参与命中测试。
宿主未提供或返回空结果时条目 MUST 保持内建呈现。

#### Scenario: 树与网格同时渲染标记

- **WHEN** 宿主为某条目返回一个标记节点
- **THEN** 文件树行与目录网格块都渲染该标记
- **AND** 点击标记区域仍按条目本身处理

#### Scenario: 未提供标记

- **WHEN** 宿主未提供标记插槽或对该条目返回空结果
- **THEN** 条目按内建方式呈现且不产生额外元素

### Requirement: 只读资源预览

Asset Browser 的资源预览 MUST 支持只读模式。只读模式下脚本编辑器 MUST 禁止输入与写入、MUST NOT
注册保存快捷键、MUST NOT 上报脏状态，其保存入口 MUST 空转成功而不写入 Provider。只读模式
MUST NOT 改变图片与未知文件分支的呈现。

#### Scenario: 只读脚本编辑器

- **WHEN** 以只读模式打开一个脚本类文件
- **THEN** 编辑器内容不可修改且不上报脏状态
- **AND** 触发保存不产生任何 Provider 写入

