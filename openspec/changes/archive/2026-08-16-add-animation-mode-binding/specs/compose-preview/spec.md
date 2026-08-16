## ADDED Requirements

### Requirement: 预览对话框动画播放

文档包含动画时，`ComposePreviewDialog` MUST 提供播放控件，按动画的 `playbackMode` 推进播放头
并把当前时刻的采样文档交给 `ComposePreview` 渲染。`ComposePreview` 组件自身 MUST NOT 获得动画
语义，仍然只接受已经采样好的文档。对话框关闭时 MUST 停止播放并释放计时资源。

#### Scenario: 播放文档动画

- **WHEN** 用户在包含动画的文档上打开预览对话框并点击播放
- **THEN** 预览内容按动画随时间变化

#### Scenario: 无动画时不显示播放控件

- **WHEN** 文档没有任何动画
- **THEN** 预览对话框不显示播放控件

#### Scenario: 关闭对话框停止播放

- **WHEN** 播放过程中用户关闭预览对话框
- **THEN** 播放停止且不再有计时回调触发
