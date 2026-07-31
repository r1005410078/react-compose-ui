## 1. Hug 文档与 Runtime

- [ ] 1.1 Red：为合法 leaf/container Hug、非法 free container Hug、fallback 与 min/max 添加测试。
- [ ] 1.2 Green：扩展 AxisSizing、validator、Yoga undefined dimensions、container intrinsic layout 与 diagnostics。
- [ ] 1.3 Red：为 Hug resize 转 Fixed、rotation/Flow 保持和 Undo 添加交互测试。
- [ ] 1.4 Green：接入现有 sizing command 与 Inspector。

## 2. 公共测量协议

- [ ] 2.1 Red：为 Registry measurement 定义校验、同步 constraints、prepare、错误恢复和迟到结果添加测试。
- [ ] 2.2 Green：实现 core 协议、Registry definition 与可释放 React measurement adapter。
- [ ] 2.3 Red：为 port revision→Yoga dirty→Snapshot revision、attach/detach/dispose 添加 Layout Engine 测试。
- [ ] 2.4 Green：实现 measure callback、fallback diagnostic 与 Runtime measurement 生命周期。

## 3. 内建物料与嵌套页面

- [ ] 3.1 Red：为 Text 字体/换行、Image/SVG revision 和 Page Slot output/subscription 添加测试。
- [ ] 3.2 Green：实现四类 measurement definition、离屏 host 与异步缓存。
- [ ] 3.3 Red：为嵌套 Page Slot Runtime、循环/深度、loading/error、卸载取消添加测试。
- [ ] 3.4 Green：让嵌套 render port 继承测量环境并可靠清理。

## 4. 验证

- [ ] 4.1 增加 Hug/Fill 嵌套 E2E、资源稳定重排与黄金图，更新公开文档。
- [ ] 4.2 严格校验 OpenSpec，运行全量质量门禁、WASM 唯一性和打包体积记录。

