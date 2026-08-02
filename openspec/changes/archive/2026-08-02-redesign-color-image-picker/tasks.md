## 1. 协议与渲染

- [x] 1.1 扩展 Core Paint JSON 协议、规范化和校验。
- [x] 1.2 为实体、Canvas Stage 和 Preview 接通资源图片渲染与安全降级。

## 2. 紧凑 Picker

- [x] 2.1 在单个 Theme/I18n Popover 内实现纯色、渐变、图片三页签。
- [x] 2.2 添加宿主图片库/上传适配接口、图片设置和预设渐变。
- [x] 2.3 保持已有无障碍、吸管、实时提交和会话颜色历史行为。
- [x] 2.4 Red：添加最大空档色标、唯一 ID、删除选择、单次 Pointer 提交与三类几何编辑测试；记录失败证据。
  - Red command: `bun --filter @compose-ui/components test -- --run src/color-picker/compose-color-picker.test.tsx`
  - Red result: FAIL，13 passed / 3 failed。
  - Red reason: 连续添加色标仍得到 `0/50/50/100%` 且会生成重复 ID；方向盘没有可访问的 slider 交互；径向页缺少中心与半径输入。
- [x] 2.5 Green：实现内部渐变模型、完整色标生命周期、预览手柄、方向盘与精确输入。
  - Green command: `bun --filter @compose-ui/components test -- --run src/color-picker/gradient-model.test.ts src/color-picker/compose-color-picker.test.tsx`
  - Green result: PASS，2 files / 25 tests。
- [x] 2.6 Refactor：拆分纯模型与 React 手势适配，保持 408px 紧凑样式、无标题和无内部滚动。
  - Refactor evidence: 新增内部 `gradient-model.ts`；`ComposePaintPicker` 只保留受控渲染与 Pointer/键盘适配，公共 Props、Schema 和导出未增加。
- [x] 2.7 Red：添加图片分页、替换设置保留、加载状态与 Provider 自动接线测试；记录失败证据。
  - Red commands: `bun --filter @compose-ui/components test -- --run src/color-picker/compose-color-picker.test.tsx`；`bun --filter @compose-ui/editor test -- --run src/compose-editor/compose-editor.test.tsx`
  - Red result: components FAIL，20 passed / 3 failed；editor FAIL，40 passed / 1 failed。
  - Red reason: Picker 忽略完整 `images` 集合与状态，替换图片重置设置；Editor 未从 Asset Provider 派生图片资源端口。
- [x] 2.8 Green：实现完整图片库端口、Popover 内分页、上传状态和 Editor Provider 自动适配。
  - Green commands: `bun --filter @compose-ui/components test -- --run src/color-picker/gradient-model.test.ts src/color-picker/compose-color-picker.test.tsx`；`bun --filter @compose-ui/editor test -- --run src/compose-editor/paint-image-library.test.ts src/compose-editor/compose-editor.test.tsx`
  - Green result: components PASS，2 files / 28 tests；editor PASS，2 files / 45 tests。
- [x] 2.9 Refactor：拆分 Provider 扫描、稳定引用、唯一命名与 Object URL 生命周期，保持组件包不依赖 assets。
  - Refactor evidence: 新增 Editor 内部 `paint-image-library.ts`，以四并发递归扫描、稳定排序、AbortSignal 和统一 Object URL 回收连接 Provider；Components 只消费兼容扩展后的图片端口。

## 3. 接线与验证

- [x] 3.1 从 Editor 资源配置向 Canvas/Appearance Inspector 注入图片端口。
- [x] 3.2 添加 Core、组件、渲染与集成测试。
- [x] 3.3 运行严格 OpenSpec 校验及仓库验证命令。
- [x] 3.4 扩展 Canvas Inspector Playwright 流程与目标视觉黄金图。
  - E2E evidence: Canvas Inspector 覆盖 `0/25/50/100%` 色标、方向盘、径向中心/半径、角向中心/角度以及横纵无溢出；更新 `stage-workspace-canvas-color-picker.png`。
- [x] 3.5 运行 OpenSpec strict、lint、typecheck、test、Storybook、build、E2E 与 diff 检查。
  - Validation evidence: `openspec validate redesign-color-image-picker --strict`、`bun run lint`、`bun run typecheck`、`bun run test`、`bun run storybook:build`、`bun run build`、`bun run test:e2e` 与 `git diff --check` 全部通过。
  - Test evidence: 全量 Turbo 测试 33/33 tasks；Components 56 tests、Editor 84 tests、Storybook Chromium 43 tests；Playwright 17/17。
- [x] 3.6 在 Canvas Inspector 完成 Provider 图片选择、上传、设置修改和图片资源子页无溢出验证。
  - E2E evidence: 从自动 Provider 列表选择已有图片，切换为适应并设置 72% 透明度；进入同一 Popover 的图片资源子页后替换图片仍保留设置；上传单张 SVG 后写入稳定 Image Paint 引用。
  - Visual evidence: 图片主页和资源子页均断言 `scrollWidth === clientWidth`、`scrollHeight === clientHeight`，并更新 `stage-workspace-canvas-image-library.png`。
- [x] 3.7 修复叠加颜色展开后最近图片被等高 Grid 行撑破的布局回归。
  - Red command: `bunx playwright test e2e/integration.spec.ts --grep "隐式 Canvas Inspector"`。
  - Red result: FAIL，图片卡片 `scrollWidth - clientWidth === 26`。
  - Green result: PASS；最近图片网格使用零最小列宽并停止内容行拉伸，叠加颜色改为完整 HEX 与透明度滑块分行显示；新增 `stage-workspace-canvas-image-picker.png` 黄金图。
- [x] 3.8 按目标稿还原图片主页双卡片比例、图片缩略图与叠加颜色组合控件。
  - Red command: `bun run --cwd packages/components test src/color-picker/compose-color-picker.test.tsx`。
  - Red result: FAIL，最近图片区仍显示“选择图片”，且叠加颜色透明度缺少可直接编辑的百分比字段。
  - Green result: PASS，24/24；最近使用与图片设置调整为约 40/60，缩略图保持两列近方形，填充方式使用渐变选中态，主透明度显示紧凑数值框，叠加颜色恢复为开关与单行“色块/HEX/透明度”组合控件。
  - Visual evidence: 更新 `stage-workspace-canvas-image-picker.png`，确认图片主页无横纵滚动和卡片内容溢出。
- [x] 3.9 修正图片设置卡的原生控件泄漏与叠加颜色初始状态。
  - Red command: `bun run --cwd packages/components test src/color-picker/compose-color-picker.test.tsx`。
  - Red result: FAIL；HEX 输入缺少显式文本类型而显示白色浏览器原生样式，首次选图提交 `overlay: null`，未呈现参考稿中的叠加颜色组合行。
  - Green result: PASS，24/24；HEX 恢复深色输入，图片透明度使用细轨道和 15px 手柄，左右卡片调整为约 43/57，首次选图使用 `cover / 100% / #8b5cf6 40%`。
  - Browser evidence: 使用 Playwright CLI 在本地 Editor 中完成选图与叠加颜色检查；重新生成 `stage-workspace-canvas-image-picker.png` 后目标场景通过且无卡片溢出。
- [x] 3.10 修正图片适配分段按钮与叠加颜色两端控件的细节样式。
  - Red command: `bun run --cwd packages/components test src/color-picker/compose-color-picker.test.tsx`。
  - Red result: FAIL；色块仍直接暴露浏览器原生 color input，无法稳定还原设计稿中的固定色块与箭头分区。
  - Green result: PASS，24/24；分段按钮使用确定的深色底、白色选中文字和蓝紫渐变，色块/箭头合并为固定 56px 控件，40% 区域去除独立输入框外观并保留同一组合框边界。
  - Visual evidence: 更新 `stage-workspace-canvas-image-picker.png`，目标 Canvas Inspector 场景通过且图片设置卡无横向溢出。
- [x] 3.11 按目标稿重写图片填充方式 Tag 选择器。
  - Red command: `bun run --cwd packages/components test src/color-picker/compose-color-picker.test.tsx`。
  - Red result: FAIL；旧分段组没有“图片设置”可访问名称，也没有隔离于通用按钮规则的选项结构，选中背景仍铺满单元格。
  - Green result: PASS，24/24；外层轨道使用 3px 内边距，选中项改为独立圆角蓝紫 Tag，未选项之间仅保留短分隔线，并补全明确的 group 名称、选项类和焦点样式。
  - Browser evidence: 使用 Playwright CLI 在生产预览中截取 `图片设置` group 局部，确认选中 Tag 的内缩、圆角、渐变和分隔线与目标稿一致。
