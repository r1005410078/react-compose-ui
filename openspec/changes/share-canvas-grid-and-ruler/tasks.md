# 任务

## 1. 点阵与刻度下沉到 core
- [ ] 1.1 `createAxisLattice`、`createRulerTicks`、刻度类型迁入 `core`，入参改为普通数字
- [ ] 1.2 `stage-engine` 改为转导，既有导出名不变
- [ ] 1.3 Stage 既有点阵与标尺用例全绿（零行为变更的证据）

## 2. 标尺 Pattern 下沉到 components
- [ ] 2.1 `paintRuler` 与 React 外壳迁入 `components/ruler/`，命名与类名去 Stage 化
- [ ] 2.2 调色板自定义属性改用 components 的语义 token
- [ ] 2.3 `stage` 改为消费 `ComposeRuler`，辅助线拖拽仍留在 Stage 侧
- [ ] 2.4 Stage 既有标尺用例与黄金图全绿

## 3. CAD 网格
- [ ] 3.1 CAD 图面网格改用共享点阵，按 CSS 多层 gradient 绘制，删除 SVG 网格线
- [ ] 3.2 主/细两级与 DPR 对齐
- [ ] 3.3 组件测试：缩到间距不足时抽稀为二次幂子集而不是消失；抽稀不改变实际吸附步长

## 4. CAD 标尺
- [ ] 4.1 CAD 画布挂上/左标尺与原点角，可由宿主关闭
- [ ] 4.2 指针游标线跟随，选择集区间条显示包围盒尺寸
- [ ] 4.3 组件测试：刻度随平移缩放对齐；指针离开后游标消失

## 5. 验证
- [ ] 5.1 e2e：CAD 缩放后网格仍可见；标尺刻度与网格线对齐
- [ ] 5.2 五道门
