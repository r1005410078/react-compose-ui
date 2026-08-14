# 任务

## 1. OpenSpec 与前置确认

- [ ] 1.1 验证 animation、editor-workspace-layout、stage、basic-materials 增量规范，并建立 Scenario
      到测试的映射清单。
- [ ] 1.2 确认 `add-animation-asset-runtime` 已归档，Asset v1、Runtime 与 Store 公共入口可用。

## 2. 编辑会话与撤销栈

- [ ] 2.1 Red → Green → Refactor：实现动画草稿模型、dirty 标记与独立 Undo/Redo，断言不进入页面
      文档历史。
- [ ] 2.2 Red → Green → Refactor：实现撤销快捷键路由（面板可见性 + 焦点），断言不跨栈撤销且
      History 面板只显示页面文档历史。
- [ ] 2.3 Red → Green → Refactor：实现显式保存、revision 冲突的重新加载/强制覆盖、dirty 关闭保护，
      以及保存成功后才提交槽位映射事务。

## 3. Auto-keyframe 与 recording adapter

- [ ] 3.1 Red → Green → Refactor：实现视觉安全属性的命令分类器与 recording adapter，逐命令断言
      录制关闭时完全透传。
- [ ] 3.2 Red → Green → Refactor：实现自动建轨道、0ms 基础帧、当前时间帧更新与连续交互的历史合并。
- [ ] 3.3 Red → Green → Refactor：实现 Flow 子节点 reorder 不录制位置并发布诊断；实现只列出无
      authored 对应字段通道的「添加轨道」入口。
- [ ] 3.4 Red → Green → Refactor：在 Materials 声明可动画通道与布局属性排除，断言布局命令语义不变。

## 4. React 时间轴与上下文 Inspector

- [ ] 4.1 Red → Green → Refactor：实现全宽受控时间轴、容器范围聚合、节点/属性轨道、菱形关键帧、
      播放头、缩放与紧凑播放控制。
- [ ] 4.2 Red → Green → Refactor：实现资源本地时间语义，断言 delay/speed 只改变区间可视化而不影响
      关键帧寻址。
- [ ] 4.3 Red → Green → Refactor：实现关键帧多选、移动、删除、键盘/ARIA、焦点恢复与活动资源切换。
- [ ] 4.4 Red → Green → Refactor：实现关键帧/区间 Inspector、Bezier 曲线与 Spring 编辑器，并与
      Stage/Scene Tree 选择同步。

## 5. Editor 与 Stage 集成

- [ ] 5.1 Red → Green → Refactor：在 bottom Edge Group 增加「动画」标签并保持资源、动画、命令、
      日志顺序、全宽布局、折叠与用户尺寸。
- [ ] 5.2 Red → Green → Refactor：Stage 应用受控播放头 FrameSnapshot，断言优先于 setup play、
      不产生文档事务、不触发布局求解，且逐帧提交不走 React 状态。
- [ ] 5.3 Red → Green → Refactor：实现选择协调（节点 / 关键帧 / 区间 Inspector 切换）与切换页面时的
      会话清理。

## 6. 端到端与视觉

- [ ] 6.1 添加确定性 Playwright 纵向流程：打开动画面板 → 创建资源 → 自动记录白→红 → 四关键帧 →
      调整 easing → 保存 → Preview 播放。
- [ ] 6.2 从实现截取时间轴、播放控制区与关键帧 Inspector 黄金图；定稿前对照 `design/animation.png`
      人工比对标签顺序、播放控制区图标排布、关键帧菱形/播放头与 Curve/Spring Inspector 布局，
      记录已确认的偏离项（scale「添加轨道」入口）。

## 7. 验证与交付

- [ ] 7.1 为每个任务在本文件记录实际 Red command/result/reason、Green command/result 与
      Regression command/result。
- [ ] 7.2 运行 `openspec validate add-animation-timeline-editor --strict`。
- [ ] 7.3 运行 `bun run lint`、`bun run typecheck`、`bun run test`、`bun run build` 与
      `bun run test:e2e`，修复全部回归后更新完成状态。
