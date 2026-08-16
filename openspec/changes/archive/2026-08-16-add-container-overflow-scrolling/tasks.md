## 1. 规范与 Core

- [x] 1.1 扩展 Clip 类型、严格校验、默认值与兼容解析
- [x] 1.2 增加分轴配置命令并覆盖规范化、撤销与重做

## 2. 配置与渲染

- [x] 2.1 Materials Inspector 改为横纵轴设置并更新 Container 默认值
- [x] 2.2 拆分共享 appearance 样式，保留既有公共 API 兼容
- [x] 2.3 Stage 绘制不可交互的滚动轴提示
- [x] 2.4 Preview 应用真实的原生分轴滚动

## 3. 验证

- [x] 3.1 补齐 Core、Materials、Registry、Stage、Preview 单元测试
- [x] 3.2 补齐 Preview 真实滚动 E2E 场景
- [x] 3.3 运行 lint、typecheck、test、build 与严格 OpenSpec 校验
