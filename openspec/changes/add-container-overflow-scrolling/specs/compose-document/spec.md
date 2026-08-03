## ADDED Requirements

### Requirement: Container 分轴溢出协议

系统 MUST 在 v6 `Clip` Component 中向后兼容地表达横向与纵向的 `visible`、`clip`、`scroll`
策略，并提供不依赖 React 或 DOM 的统一解析和原子配置命令。

#### Scenario: 读取旧 Clip 文档

- **WHEN** v6 Entity 的 Clip 只有 `enabled: true` 或 `enabled: false`
- **THEN** 系统分别将两个轴解析为 `clip` 或 `visible`

#### Scenario: 规范化混合滚动策略

- **WHEN** 一个轴配置为 `scroll` 且另一个轴请求 `visible`
- **THEN** 原子命令将另一个轴规范化为 `clip`
