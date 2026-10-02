## 上下文

目标是让编辑器产出的场景在 Qt Quick 里原样渲染。目标设备与宿主程序都还不存在，因此底座只承担
「能装、能跑、能截、能比」四件事。三份变更的次序是：本变更（底座）→ `add-qml-export`（静态
基础图形）→ `add-qml-page-script`（脚本与绑定）。

## 目标 / 非目标

- 目标：一条命令装好固定版本的 Qt；无头渲染一份 QML 得到确定的 PNG；与 Preview 截图做容差比较；
  CI 上可重复。
- 非目标：宿主播放器 App、交叉编译到目标硬件、任何导出逻辑、任何 `@compose-ui/*` 包的改动。

## 决策

- **Qt 6.8 LTS**：支持期覆盖到 2029；`QtQuick.Shapes` 的 `CurveRenderer`（6.6 起）抗锯齿质量
  足够画接线图的细线；embedded Linux（eglfs）在同一版本线上。版本号只写在 `qt-version.json`
  一处，安装脚本与 CI 读同一份——两处各写一份迟早漂移，而漂移的症状是「本机过、CI 红」。
- **aqtinstall 而不是官方安装器**：官方安装器要求登录账号、无法脚本化；aqtinstall 一条命令装指定
  版本与模块，本机与 CI 走同一条路径。模块清单第一期只需 `qtdeclarative`（含 `QtQuick.Shapes`）；
  `qtwebsockets` 等到脚本阶段再加。
- **`native/qt/` 在 JS 构建之外**：CMake 项目进 Turbo 会让每一个只改 TS 的提交都去找 Qt。它与
  JS 侧唯一的接口是**文件**（夹具 `.qml` 与 PNG），因此不需要任何包依赖。
- **渲染后端固定为 `offscreen` 平台 + Mesa llvmpipe 的 OpenGL**：`software` 后端走 QPainter，
  与真机上的 GL 场景图不是同一条光栅化路径，黄金图会对不上真机；真 GPU 在 CI 上不可得。
  llvmpipe 是确定性的软件 GL 实现，至少保证「CI 与开发机的 Linux 容器给出同一张图」。
  macOS 开发机上的截图**只供人工查看，不作为验收依据**——字体与光栅化都不同。
- **截图时机**：等 `QQuickWindow::frameSwapped` 之后再 `grabWindow`，而不是 `show()` 之后立刻抓。
  后者抓到的可能是还没渲染的首帧，症状是偶发的全黑或全透明 PNG。
- **对比用 `pixelmatch` + `pngjs`**（dev 依赖，只在 `scripts/qt/` 用）：Playwright 自带的
  `toHaveScreenshot` 只能和自己的黄金图比，这里要比的是**两个来源**的图。容差分两层：逐像素
  颜色阈值（抗锯齿边缘必然不同）与差异像素比例上限；两个数写在对比脚本一处，并在本变更的
  任务里用夹具实测后定下，而不是凭手感先写一个。
- **Preview 截图在同一个 CI 工作流里现截**，作为 artifact 传给 `qt` job，不提交 PNG：提交的话，
  Preview 的任何正当视觉改动都会让 Qt 侧的对照图过期。

## 风险 / 权衡

- llvmpipe 与真机 GPU 的抗锯齿仍有差异 → 容差兜底；真机验收在播放器阶段另做。
- 字体：Preview 用的字体在 Linux 容器里未必存在 → 夹具只用仓库内随附的开源字体，两边加载
  同一个字体文件。
- CI 时长：首次安装 Qt 约数分钟 → 按 `qt-version.json` 的哈希缓存安装目录。

## 待解决问题

- 目标硬件（工控机 / ARM 嵌入式）与其 GPU 尚未确定，交叉编译工具链留到播放器阶段。
- LGPL 合规方式或商业授权，需要在分发前由商务确认。
