# 任务

## 1. 命中与框选（`packages/cad/src/selection/`）

- [x] 1.1 点到线段距离的纯几何助手
- [x] 1.2 `findCadHit`：容差内取最近，同距取 `rootIds` 靠后的；隐藏图层不参与
- [x] 1.3 `findCadEntitiesInRect`：`window` 全包含、`crossing` 相交或包含
- [x] 1.4 拖动方向 → 判定模式；方向由起终点决定而不是归一化后的框
- [x] 1.5 选择集代数：加入、Shift 移出、清空
- [x] 1.6 共置单测，含「包围盒内但离线段远」这条反例

## 2. 手势仲裁（`packages/cad/src/interaction/`）

- [x] 2.1 `CadKernelProfile`：context / index / event / claimEvent / effect / snapshot
- [x] 2.2 `cad.command-point`（30）、`cad.select`（20）、`cad.marquee`（10）三个插件
- [x] 2.3 优先级表与注册表绑定
- [x] 2.4 插件不认识命令会话：只发效果，点求解留在宿主
- [x] 2.5 共置单测：优先级、consumed 短路、框选会话的 update/commit/cancel

## 3. 命令消费选择集

- [x] 3.1 `@compose-ui/commands` 增加 `selection` 输入种类与启动上下文中的选择
- [x] 3.2 `createCadEraseCommand`：先选后执行 / 先执行后选两条路径
- [x] 3.3 删除作为一个 batch；提交后清空选择集
- [x] 3.4 共置单测覆盖两条次序与「什么都没选」

## 4. 画布接线（`packages/cad-canvas/`）

- [x] 4.1 建仲裁器、拼插件上下文、把效果落到宿主动作
- [x] 4.2 所有按下先问仲裁器，`declined` 才走中键平移
- [x] 4.3 渲染选中态与选框（实线/虚线）
- [x] 4.4 Escape 的两级语义
- [x] 4.5 i18n：zh-CN 与 en-US 同时补齐
- [x] 4.6 组件测试

## 5. 登记

- [x] 5.1 AGENTS.md：`@compose-ui/cad` 增加 `interaction-kernel` 依赖

## 6. 验证

- [x] 6.1 `bun run lint`
- [x] 6.2 `bun run typecheck --force`
- [x] 6.3 `bun run test --force`
- [x] 6.4 `bun run build --force`
- [x] 6.5 `bun run test:e2e`，含框选两条线后 `E↵` 一次撤销全部恢复

## 7. 实施中的发现与偏离

- [x] 7.1 **多出一步：先把交互内核抽成独立包**（`extract-interaction-kernel`）。依赖方向本来就
      走不通——内核住在 `stage-engine` 里，而 `cad` 只能依赖 `core` 与 `assets`。步骤 1 泛型化时
      刻意没抽包，理由是「只有一个消费者」；到这一刀有第二个了，正好是 AGENTS.md 的准入线。
- [x] 7.2 **`ComposeCommandSession.prompt` 改成可空**。原以为「先选后执行」能在 ERASE 内部用一个
      `preselected` 标志绕过去，写出来才发现那是在骗协议：会话协议要求宿主先读一次 prompt，
      于是宿主会显示「选择对象」再等一次回车，而 AutoCAD 里 `E↵` 是当场就删。`prompt === null`
      表示「没有要等的输入」，宿主立刻以 accept 推进——这一档是通用的，不是给 ERASE 开的后门。
      没有它，这类命令只能靠宿主认识命令 id 来特判。
- [x] 7.3 **命令效果改成一个各字段可选的结构，而不是判别联合**。注册表对效果类型是单泛型，
      两条命令必须共用一种。宿主对效果只做三件互相独立的事：画预览、派发命令、剔除选择集；
      判别联合会让每加一条命令都得先教会宿主判别它。
- [x] 7.4 **线段几何上移到 `geometry/`**。原来住在 `snap/cad-snap-geometry.ts`，选择集也要用。
      让 `selection/` 去 import `snap/` 是错的——选择不依赖捕捉。上移的理由符合 AGENTS.md 的
      「稳定、单一、可说明的跨功能职责」：这就是线段几何，不是 utils 大杂烩。
- [x] 7.5 **指针会话没有抽出来**。原计划说「框选是第一个真正需要那三类竞态防护的手势，到 6c
      再决定」。实际写完发现框选**不需要**：没有 rAF（因此没有迟到帧）、指针捕获落在图面自己的
      SVG 上（因此没有跨会话 window 监听）、`pointercancel` 与 `lostpointercapture` 各自有归宿。
      Stage 那 519 行防的是它自己那套 controller/surface 分离带来的竞态，搬过来是把别人的问题
      一起搬过来。等 CAD 出现真正需要预览节流的手势（夹点拖动、MOVE）再说。
- [x] 7.6 **中键平移仍留在图面上，但指针归属改成单线**。平移改的是视口，视口是 React state 不是
      内核状态；做成插件要把视口塞进内核 context 再加一种视口效果。但**所有按下先问仲裁器**，
      被拒绝才走平移分支——两个独立的指针拥有者才是真正会出问题的写法。
- [x] 7.7 **jsdom 的 `SVGElement` 没有 Pointer Capture 三件套**。加上 pointerUp 之后，
      `hasPointerCapture is not a function` 在每个用例里抛出未捕获异常，而测试**照样显示通过**
      ——错误只出现在 Vitest 末尾的 Unhandled Errors 区。夹具里补齐三个方法，与已有的
      `getBoundingClientRect`/`ResizeObserver` 同理。这条值得记：绿色不等于没有异常。
- [x] 7.8 **选中态的高亮交给 CSS 而不是改 `stroke` 属性**。图元颜色来自所属图层（ByLayer），
      把高亮写死在属性上会让「这条线是什么颜色」有两个答案。
- [x] 7.9 单测与 e2e 在满负载并行下各掉过一个**不相干**的用例（`preview` 的动画绑定、
      `cad-canvas` 因 7.7 的未捕获异常）。前者单独重跑通过，后者是真问题、已修。全量最终
      53/53 包用例与 104 条 e2e 全绿。
