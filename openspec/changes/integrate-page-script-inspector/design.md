# 设计：页面脚本 Canvas Inspector 属性

## 目标与边界

页面脚本属于页面聚合而不是场景 Entity。只有活动页面以 Canvas 输出为 Inspector 目标时，
默认 Canvas Inspector 才显示页面脚本属性；选中 Entity 后继续只显示该 Entity 的组件属性。
宿主自定义 Inspector 插槽继续由宿主负责，不强行注入编辑器领域 UI。

## 组合方式

`CanvasInspector` 继续使用 `ComposePropertyPanel` 的 Schema 驱动输出字段，并增加一个 Editor
内部全宽自定义 renderer 插槽。`ComposeEditor` 只向默认 Inspector 元素克隆注入当前页面的脚本
属性内容，因此页面脚本与输出尺寸、输出背景共用同一个 Property Panel Root 和搜索框；页面脚本
在属性网格中横跨完整宽度，不再浪费左侧标签列。

脚本属性组件仍归属 `@compose-ui/editor`：它认识页面、Provider 与 Script Runtime；
`@compose-ui/property-panel` 不增加页面语义，`@compose-ui/asset-browser` 也不反向拥有页面关联逻辑。

## 资源与状态流

1. 组件从活动页面条目的父目录调用 `provider.list()`，只保留拥有稳定 `assetKey` 的
   `*.setup.js` 文件。
2. 选择已有脚本时构造 `ComposePageSetupReference`，复用 `usePageWorkspace.setPageSetupScript()`
   的 revision、作用域替换与页面会话同步。
3. 快捷创建沿用现有自包含模板，以 `<PageName>.setup.js` 写入页面同目录；创建成功后关联并
   打开脚本标签。页面关联失败时保留已创建文件并显示现有 orphaned 提示。
4. 返回成员直接订阅活动页面的 `ComposePageScriptScope`。value 显示当前值与响应式状态，method
   显示方法类别；diagnostic 与成员共用同一属性区域。
5. 标题栏的重新加载按钮调用 `usePageWorkspace.reloadPageSetupScript()`，与资源
   revision 订阅共用同一条可取消的作用域替换路径，不修改页面文件。
6. 页面切换或 setup 引用变化后，属性组件以新会话事实重新列举和渲染，不缓存跨页面选择。

## 交互与可访问性

- 脚本选择使用有明确可访问名称的原生 `select`，支持键盘与系统选项行为。
- 标题栏可折叠正文，已关联时显示可访问的“重新加载脚本”按钮；打开和解除收进可恢复
  焦点的更多菜单，快捷创建保留带可访问名称的按钮；异步期间禁用重复操作并显示加载反馈。
- 成员使用列表语义，诊断使用 `role="alert"`；空脚本显示明确的返回成员空态。
- 成员表只显示类型徽标、名称与最终值，计数紧随标题，method 类别不重复显示。
- Provider 缺少创建或写入能力时，只禁用对应操作，不影响当前成员查看和脚本打开。

## 非目标

- 不递归搜索整个资源树，不新增脚本重命名、删除或多脚本优先级。
- 不从源码静态推断返回成员；Inspector 只显示当前 Runtime 实例事实。
- 不改变 Entity Props 绑定选择器或 setup 脚本编辑器智能提示。
