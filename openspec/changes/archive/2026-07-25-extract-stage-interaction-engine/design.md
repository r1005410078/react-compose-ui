## 上下文

`Stage` 已有纯几何帮助函数，但活动 Gesture、Pointer 生命周期、preview transforms、吸附候选、
Palette drop 和命令提交仍与 React state/ref 混合。新边界需要继续支持受控 viewport/selection、
DOM Scene + SVG Overlay、同步 TransactionRuntime 与每个 Editor 实例隔离。

## 目标/非目标

- 目标：建立可独立测试和嵌入的 headless Stage 交互引擎。
- 目标：统一内部 Pointer 手势与 Palette 外部拖入的 controller 和会话生命周期。
- 目标：集中 group、ungroup、reparent 与 transform 的世界/局部矩阵规划。
- 非目标：修改 ComposeDocument schema、core 命令协议、视觉、快捷键配置或 Preview。
- 非目标：建立任意第三方 Tool 插件系统或新增 Canvas/WebGL 后端。

## 决策

- `@compose-ui/stage-engine` 只依赖 core，使用纯数据事件、不可变 snapshot 和 surface effect port。
- 一个 controller 同时只连接一个 surface；多 Editor/Stage 通过不同 controller 隔离。
- controller 内部使用纯 reducer/session，React adapter 负责 DOM 测量、pointer capture、window
  监听和 requestAnimationFrame；pointerup 在结束前同步 flush 最新 Pointer 点。
- React adapter 将活动 Pointer session 与浏览器 pointer capture 所有权分离：session 使用单调
  generation 标识，window 只安装一组 move/up/cancel 路由，rAF sample、flush 与结束均校验
  pointerId 和 generation。capture 失败、迟到 release 或子节点冒泡的 lost capture 不得清空
  新的活动 session。
- 正常 pointerup、buttons 为 0 的遗漏松手恢复路径 MUST 使用最终坐标完成一次提交；只有目标为
  Stage 根节点、匹配活动 generation、仍按下 buttons 的真实 lost capture，以及 pointercancel
  或 window blur 才取消且不提交。
- document 引用派生 `StageSceneIndex`，缓存 parent、顺序、世界矩阵、边界与吸附候选。
- external drag 只保存 component type 或 Frame preset ID；registry seed、React icon 与 preset
  factory 继续留在 Stage adapter，drop 时由 effect 转换为正式命令。
- 几何与命令工厂从 stage 移至 stage-engine，Stage 不保留重导出；core handler 继续负责最终
  payload 校验、Patch 与事务历史。

## 风险/权衡

- 公共 API 立即破坏 → major changeset、README 迁移示例与编译测试明确新导入路径。
- 受控 props 在手势中变化可能产生陈旧基线 → 内部 document/tool 变化取消手势；选择仅接受与
  活动目标一致的受控回传。surface 重测不取消活动变换，适配层使用 pointerdown 时冻结的
  surface 原点换算 client 坐标，引擎使用手势开始 viewport 计算世界坐标。
- React 合成事件、原生 window 路由和 pointer capture 可能重复投递 → 根节点事件只保留宿主
  回调，内部 move/up/cancel 统一由活动 session 的 window 路由进入，引擎结束时先冻结并提交
  command，再清理 preview，最后释放 capture。
- Palette window Pointer 与 Stage surface 生命周期不同 → controller 通过 surface port 将 client
  坐标解析为 surface/world 坐标，并在没有连接或命中时稳定取消或产生 rejection。
- 重构范围较大 → 按坐标/索引、controller、内部手势、外部拖入、React 适配的纵向行为小步 TDD。

## 迁移计划

1. 新增 stage-engine 包并迁移纯几何、画布几何与命令工厂。
2. 建立 SceneIndex、controller、事件/snapshot/effect 协议及单元测试。
3. 让 Stage 通过 adapter 驱动 controller，再移除 React 内部 Gesture 实现。
4. 让 Palette 与 Editor 使用同一 controller，删除旧 StageDragController。
5. 更新所有导入、文档、changeset、构建与 E2E；不保留旧入口。
