# 任务

## 1. 包骨架

- [x] 1.1 `packages/qml-export/`：package.json、tsconfig、vite / vitest 配置，`@packageDocumentation`
- [x] 1.2 边界检查：`src/dependency-boundary.test.ts` 断言只依赖 `core`、无 React / DOM / node 模块
      - Red command/result/reason：首版用例把包自己的标识常量 `'@compose-ui/qml-export'` 当成了越界
        依赖；判定收窄到 `from '…'` 导入语句。
- [x] 1.3 公共入口 `exportComposeSceneToQml`、`ComposeQmlExportError` 与诊断类型（TSDoc）

## 2. 映射（Vitest，`src/qml-export.test.ts` 30 条）

- [x] 2.1 QML 文本写出器：缩进、`#rrggbbaa` → `#aarrggbb`、数值格式化（`formatComposeNumber`）
- [x] 2.2 标识：`e_` 前缀、冲突后缀按遍历顺序、`objectName` 保留原始 id
- [x] 2.3 Frame / 容器 / Group / Clip / 层序；边框是压在子级之上的覆盖层；隐藏对象不导出
- [x] 2.4 曲线：line、polyline（含 `cornerRadius`）、arc 与整圆、path 与 `fillRule`、填充
      - 设计修正：不走 `projectComposeCurveToBox`，照搬预览的 `viewBox` 仿射，弧映射成椭圆弧。
- [x] 2.5 曲线描边：显式线帽 / 斜接、虚线与点线换算、dashOffset、线宽 0、端点箭头
- [x] 2.6 文字：像素字号、字重、字距、大小写、下划线、行高与按对齐的半行距补偿、换行
- [x] 2.7 旋转与自由基点（含盒外基点）
- [x] 2.8 组件实例：第一期导出为同尺寸占位并给出诊断（内联展开另起变更，见 proposal）
- [x] 2.9 降级：渐变、图片背景、阴影、滚动 / 单轴 / 圆角裁剪、图表等 Renderer、绑定、动画、字体栈
- [x] 2.10 确定性：同一输入两次导出逐字节相同
      - 变异检查：把缺省填充规则改成奇偶、把虚线改成绝对长度、把底对齐的 `ceil` 改成 `floor`，
        对应用例分别变红（2 + 1 条），还原后 32/32 通过。

## 3. 编辑器入口

- [x] 3.1 `document.exportQml` 动作：读控制器动作上下文里新增的 `layoutDocument` 与 `layoutSnapshot`
- [x] 3.2 命令面板、命令行（同一份目录）与应用菜单三条入口；布局未就绪时列出但不可用
- [x] 3.3 下载 `.qml` 文件，诊断按类聚合后经提示条呈现，并列出需要安装的字族
- [x] 3.4 用例
      - `action-catalog.test.ts`：未接时省略、接上后可执行、布局未就绪时带原因且不执行、默认不绑键。
      - `qml/export-active-scene.test.ts`：文件名、激活场景回退、降级聚合与字族、非法场景的失败提示。
        Red：最后一条首版期望的是不带原因的「QML 导出失败」，实际行为是带上导出器给出的原因——
        行为正确，改的是断言。
      - `e2e/qml-export.spec.ts`：画矩形之前导出一次（无 `Shape`）、不保存再导出一次（一个 `Shape`、
        四段 `PathLine`）。Red：提示条定位器命中了七个 `status` 区域，按文字收窄。

## 4. 像素验收

- [x] 4.1 夹具扩到八份：底座四份加 `curves`、`path-hole`、`containers`、`text-styles`
      - Red：`curves` 首版 4.038%——夹具把水平线放进 20px 高的盒，纵向被拉伸 20 倍，箭头随之变形。
        这是一个现实中不会出现的盒（绘制路径把盒设成紧包围盒），改成盒等于几何的斜向箭头后 0.117%。
      - Red：`text-styles` 首版 2.655%。三步收敛：补齐粗体字体文件（两边原先各自合成粗体）；
        按垂直对齐区分半行距补偿（居中不补、底对齐上移）；半行距照搬 Blink 的取整。降到 0.467%。
- [x] 4.2 `e2e/qt-reference.spec.ts` 同时写出预览截图与导出 QML；示例应用 `?qt-reference` 让预览与
      导出共用同一个布局 Runtime
- [x] 4.3 Qt 一侧改为截导出结果，删除底座阶段的手写对照 `.qml`；`qml-grab` 新增 `--font`
      - Green command/result：`native/qt/scripts/grab-fixtures.sh` + `bun scripts/qt/compare-render.ts`，
        八份全部通过（0 / 0 / 0.002% / 0.117% / 0 / 0 / 0.028% / 0.467%，macOS offscreen）。
- [x] 4.4 Linux 验收环境（CI `qt` job）上八份夹具通过
      - run 37085732499 通过（加上 `instances` 共 9 份）；文字差异的来源与处理记录在 `add-qt-runtime-foundation` 任务 4.1。

## 5. 文档与验证

- [x] 5.1 `AGENTS.md`：`qml-export` 的架构边界与「导出求解结果、照搬预览渲染规则」的判据
- [x] 5.2 `README.md`：完成度中加入 QML 导出
- [x] 5.3 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
      - 全部通过；`test:e2e` 390 passed（含新增的 `qml-export` 与扩到八份的 `qt-reference`）。
- [x] 5.4 `npx openspec validate add-qml-export --strict`
