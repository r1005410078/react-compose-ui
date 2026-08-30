## 1. 几何

- [ ] 1.1 `transformGizmoGeometry({ center, rotation, zoom })` 纯函数：两条轴的方向与端点、
      方块把手落点、环半径；把手尺寸屏幕恒定，不跟画布缩放变粗变长
- [ ] 1.2 中心与轴的解算：单选取基点 + 该 Entity 的 `rotation`，多选取包围盒中心 + 轴对齐
- [ ] 1.3 单元测试：轴跟着 `rotation` 转、缩放不改变把手屏幕尺寸、多选退回包围盒与轴对齐

## 2. 命中与仲裁

- [ ] 2.1 命中类型 `gizmo-handle`（`axis: 'x' | 'y' | 'rotate'`）
- [ ] 2.2 优先级表新增 `gizmo` = 1200
- [ ] 2.3 单元测试：环压过 resize 与 entity；paint/path 把手不被偷

## 3. 手势

- [ ] 3.1 轴把手 → 沿该轴的受约束平移，复用 move 的提交漏斗
- [ ] 3.2 环 → 复用 `createRotateSession`（中心已经是基点）
- [ ] 3.3 单元测试：拖 X 轴不改 `rotation`；拖环不改 `offset`；转过的对象上轴跟着斜

## 4. 呈现

- [ ] 4.1 指示器图层：方块 / 环 / 圆点三种形状，X 红 Y 绿语义 token
- [ ] 4.2 拖环时的角度读数走只读读数通道
- [ ] 4.3 组件测试：三种形状互不相同、关掉时不画

## 5. 删除旧的那一套

- [ ] 5.1 删 `rotation-layer.tsx` 与 `compose-stage__rotation-*` 样式、testid
- [ ] 5.2 删 `rotate` 工具值与 `rotate-plugin`
- [ ] 5.3 删优先级表的 `rotate-tool`(1600)、`legacy-rotate-hit`(500)、`rotate-tool-fallback`(200)
- [ ] 5.4 清理引用 `'rotate'` 工具值的 12 处（变换种类 `'rotate'` 保留，两者同名不同物）
- [ ] 5.5 既有用例改写：断言旧拉线的那些改断指示器

## 6. 编辑器接线

- [ ] 6.1 工具栏图标取代 rotate 按钮，切换指示器显示
- [ ] 6.2 进入动画模式自动打开，仍可手动关
- [ ] 6.3 用例：按下态读的是指示器开关而不是工具值

## 7. 端到端

- [ ] 7.1 非中心基点下指示器出现在基点上
- [ ] 7.2 拖环只写旋转轨道，拖轴只写位置轨道
- [ ] 7.3 关掉之后把手消失，别处手势一个字节不变

## 8. 验证

- [ ] 8.1 `bun run lint` / `typecheck` / `test` / `build`
- [ ] 8.2 `bun run test:e2e`
