## 上下文

ComposeDocument v5 要求每个场景 Entity 具有包含 position、size、rotation 的 Transform。Layout
只存在于带 Hierarchy 的容器上，尚不影响真实几何。Stage Engine、Stage 与 Preview 都直接读取
Transform，因此 Auto Layout 必须先建立统一的派生几何协议。

## 目标/非目标

- 目标：v6 只保存布局意图；Yoga 结果通过同一 Snapshot 驱动编辑、命中和预览。
- 目标：保持 core、layout-engine、stage-engine 无 React/DOM，并保持 stage-engine 只依赖 core。
- 目标：显式迁移合法 v5 且默认保持视觉不变。
- 非目标：本阶段不实现 Fill、Hug、内容测量、Stage Flow 重排或 Flow Group/Ungroup。

## 决策

### v6 Authoring 模型

- `Transform` 只保存 `rotation`。
- 每个场景 Entity 必须保存 `LayoutItem`：`positioning`、保留的 absolute `offset`、width/height
  Fixed sizing、margin 与 alignSelf。
- `Layout` 仍只允许与 Hierarchy 组合，保存明确的 Flex 枚举、四边 padding、rowGap、columnGap。
- `Hierarchy.childIds` 是唯一顺序来源。隐式 Canvas 与缺少 Layout 的容器都是 free parent，直接
  子项必须为 Absolute；Flow 只允许位于 Layout parent 下。
- `TransformConstraints` 改为 `GeometryConstraints`；min/max 归入 LayoutItem axis sizing。
- LayoutItem 与 Appearance border 使用 border-box；rotation 在 Yoga 后应用。

### Runtime 协议与包边界

- core 定义不含 Yoga 类型的 resolved box、snapshot、diagnostic 和 measurement port 基础协议。
- layout-engine 只依赖 core 和 yoga-layout；通过 `yoga-layout/load` 单例异步加载，配置
  `useWebDefaults=true`、`pointScaleFactor=0`、LTR，并显式设置所有持久化样式。
- Runtime 以 `loading | ready | error` state、subscribe/getState/updateDocument/dispose 提供实例级
  生命周期；Node 按 Entity ID 增量复用，删除和 dispose 时主动 free。
- Editor controller 拥有会话 Runtime，Stage 与其共享；独立 Stage/Preview 缺少注入时自行创建。
- Stage/Preview 未 ready 时不渲染 Entity 或启动交互，显示 aria-busy/error；不回退 v5 几何。

### 几何与渲染

- Stage Engine 的 world matrix/bounds/SceneIndex 强制接收 Snapshot，缓存同时比较 document 与
  snapshot revision。
- Scene style 接收 resolved box；Stage 和 Preview 均输出 absolute left/top/width/height，不输出
  CSS Flex。
- 每个 root 单独形成 Yoga 树；free parent 的直接子项映射为 Yoga absolute child，Layout parent
  的 Flow child 进入 Flex flow。
- Layout 容器的 Appearance borderWidth 映射为 Yoga border，padding 在 border 内。

### 迁移

- 迁移器内部冻结 v5 validator，先验证输入，再构造并验证 v6；不修改输入，保留未知合法组件。
- v5 Transform position/size 变为 LayoutItem absolute offset 与 Fixed value；rotation 原样迁移。
- v5 TransformConstraints min/max 分散到两个 axis，编辑权限迁入 GeometryConstraints。
- v5 gap 同时写入 rowGap/columnGap；normal 映射为 CSS Flex 初始等价值。
- 所有既有子项迁移为 Absolute，包括已有 Layout 的容器子项，以保持视觉；用户再显式转换 Flow。
- parseComposeDocument、页面 parser、Stage 和 Preview 只接受 v6；不提供反向迁移。

## 风险/权衡

- WASM 初始化是异步的 → Runtime 暴露确定状态，React 入口提供加载/错误 UI 和可注入 loader。
- Yoga 与浏览器 Flex 存在细节差异 → 文档保存产品语义，adapter 显式映射并用数值 fixture 锁定。
- 大范围公共 API 破坏 → 使用 v6 编译错误强制清理所有旧 Transform 读取，不保留隐式兼容。
- Page Slot 自行递归会绕过 Snapshot → Renderer props 增加嵌套文档渲染端口，由 Stage/Preview
  在高层创建子 Runtime，Materials 不依赖 Stage/Preview。

## 迁移计划

1. 先发布 v6 类型、验证器与迁移测试，再切换 fixtures/presets。
2. 接入 layout-engine 和 Snapshot，同时把结果先保持为迁移后的旧几何。
3. 切换 Stage Engine、Stage、Preview、Editor 与 Page Slot 后删除 document-only 几何 API。
4. 宿主在加载 v5 资源时显式调用迁移器；一旦保存 v6，旧客户端不再兼容。

