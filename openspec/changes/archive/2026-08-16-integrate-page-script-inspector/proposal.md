# 变更：将页面脚本集成进 Canvas Inspector

## 原因

页面 setup 已经具备创建、关联、运行和返回成员查看能力，但操作入口分散在资源右键菜单，
返回成员又作为 Inspector 上方的独立信息块显示。页面脚本本质上是页面聚合的一项配置，
应当与输出尺寸、背景一样在 Canvas Inspector 中完成选择和查看。

## 变更内容

- 将独立页面脚本作用域块改为 Canvas Inspector 的“页面脚本”属性，保持单一属性搜索工具栏。
- 未关联时列出当前页面目录中的 `.setup.js`，并提供按页面名快捷创建、自动关联入口。
- 已关联时提供切换、打开和解除操作，并在属性下方显示当前 setup 返回成员、运行值与诊断。
- 保留 Asset Browser 既有页面右键操作作为等价入口，不改变 Script Runtime 或页面文件协议。

## 影响

- 受影响的规范：`editor-workspace-layout`
- 受影响的包：`@compose-ui/editor`
- 不新增公共 API，不改变 `ComposePageFile`、`ComposePageScriptScope` 或资源 Provider 协议。
