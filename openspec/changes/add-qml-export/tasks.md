# 任务

## 1. 包骨架

- [ ] 1.1 `packages/qml-export/`：package.json、tsconfig、构建配置，`@packageDocumentation`
- [ ] 1.2 架构边界检查：只允许依赖 `core`
- [ ] 1.3 公共入口 `exportComposeSceneToQml` 与诊断类型（TSDoc）

## 2. 映射（每项先写 Vitest 用例，先红后绿）

- [ ] 2.1 QML 文本写出器：缩进、属性顺序、颜色 `#aarrggbb` 换算、数值格式化
- [ ] 2.2 标识：`id` 规范化与冲突后缀、`objectName`
- [ ] 2.3 Frame / 容器 / Group / Clip / 层序
- [ ] 2.4 曲线：line、polyline（含 `cornerRadius`）、arc 与整圆、path 与 `fillRule`、填充
- [ ] 2.5 曲线描边：虚线换算、dashoffset、端点箭头
- [ ] 2.6 文字：字号、字重、字距、行高、换行、对齐
- [ ] 2.7 旋转与自由基点
- [ ] 2.8 组件实例内联展开与缺失时的占位
- [ ] 2.9 降级：渐变、阴影、图片 / SVG / 图表 / 未知 Renderer、绑定 prop、动画
- [ ] 2.10 确定性：同一输入两次导出逐字节相同

## 3. 编辑器入口

- [ ] 3.1 `document.exportQml` 动作：以 Preview 的测量端口求解当前文档与组件实例嵌套文档
- [ ] 3.2 应用菜单项与命令面板条目
- [ ] 3.3 下载 `.qml` 文件并呈现诊断
- [ ] 3.4 组件测试：未保存改动被导出、诊断可见

## 4. 像素验收

- [ ] 4.1 `native/qt/fixtures/`：设计里列出的每类基础图形一份夹具文档
- [ ] 4.2 `e2e/qt-reference.spec.ts`：同时写出 Preview 截图与导出的 `.qml`
- [ ] 4.3 CI Qt job 改为对导出结果做对比（替换底座阶段的手写对照 `.qml`）

## 5. 文档与验证

- [ ] 5.1 `AGENTS.md`：`qml-export` 的架构边界与「导出求解结果、不翻译布局」的判据
- [ ] 5.2 `README.md`：完成度中加入 QML 导出
- [ ] 5.3 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
- [ ] 5.4 `npx openspec validate add-qml-export --strict`
