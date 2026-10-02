# 任务

## 0. Spike（先做，结论回写 design.md）

- [ ] 0.1 Qt 6.8 中：QML `import` ES 模块、`Promise`、`async`/`await`、可选链、`??`
- [ ] 0.2 手工打包 `reactivity` + `scope`，在 V4 中创建作用域
- [ ] 0.3 `Timer` 驱动 state → QML 文本刷新整条链路
- [ ] 0.4 结论写入 design.md「语法支持」一节；若需降级编译，补充依赖决策并重新评审

## 1. 可移植运行时产物

- [ ] 1.1 `script-runtime` 构建新增自包含 ES 模块产物，不含浏览器全局引用
- [ ] 1.2 用例：在无浏览器全局的环境中 import 并创建作用域
- [ ] 1.3 可移植全局清单与类型声明（含 `fetch` 子集差异说明）

## 2. Qt 运行时模块

- [ ] 2.1 `native/qt/runtime/ComposeRuntime/`：`qmldir`、`ComposePage.qml`
- [ ] 2.2 `globals.mjs`：定时器、`fetch`、`WebSocket` 补齐，页面销毁时释放
- [ ] 2.3 复制运行时产物并加哈希一致性校验任务
- [ ] 2.4 一致性校验：可移植声明与注入清单一致
- [ ] 2.5 `qt-version.json` 加入 `qtwebsockets`

## 3. 导出器

- [ ] 3.1 从 `Bindings` 收集导出名，生成 `page` 对象与属性初值
- [ ] 3.2 被绑定 prop 生成 `page.x` 绑定（Vitest）
- [ ] 3.3 产物改为文件列表；无 setup 时与静态导出一致

## 4. 编辑器

- [ ] 4.1 导出打包为 zip（`fflate`）
- [ ] 4.2 可移植模式宿主选项与脚本编辑器类型声明切换
- [ ] 4.3 组件测试：可移植模式下 `document` 被标错；默认模式不变

## 5. 验收

- [ ] 5.1 `qml-grab` 支持延迟截图参数，用于脚本驱动的夹具
- [ ] 5.2 夹具：计数脚本、缺失导出、setup 抛错、fetch 本地 JSON
- [ ] 5.3 CI Qt job 跑脚本夹具

## 6. 文档与验证

- [ ] 6.1 `AGENTS.md`：Qt 侧脚本「同一份源码、同一份响应式实现」的约束
- [ ] 6.2 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
- [ ] 6.3 `npx openspec validate add-qml-page-script --strict`
