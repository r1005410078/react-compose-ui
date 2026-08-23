# 任务

判别性断言先验红。判别性的含义：断言在既有实现下必须失败，且失败原因正是本条要建立的行为。

## 1. core · 协议

- [x] 1.1 红：基点坐标非有限数字时校验失败并给出可判别问题码
- [x] 1.2 红：基点分量大于 1 时校验通过（落在盒外是正当用法）
- [x] 1.3 `ComposeTransform.pivot` 可选字段 + 校验 + `getComposeTransformPivot` 解析入口
      （缺席回退中心，**唯一读取入口**）
- [x] 1.4 既有文档校验用例全绿（无迁移护栏）

## 2. stage-engine · 矩阵

- [x] 2.1 红：非中心基点下 `decomposeMatrix(matrixFromTransform(t)) === t`
- [x] 2.2 红：基点在左边中点、旋转 90° 时该点位置不变
- [x] 2.3 绿：两函数同时接基点，`width / 2` → `width * pivot.x`
- [x] 2.4 基点随 `StageTransform` 流动，不单独传参；逐个更新约十处调用点
      （`interaction-controller` / `transform-preview` / `structure-commands` /
      `component-extraction`）
- [x] 2.5 未设基点的既有几何用例全绿（回归护栏）

## 3. component-registry · 渲染

- [x] 3.1 红：基点在左边中点时 `transformOrigin` 为左边中点
- [x] 3.2 红：未设基点时仍为居中
- [x] 3.3 绿：`composeEntitySceneStyle` 按基点算 `transformOrigin`
- [x] 3.4 确认 Stage / Preview / 组件实例三条路径都只经过这一个入口

## 4. stage-engine · 旋转工具点选（顺带）

- [x] 4.1 红：累加语义下旋转工具依次点击两个 Entity，两个都在选择集里
- [x] 4.2 绿：改读 `resolveStageClickSelection`
- [x] 4.3 旋转工具既有点选用例全绿

## 5. materials · Inspector

- [x] 5.1 几何分组增加「旋转基点」九点选择器（`v.picklist`，零新 editor）
- [x] 5.2 写入走 `entity.component.update`，可撤销
- [x] 5.3 未设基点时显示为中心
- [x] 5.4 组件测试：选锚点 → 派发 → 面板回显

## 6. 端到端 · 闭环

- [x] 6.1 纵向：绘图模式画一条线 → 切设计模式 → 基点设为「左中」→ 进动画模式 →
      0ms 打 `rotation=0`、1000ms 打 `rotation=90` → 播放 → **左端点不动、右端点扫过**
      （判别性：中心基点下两端都动）
- [x] 6.2 未设基点的既有旋转视觉黄金图不变

## 7. 五道门 + 文档

- [x] 7.1 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
- [x] 7.2 路线图回填步骤 3 结果
- [x] 7.3 AGENTS.md：基点缺席即中心、合成/分解必须成对、场景样式是三条渲染路径的唯一入口
