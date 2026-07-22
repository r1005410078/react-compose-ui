# Change: 添加本地操作审计日志系统

## Why

编辑器底部日志区目前只是根据组件数组生成的演示列表，无法按真实发生顺序追踪用户已经提交的
数据变更，也无法在刷新后保留记录。需要一个独立、可嵌入且不依赖未定稿文档模型的日志能力，
帮助实施工程师回看组件、场景结构、属性和变量绑定操作。

## What Changes

- 新增 `@compose-ui/operation-log`，提供通用日志协议、IndexedDB 持久化、内存降级、Provider/Hook
  与紧凑日志面板。
- 日志按宿主 `scopeId` 隔离，支持连续属性输入合并、数量保留、搜索、分类/组件筛选和结构化详情。
- 示例应用在成功应用数据变更后显式记录操作，并用真实日志面板替换伪日志列表。
- `ComposeEditor` 继续只提供 `transactionLogPanel` 插槽，不承担日志状态或持久化。

## Impact

- Affected specs: `operation-log`
- Affected code: 新包 `packages/operation-log`、示例应用、工作区/发布配置和 E2E 基线
- Public API: 新增独立日志包；现有包 API 保持兼容
