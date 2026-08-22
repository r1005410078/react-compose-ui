# 任务

## 1. core：点输入管线下沉

- [x] 1.1 坐标解析（`x,y` / `@dx,dy` / `距离<角度`）与点求解管线从 `cad` 移入 `core`，
      去掉 `Cad` 前缀
- [x] 1.2 `cad` 改为消费 core 的实现，删除本地副本并保持公开名称兼容
- [x] 1.3 既有 `cad` 点输入用例全绿即证明行为不变；补一条 core 侧的边界用例

## 2. components：命令行 Pattern 上移

- [x] 2.1 命令行组件从 `cad-canvas` 移入 `components`，文案由调用方注入
- [x] 2.2 `cad-canvas` 改为消费共享组件，既有 CAD 命令行用例不改
- [x] 2.3 组件测：提示与关键字渲染、Enter 提交、Esc 上报

## 3. stage-engine：捕捉、命令与取点插件

- [x] 3.1 特征点捕捉查询：带 `Curve` 的 Entity 出端点与中点，按屏幕半径除以 zoom 取容差
- [x] 3.2 `StageDraftingContext` / `StageDraftingEffect` 与 `LINE` / `L` 命令定义
      （连续画线，`prompt` 携带 `commit`，Esc 结束）
- [x] 3.3 取点插件：优先级排在 `pan` 之下，任何 hit kind 都接管；更新优先级表
- [x] 3.4 单测：捕捉优先级与容差（非 100% 缩放）、`LINE` 逐段提交、Esc 结束会话、
      非点输入被拒绝且不结束会话
- [x] 3.5 `stage-engine` 依赖边界用例随之更新（新增 `commands`，理由记在用例注释里）；
      优先级表的 `sourceLine` 改为可选——新插件从未出现在那次抄录的级联里

## 4. stage：绘图模式的画布行为

- [x] 4.1 `drafting` prop：十字线光标、捕捉标记、橡皮筋预览
- [x] 4.2 命令行挂在 Stage 底部，会话状态住在 Stage
- [x] 4.3 绘图模式默认框选判定切到 `directional`
- [x] 4.4 键入坐标走点输入管线，与指针取点共用同一条求解
- [x] 4.5 组件测：命令启动与提示、取点提交、Esc 中止、键入坐标不被吸附改写、F8/F3 切换
- [x] 4.6 `ComposeGridSettings` 改为两轴独立（页面网格本就允许 X≠Y），CAD 填同一个值

## 5. editor：第三种模式

- [x] 5.1 `ComposeEditorMode` 加 `drafting`，切换器方向键逻辑泛化成按索引循环
- [x] 5.2 绘图模式下工具栏换成绘图工具
- [x] 5.3 组件测：三段切换的 radiogroup 语义与键盘行为

## 6. 验证

- [x] 6.1 每条新断言先确认去掉实现后变红（捕捉容差与「键入坐标不被改写」尤其）
- [x] 6.2 e2e 纵向流程：进入绘图模式 → `L↵` → 点两下画出一条线 → 第二条起点捕捉到第一条
      端点 → Esc → 切回设计模式，线在场景树里、能选中、能撤销
- [x] 6.3 e2e：绘图模式下中键平移仍然生效且命令停在原提示（取点插件不吞掉 pan）
- [x] 6.4 五道门槛：`lint` / `typecheck` / `test` / `build` / `test:e2e`
