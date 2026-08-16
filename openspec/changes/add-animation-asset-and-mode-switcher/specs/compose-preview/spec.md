## ADDED Requirements

### Requirement: 动画自动播放

动画清单条目 MUST 支持可选的 `autoplay` 布尔字段：`playing` 未绑定任何脚本导出且
`autoplay` 为 true 时，预览挂载后 MUST 视同 `playing` 恒为 true——首帧触发上升沿从头
播放，播放模式照常生效。`bindings.playing` 存在时脚本绑定 MUST 优先，`autoplay` 被忽略。
编辑器的「播放」属性行在未绑定变量时 MUST 作为手动开关编辑该字段，修改经动画配置命令
写入清单（可撤销）并随页面保存回写动画文件。

#### Scenario: 勾选自动播放无需绑定即播放

- **WHEN** 动画的 `autoplay` 为 true 且 `playing` 没有绑定任何导出
- **THEN** 预览挂载后动画从 0 ms 开始播放，`play-once` 播完停在末尾

#### Scenario: 脚本绑定优先于自动播放

- **WHEN** 动画同时携带 `autoplay: true` 与 `bindings.playing`，且绑定导出为 false
- **THEN** 预览不播放，播放完全由绑定导出驱动

#### Scenario: 手动勾选写入清单

- **WHEN** 用户在「播放」属性行未绑定变量时勾选开关
- **THEN** 动画配置命令把 `autoplay` 写入清单且可撤销；取消勾选后清单不保留该字段
