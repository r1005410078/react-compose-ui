## ADDED Requirements

### Requirement: Stage 滚动配置提示

Stage MUST 为配置了横向或纵向滚动的可见容器绘制对应方向的静态滚动条提示，且不得改变
Entity 编辑坐标、消费滚轮、维护滚动偏移或产生文档事务。

#### Scenario: 显示不可交互的纵向提示

- **WHEN** 可见容器的纵向溢出配置为 `scroll`
- **THEN** Stage 在容器右边显示 `aria-hidden`、不可命中的静态提示
