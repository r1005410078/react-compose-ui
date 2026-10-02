# 变更：搭 Qt 底座——工具链、无头截图与像素对比

## 原因

编辑出来的场景要能在 Qt 里渲染（方案是导出成 QML，见 `add-qml-export` 与 `add-qml-page-script`）。
而仓库里目前**没有任何 Qt 侧的东西**：没有工具链、没有宿主程序、没有任何办法判断「QML 画出来的
和编辑器预览的是不是同一张图」。

先把这一层单独做掉，理由是**它的坑与转换毫无关系**：Qt 的安装、无头渲染后端、CI 缓存、截图时机，
每一样都可能让第一张截图就对不上。与导出器混在一起做时，一次像素差异分不清是环境的错还是转换的错。

## 变更内容

- 新增 `native/qt/` 目录，**在 Bun workspace 与 Turbo 之外**：它由 CMake 构建，不进
  `bun run build`，任何 `@compose-ui/*` 包都不依赖它。
- Qt 版本**单一来源**：`native/qt/qt-version.json` 写死 Qt 6.8 LTS 的具体补丁版本与模块清单；
  本机安装脚本与 CI 都读它，用 aqtinstall 装到被忽略的 `native/qt/.qt/` 下。
- 新增无头截图工具 `qml-grab`（C++，几十行）：加载一份 `.qml`，等到首帧真正交换之后
  `grabWindow`，写出 PNG。渲染后端**固定**（见 design.md），否则同一份 QML 在两台机器上
  会是两张图。
- 新增像素对比脚本：同一份夹具文档，一边由 Playwright 截 `ComposePreview`，一边由 `qml-grab`
  截手写的对照 `.qml`，在声明的容差内比较，并输出差异图。
- CI 新增 `qt` job（ubuntu-24.04），缓存 Qt 安装，跑通上面这条链路。
- **不写宿主 App**：第一期只需要 Qt 自带的 `qml` 工具（人工查看）与 `qml-grab`（自动验收）；
  播放器 App 等到数据接入阶段再做，那时需求才清楚。

## 影响

- 受影响的规范：新增 `qt-runtime`
- 受影响的代码：
  - 新增 `native/qt/`（`qt-version.json`、`scripts/install-qt.sh`、`tools/qml-grab/`、对照夹具）
  - 新增 `scripts/qt/compare-render.ts` 与 `e2e/qt-reference.spec.ts`
  - `.github/workflows/ci.yml`：新增 `qt` job
  - `.gitignore`：`native/qt/.qt/`、`native/qt/build/`
  - `AGENTS.md` / `openspec/project.md`：记录 `native/qt/` 的边界与 Qt 外部依赖
- **待商务确认**：Qt 开源版为 LGPLv3。底座阶段只在开发机与 CI 上使用，不分发；进入嵌入式分发
  之前必须定下 LGPL 合规方式或商业授权。
