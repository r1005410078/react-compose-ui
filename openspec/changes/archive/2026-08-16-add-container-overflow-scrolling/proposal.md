# 变更：增加 Container 分轴溢出与预览滚动

## 原因

当前 `Clip` 只能整体裁剪后代，无法表达横向或纵向滚动。Stage 的编辑场景不应引入滚动会话，
但需要呈现配置结果；Preview 则需要提供真实的浏览器滚动体验。

## 变更内容

- 向后兼容地扩展 `Clip`，增加横纵轴 `visible`、`clip`、`scroll` 策略与统一解析函数。
- 增加原子配置命令和 Materials Inspector 分轴设置。
- Stage 为滚动轴绘制不可交互的静态提示，不维护滚动位置。
- Preview 在真实递归 DOM 层级上应用原生分轴 overflow。
- 拆分共享 appearance 样式与消费方 overflow 行为，避免 Registry 感知运行模式。

## 影响

- 受影响规范：`compose-document`、`basic-materials`、`component-registry`、`stage`、`compose-preview`
- 受影响代码：`@compose-ui/core`、`@compose-ui/materials`、`@compose-ui/component-registry`、
  `@compose-ui/stage`、`@compose-ui/preview`
