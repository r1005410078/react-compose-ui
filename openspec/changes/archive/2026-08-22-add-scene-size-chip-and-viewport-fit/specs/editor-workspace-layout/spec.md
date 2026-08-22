## ADDED Requirements

### Requirement: 首次进入的激活场景取景

编辑器 controller MUST 把「首次布局就绪时适配激活场景」透传给 Stage，并 MUST 默认开启：
固定初始视口在任何真实场景尺寸下都不是可用的取景。宿主 MUST 能通过 controller 选项关闭它，
关闭时 `initialViewport` 就是用户进入后看到的取景。

该适配 MUST NOT 进入文档、事务历史或操作日志——视口始终是会话状态。

#### Scenario: 默认进入即适配

- **WHEN** 宿主以默认选项创建 controller 并打开一个含 1280×720 激活场景的页面
- **THEN** 画布缩放小于 100%，该场景整体落在可视区域内且四周留有空白

#### Scenario: 宿主关闭自动适配

- **WHEN** 宿主把 controller 的自动适配选项设为 false
- **THEN** 进入后画布停在 `initialViewport`，缩放为 100%
