# 任务

## 1. 工具链

- [ ] 1.1 `native/qt/qt-version.json`：Qt 6.8 LTS 补丁版本 + `qtdeclarative` 模块
- [ ] 1.2 `native/qt/scripts/install-qt.sh`：读版本文件，用 aqtinstall 安装到 `native/qt/.qt/`，已装即跳过
- [ ] 1.3 `.gitignore` 加入 `native/qt/.qt/` 与 `native/qt/build/`
- [ ] 1.4 确认 `bun run lint` / `typecheck` / `test` / `build` 在未装 Qt 的环境下不受影响

## 2. 无头截图

- [ ] 2.1 `native/qt/tools/qml-grab/`：CMake + main.cpp，`frameSwapped` 之后 `grabWindow`
- [ ] 2.2 加载失败的错误输出与非零退出码
- [ ] 2.3 在 Linux 容器（offscreen + llvmpipe）中连续截图同一份 QML 十次，逐字节一致

## 3. 像素对比

- [ ] 3.1 夹具：至少「纯色矩形 + 描边圆角容器 + 一段文字 + 一条斜线」各一份，配手写对照 `.qml`，
      字体使用仓库随附的开源字体文件
- [ ] 3.2 `e2e/qt-reference.spec.ts`：用 Preview 渲染夹具并写出 PNG
- [ ] 3.3 `scripts/qt/compare-render.ts`：尺寸检查、pixelmatch 比较、差异图输出
- [ ] 3.4 用夹具实测定下两个容差值，并在脚本中注明来源

## 4. CI

- [ ] 4.1 `ci.yml` 新增 `qt` job：缓存 Qt、构建 `qml-grab`、下载 Preview 截图 artifact、对比
- [ ] 4.2 失败时上传两边截图与差异图

## 5. 文档与验证

- [ ] 5.1 `AGENTS.md`：`native/qt/` 的边界（不进 workspace、只以文件交换）
- [ ] 5.2 `openspec/project.md`：Qt 与 aqtinstall 外部依赖、截图验收策略
- [ ] 5.3 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
- [ ] 5.4 `npx openspec validate add-qt-runtime-foundation --strict`
