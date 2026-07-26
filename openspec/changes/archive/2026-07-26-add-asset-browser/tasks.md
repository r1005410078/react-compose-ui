## 1. 规范与公共 Tree

- [x] 1.1 严格验证 `add-asset-browser` proposal、design 与全部规范增量
  - Regression command/result: `bunx openspec validate add-asset-browser --strict` → change valid
    （PostHog 网络刷新失败不影响退出码）
- [x] 1.2 Red：为 Tree 索引、过滤祖先、受控选择/展开、键盘和 ARIA 建立 Scenario 映射
  - Red command/result/reason: `bun run --cwd packages/components test` → missing `tree-model`
    and `index` modules; target Tree behavior is not implemented
- [x] 1.3 Green：新增 `@compose-ui/components` Tree、主题样式和公共 TSDoc
  - Green/Regression: `bun run --filter @compose-ui/components test` → 8 passed；5001
    节点只挂载 viewport/overscan 行
- [x] 1.4 Red/Green：覆盖 Pointer 拖排、非法循环、延迟展开、取消和自动滚动
  - Regression: components Tree model/DOM tests 与 SceneTree Pointer tests → 74 passed
- [x] 1.5 Refactor：迁移 SceneTree 组合公共 Tree，保持 API、命令和黄金视觉
  - Regression: `bun run --filter @compose-ui/scene-tree test` → 66 passed；完整示例黄金 E2E
    通过且恢复 `展开节点/折叠节点` 领域 ARIA

## 2. Provider 与本地文件系统

- [x] 2.1 Red：为 Provider capability、错误、revision 冲突和逐项结果建立测试
  - Scenario mapping: `asset-operations.test.ts`、`file-system-provider.test.ts`
- [x] 2.2 Green：实现 Asset 公共类型、错误规范化和 Provider 操作协调
  - Regression: capability、稳定错误、名称校验和部分成功批处理 6 tests passed
- [x] 2.3 Red/Green：实现 File System Access list/read/create/write/delete 与权限错误
  - Regression: 本地 Provider 读取、新建、递归删除、AbortSignal 和错误规范化测试通过
- [x] 2.4 Red/Green：验证同名不覆盖、revision 冲突及 move/rename 能力检测
  - Regression: 同名 create conflict、expectedRevision/force 与无原生 move 能力 tests passed

## 3. Asset Browser

- [x] 3.1 Red/Green：实现懒加载目录 Tree、受控会话状态和迟到请求取消
  - Regression: 真实 click 导航子目录、AbortSignal read 切换及缓存 generation tests passed
- [x] 3.2 Red/Green：实现文件夹网格、图片/SVG Blob 预览、URL 回收和不支持文件状态
  - Regression: SVG 仅经 `<img>`/Blob URL、URL revoke、二进制元数据 tests passed
- [x] 3.3 Red/Green：实现新建、导入、重命名、移动、删除确认和部分失败汇总
  - Regression: toolbar/menu/keyboard、外部导入、Tree 与网格移动、递归删除和批处理 tests passed
- [x] 3.4 Red/Green：实现 Monaco 按需加载、语言/主题、dirty、显式保存和冲突选择
  - Regression: model URI/语言/主题/释放、dirty 取消竞态、primary+S、revision force tests
    与 Chromium 纵向流程通过；Monaco CSS/worker 只存在于动态脚本 chunk
- [x] 3.5 Refactor：完成中英文 chrome、可访问 splitter/dialog/menu 和稳定样式
  - Regression: light/en-US Context、message override、dialog/menu/splitter ARIA tests passed

## 4. Editor、示例与发布

- [x] 4.1 Red/Green：Editor 底部新增资源标签、props/panel 优先级和本地化
  - Regression: Editor 63 tests passed；bottom 组保持 Transaction Log 默认活动，Assets inactive
- [x] 4.2 更新示例纵向流程、README、包边界、安装命令与 Turbo concurrency
  - Regression: 示例内存 Provider 覆盖目录、SVG 与 TS；`dev --concurrency=17`
- [x] 4.3 新增 package manifests、build/pack 配置和 changeset
  - Regression: components/asset-browser manifests、根 pack 顺序和 changeset 均进入 dry-run

## 5. 回归与门禁

- [x] 5.1 运行 components、scene-tree、asset-browser、editor 相关单元与组件测试
  - Result: components 8、scene-tree 66、asset-browser 16、editor 63 全部通过
- [x] 5.2 Playwright 覆盖目录、图片/SVG、Monaco 保存、文件操作、主题和语言
  - Result: `bun run test:e2e` → 12 passed
- [x] 5.3 生成并人工检查 Asset Browser 规范黄金图，不更新无关 Stage 黄金图
  - Result: directory grid、SVG preview、Monaco editor 三张黄金图已人工检查；既有 Stage
    黄金图未改动
- [x] 5.4 运行 OpenSpec `--all --strict`、lint、typecheck、test、build、pack dry-run、
  test:e2e 与 `git diff --check`
  - Result: OpenSpec 16/16、lint、typecheck 31/31、test 30/30、build 16/16、
    15 packages pack dry-run、E2E 12/12 与 diff check 全部通过
- [x] 5.5 在每个任务下记录 Red、Green 与 Regression 命令和实际结果后完成归档准备
