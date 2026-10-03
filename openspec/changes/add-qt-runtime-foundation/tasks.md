# 任务

## 1. 工具链

- [x] 1.1 `native/qt/qt-version.json`：Qt 6.8 LTS 补丁版本 + 模块清单
      - 6.8.3 是 6.8 线上最新的开源补丁版本（`aqt list-qt mac|linux desktop --spec 6.8`）；
        `QtQuick.Shapes` 随 `qtdeclarative` 在基础安装里，P0 的附加模块清单为空。
- [x] 1.2 `native/qt/scripts/install-qt.sh`：读版本文件，用 aqtinstall 安装到 `native/qt/.qt/`，已装即跳过
      - Red command/result/reason：首次运行 `pip install aqtinstall==3.3.0` 失败——本机 pip 指向的
        镜像没有该包。
      - Green command/result：有 `uv` 时改走 `uvx`（自带索引配置），无则回退 venv + pip（可用
        `PIP_INDEX_URL` 覆盖）；`native/qt/scripts/install-qt.sh` 安装成功（约 63 s），再次运行输出
        「Qt 6.8.3 已安装，跳过下载。」
      - Red command/result/reason：`cmake --build` 链接失败 `framework 'AGL' not found`——Qt 6.8.3 的
        `FindWrapOpenGL.cmake` 链接 AGL，而新版 macOS SDK 已删除它；「找到才链接」也不够，系统目录里
        的 AGL 运行时仍被 `find_library` 找到。
      - Green command/result：安装脚本在 macOS 上把那段 AGL 链接整段删掉（Qt 6 本身不用 AGL），
        重复执行幂等；`qml-grab` 链接成功。
- [x] 1.3 `.gitignore` 加入 `native/qt/.qt/`、`native/qt/build/`、`native/qt/out/`
- [x] 1.4 确认 `bun run lint` / `typecheck` / `test` / `build` 在未装 Qt 的环境下不受影响
      - Red command/result/reason：`bun run lint` 报 111 个错误——ESLint 遍历到 Qt 安装目录自带的 JS
        与 CMake 构建目录里名为 `compiler_depend.ts` 的依赖清单。装没装 Qt 改变了 lint 的结论，正是
        本条要挡住的情形。
      - Green command/result：`eslint.config.js` 忽略 `native/qt/.qt/**`、`build/**`、`out/**`；
        `bun run lint` 通过。`native/qt` 不在 workspace 与 Turbo 中，`typecheck`/`test`/`build` 不触及它。

## 2. 无头截图

- [x] 2.1 `native/qt/tools/qml-grab/`：CMake + main.cpp，`frameSwapped` 之后 `grabWindow`
      - Green command/result：`native/qt/scripts/grab-fixtures.sh` 截出四份 320×200 PNG。
- [x] 2.2 加载失败的错误输出与非零退出码
      - Green command/result：含非法属性的 QML → 输出文件、行号与插入符，退出码 1，不写 PNG；
        根对象宽高为 0 → 说明原因，退出码 1。
      - Refactor：加载期错误曾打印两遍（`QQuickView` 自己的 qWarning + 工具再打一遍），改为只由
        Qt 打印，工具只负责退出码。
- [ ] 2.3 在 Linux 验收环境（xvfb + xcb + llvmpipe）中连续截图同一份 QML 十次，逐字节一致
      - 本机（macOS offscreen）：`text-line` 与 `line-diagonal` 各连截十次，各得 1 个哈希。
      - Linux 一侧：CI 新增「Grab determinism」步骤（`text-styles` 与 `instances` 各连截十次比哈希），待它跑通后勾选。

## 3. 像素对比

- [x] 3.1 夹具：`box-fill`（纯色矩形）、`box-stroke-radius`（描边圆角容器）、`text-line`（一行文字）、
      `line-diagonal`（一条斜线），各配手写对照 `expected.qml`；字体为随附的 DejaVu Sans
      - 文档由物料包的 Preset 生成（与编辑器新建出来的逐字段相同）并经 `validateComposeDocument`
        校验后写成 JSON。
- [x] 3.2 `e2e/qt-reference.spec.ts`：用 Preview 渲染夹具并写出 PNG
      - 示例应用新增 `?qt-reference` 模式：只渲染用例在加载前注入的文档；字体经路由提供。
      - Green command/result：`playwright test e2e/qt-reference.spec.ts` 4 passed。
- [x] 3.3 `scripts/qt/compare-render.ts`：尺寸检查、pixelmatch 比较、差异图输出
      - Green command/result：宽 321 的截图 → 「尺寸不同：预览 320×200，Qt 321×200」，退出码 1；
        超出容差 → 报比例并写出差异图，退出码 1；缺图 → 报缺失。
- [x] 3.4 用夹具实测定下两个容差值，并在脚本中注明来源
      - Red command/result/reason：`text-line` 差异 1.017%，墨迹整体比预览高 4px——CSS 的
        `line-height` 把多余行距上下各分一半，Qt 的 `FixedHeight` 全放在下面。
      - Green command/result：对照 QML 补 `topPadding: (40 − FontMetrics.height) / 2` 后 0.247%，
        水平方向逐像素一致；三份图形夹具差异为 0。
      - 定值：逐像素阈值 0.1，差异比例上限 0.5%——对实测留约两倍余量，并挡住 1.017% 那类整体错位。
        这条映射规则已写入 `add-qml-export` 的 design.md。

## 4. CI

- [x] 4.1 `ci.yml` 新增 `qt` job：缓存 Qt、构建 `qml-grab`、下载 Preview 截图 artifact、对比
      - Red：首次实跑（PR #1）`qt` job 被跳过——它 `needs: verify`，而 `verify` 挂在 `main` 上早已
        存在的 `asset-browser` Monaco 用例超时（`main` 最近 5 次 CI 都挂在同一处）。
      - 改为独立 job：自己构建、自己跑 `qt-reference` 截参考图与导出 QML；待实跑通过后勾选。
      - Red：独立后全量 `bun run build` 挂在 Storybook 构建次序（与本变更无关）→ 只构建
        `--filter=@compose-ui/example...`；随后 `find_package(Qt6 Gui)` 报 WrapOpenGL not found →
        补装 `libgl1-mesa-dev libegl-dev libglx-dev libxkbcommon-dev`。
      - Linux 首次完整对比：7/8 通过，`text-styles` 2.864%。逐行墨迹显示 Qt 在 Linux 与 macOS 上排字
        一致、与 macOS Chromium 一致，偏的是 Linux 无头 Chromium（字形落整像素）。Qt 侧
        `PreferNoHinting` 零效果（已撤回）；参考截图加 `--font-render-hinting=none` 后
        `text-line` 0.120%、`text-styles` 0.806%、`instances` 0，其余与本机相同。
      - 剩余差异是字形边缘抗锯齿（Skia 与 Qt 的光栅化），行位置逐行对齐到 1px 内。经确认：含文字的
        夹具单独取 1.5%（`TEXT_MAX_DIFF_RATIO`，按夹具文档里有无文字 Renderer 判定），纯图形仍 0.5%。
      - Green：run 37085732499 的 `qt` job 通过，9/9 夹具（含 `instances`）。
- [x] 4.2 失败时上传两边截图与差异图
      - 已验证：`text-styles` 超差那两次运行都上传了 `qt-comparison`，内含参考图、Qt 截图、差异图与导出的 QML。

## 5. 文档与验证

- [x] 5.1 `AGENTS.md`：`native/qt/` 的边界（不进 workspace、只以文件交换、容差一处定义）
- [x] 5.2 `openspec/project.md`：Qt、aqtinstall、pixelmatch/pngjs、夹具字体许可、Qt 验收策略
- [x] 5.3 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
      - `lint`、`typecheck`、`build` 通过；`test` 首次运行时 `core/curve-region.test.ts` 一条用例在
        30 s 超时（与 Qt 构建并发、机器满载；该用例注释已写明对并行负载敏感，单独运行 1.7 s 通过），
        空闲时重跑 61/61 通过；`bun run test:e2e` 385 passed（含新增的 4 条 `qt-reference`）。
- [x] 5.4 `npx openspec validate add-qt-runtime-foundation --strict`
