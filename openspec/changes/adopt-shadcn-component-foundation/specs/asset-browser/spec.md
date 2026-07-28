## ADDED Requirements

### Requirement: 资源浏览与显式打开预览分离

`ComposeAssetBrowser` MUST 将右侧固定为当前目录的直属资源网格。单击文件 MUST 只更新选择，且不得
读取文件内容、创建 Blob URL 或加载 Monaco。文件双击或键盘激活 MUST 仅调用一次 `onAssetOpen(entry)`；
目录激活 MUST 继续进入该目录。`ComposeAssetBrowser` MUST 提供异步 `onBeforeAssetMutation`，在 rename、
move 或 delete 前由宿主接受或拒绝整次操作。

#### Scenario: 单击文件仍保留目录网格

- **WHEN** 用户单击目录网格中的文件
- **THEN** Browser 更新选择且右侧继续显示同一目录网格
- **AND** Browser 不调用 Provider `read`，也不加载 Monaco

#### Scenario: 显式激活文件

- **WHEN** 用户双击文件或在 Tree/Grid 中以 Enter 激活文件
- **THEN** Browser 恰好调用一次 `onAssetOpen` 并传入该文件
- **AND** 目录仍保持当前浏览上下文

#### Scenario: 宿主阻止资源操作

- **WHEN** rename、move 或 delete 前的 `onBeforeAssetMutation` 返回 `false` 或 rejected Promise
- **THEN** Browser 不调用对应 Provider 方法
- **AND** 当前选择与目录网格保持不变

### Requirement: 独立资源预览组件

Asset Browser MUST 导出 `ComposeAssetPreview`，供宿主在显式资源文档中渲染图片、SVG、脚本和未知二进制。
它 MUST 保留 Blob URL、Monaco model、ResizeObserver 和迟到读取的释放保证，并通过 ref `save()` 返回保存是否
成功；图片或二进制的 `save()` MUST 成功且不得产生写入。

#### Scenario: 关闭资源预览

- **WHEN** 包含 `ComposeAssetPreview` 的资源文档卸载或切换资源
- **THEN** 已创建的 Blob URL、Monaco editor/model/监听器和异步读取均被清理
- **AND** 后续 Provider 结果不得更新已关闭的预览

### Requirement: 资源操作使用共享全视口 Dialog

Asset Browser 的新建/重命名、删除确认、未保存脚本决策和 revision 冲突 MUST 使用
`@compose-ui/components` 的 ComposeDialog 或 ComposeConfirmDialog。模态遮罩 MUST 通过 Portal 覆盖
完整浏览器窗口，不能被 Assets Dockview panel 裁剪；资源能力、Provider 调用、异步状态和原有业务
决策不得转移到共享组件。

#### Scenario: 在资源 Dockview 面板中打开文件名称表单

- **WHEN** 用户请求新建文件、新建目录或重命名资源
- **THEN** 名称表单以全视口遮罩上的居中 Dialog 显示，并在打开时聚焦名称输入
- **AND** 提交、取消与同名/权限错误行为保持原有 Provider 语义

#### Scenario: 在资源编辑流程中处理确认与冲突

- **WHEN** 用户删除资源、离开 dirty 脚本或遇到 revision conflict
- **THEN** 对应的共享 Dialog 显示全部可用决策并保留危险/禁用语义
- **AND** 选择保存、放弃、重新载入、强制覆盖或取消后仅执行原有的资源操作
