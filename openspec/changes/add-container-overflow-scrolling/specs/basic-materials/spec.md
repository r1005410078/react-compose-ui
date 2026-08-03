## ADDED Requirements

### Requirement: 容器分轴溢出 Inspector

系统 MUST 让所有具有 Hierarchy 的基础物料通过容器 Inspector 独立配置横向与纵向溢出策略，
且新建容器默认在两个轴裁剪内容。

#### Scenario: 配置纵向滚动

- **WHEN** 用户将容器纵向溢出设置为滚动
- **THEN** Inspector 通过单个 Core 命令写入完整且规范化的横纵轴值
