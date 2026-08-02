## 1. Hug 文档与 Runtime

- [x] 1.1 Red：为合法 leaf/container Hug、非法 free container Hug、fallback 与 min/max 添加测试。
- [x] 1.2 Green：扩展 AxisSizing、validator、Yoga undefined dimensions、container intrinsic layout 与 diagnostics。
- [x] 1.3 Red：为 Hug resize 转 Fixed、rotation/Flow 保持和 Undo 添加交互测试。
- [x] 1.4 Green：接入现有 sizing command 与 Inspector。

## 2. 公共测量协议

- [x] 2.1 Red：为 Registry measurement 定义校验、同步 constraints、prepare、错误恢复和迟到结果添加测试。
- [x] 2.2 Green：实现 core 协议、Registry definition 与可释放 React measurement adapter。
- [x] 2.3 Red：为 port revision→Yoga dirty→Snapshot revision、attach/detach/dispose 添加 Layout Engine 测试。
- [x] 2.4 Green：实现 measure callback、fallback diagnostic 与 Runtime measurement 生命周期。

## 3. 内建物料与嵌套页面

- [x] 3.1 Red：为 Text 字体/换行、Image/SVG revision 和 Page Slot output/subscription 添加测试。
- [x] 3.2 Green：实现四类 measurement definition、离屏 host 与异步缓存。
- [x] 3.3 Red：为嵌套 Page Slot Runtime、循环/深度、loading/error、卸载取消添加测试。
- [x] 3.4 Green：让嵌套 render port 继承测量环境并可靠清理。

## 4. 验证

- [x] 4.1 增加 Hug/Fill 嵌套 E2E、资源稳定重排与黄金图，更新公开文档。
- [x] 4.2 严格校验 OpenSpec，运行全量质量门禁、WASM 唯一性和打包体积记录。

## 实施证据

- Red：Core 75 项、Registry 19 项、Layout Engine 11 项、Materials 43 项、Stage 22 项、Preview 12 项和 Editor 102 项定向测试全部通过；同时覆盖实际 Yoga WASM 与内部可注入 fake backend。
- Green：Hug 求解、Registry measurement/prepare adapter、Text/Image/SVG/Page Slot 测量、精确失效、诊断和 Stage/Preview/嵌套 Runtime 生命周期已接入统一 Snapshot 路径。
- Regression：`lint`、`typecheck` 38/38、`test` 37/37、`build` 20/20、Playwright 28/28、`pack:dry-run` 和 OpenSpec strict validation 全部通过；新增 `auto-layout-hug-content` 与 `auto-layout-asset-hug` 黄金图。
- Bundle：Editor 与 Preview 同时存在的 example 仅输出一份 `load-C8fZp6Pt.js` Yoga 懒加载 payload，原始 126,745 B，gzip 51,543 B。上游 `yoga-layout/load` 把 WASM 以 base64 内联于该 chunk，因此没有额外 `.wasm` 文件。
