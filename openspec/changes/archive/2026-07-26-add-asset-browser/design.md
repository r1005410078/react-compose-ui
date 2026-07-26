## 上下文

Unity Project 双栏视图和 Unreal Content Browser 都把资源目录与场景层级分离。Compose UI
当前已有高密度 SceneTree，但其命令、锁定、可见性和 reparent 语义属于场景领域。资源文件还
需要异步加载、权限、冲突和二进制生命周期，不能进入 ComposeDocument 或复用场景事务。

## 目标/非目标

- 目标：提供可复用 Tree、完整首期资源管理、受控宿主 Provider、本地目录适配器和 Editor
  默认入口。
- 目标：图片路径不加载 Monaco；SVG 不注入 DOM；所有资源异步结果可取消。
- 非目标：资源撤销栈、复制粘贴、目录递归导入、多源、收藏、引用图或 ComposeNode 资源绑定。

## 决策

### 公共 Tree

`@compose-ui/components` 依赖 React、`@compose-ui/ui-context` 和 TanStack Virtual。Tree 接收
泛型 item、adapter、受控选择/展开和渲染插槽；内部拥有焦点、虚拟行、过滤、Pointer 拖排与
自动滚动。SceneTree 只保留工具栏、场景命令、右键菜单、可见性、锁定和场景文案。

### Asset Provider

Provider 使用不透明 ID 和单根目录，按文件夹懒加载。可变方法为可选，provider capability
与 entry override 共同决定 UI 是否允许操作。读文件返回 Blob 与 revision；写文件携带
expectedRevision，冲突必须显式重载、强制覆盖或取消。多项操作逐项执行并报告部分失败。

Provider 是资源事实源。Asset Browser 的选择、展开、split 尺寸、dirty 草稿和本地目录句柄
只存活于组件实例；资源内容不进入 ComposeDocument、History 或 Operation Log。

### 预览与 Monaco

浏览器支持的图片和 SVG 统一使用 Blob URL 与 `<img>`，禁止内联 SVG。代码文件首次选中时
动态加载 Monaco；包提供默认 worker，若宿主已有 `MonacoEnvironment` 则继承。一个 Browser
实例只挂载一个活动 model，切换前处理 dirty 状态，随后释放 editor、model、Blob URL 和监听器。

### 本地目录

File System Access 适配器要求用户手势和 readwrite 权限，不自动持久化 handle。新建、导入、
读写和递归删除使用标准 Directory/File Handle API。普通磁盘 move/rename 只有运行时明确支持
时开放，不使用非原子的复制后删除回退。

### Editor

Asset Browser 是底部 Edge Group 的第三个 inactive 标签；Transaction Log 保持默认活动。
`assetBrowserPanel` 优先于 `assetBrowserProps`。Editor 只组合组件，不转导 Asset Browser API。

## 风险/权衡

- Monaco 体积较大 → 动态 import，并用 E2E 证明非代码预览不会请求 Monaco chunk。
- File System Access 浏览器覆盖有限 → 能力检测、可访问错误和宿主 Provider 作为主协议。
- 通用 Tree 抽取可能改变 SceneTree 视觉/交互 → 先建立组件与黄金回归，再替换内部实现。
- 多项文件写操作无法跨后端原子化 → 逐项结果和明确部分失败，不虚构事务原子性。

## 迁移计划

1. 新增 components 并以现有 SceneTree 行为作为 Tree 的首个消费者。
2. SceneTree 内部迁移，公共 API 与黄金图保持不变。
3. 新增 Asset Provider、Browser 和本地适配器。
4. 增加 Editor 标签、示例和发布元数据。
5. 完成包级、组件、浏览器和 pack 门禁后归档。
