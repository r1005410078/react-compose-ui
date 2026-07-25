# 变更：新增命令事务运行时

## Why

场景树、属性面板、示例 Canvas 和操作日志目前由宿主分别调用快照提交与日志记录，缺少统一的
文档修改入口，也无法保证复合修改的原子性。正式 Stage 开始实现前，需要先稳定可序列化文档、
可逆命令事务和统一历史协议。

## What Changes

- 在 `@compose-ui/core` 中新增版本化 JSON 文档模型、校验器、可逆 Patch 和同步命令处理器协议。
- 新增事务运行时，以成功事务作为文档、撤销重做、历史跳转和成功事件的唯一修改边界。
- 提供首批 Frame、Group、Component 结构、属性和变换命令，并允许宿主注册同步自定义命令。
- 新增独立的 `@compose-ui/command-panel`，展示命令结果并通过结构化预设表单派发命令。
- 将示例中的场景树、属性面板和现有新增按钮迁移到统一 dispatch，并在单一事务订阅点写入操作日志。
- 保留 `@compose-ui/history` 的快照 API；事务运行时提供结构兼容的导航控制器供现有面板和快捷键使用。

## Impact

- 受影响的规范：新增 `compose-document`、`command-transaction`、`command-panel`
- 受影响的代码：`packages/core`、新增 `packages/command-panel`、`app`、根配置与文档
- 公共 API：新增正式文档、命令、事务与运行时类型；新增 `@compose-ui/command-panel`
- 依赖后续变更：`add-infinite-stage-composition` 必须以本变更批准并实现后的公共协议为基础
