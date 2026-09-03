# @compose-ui/svg-import

把一份 SVG 规划成 Component Asset v2 的**导入计划**：一份根为 Frame 的组件文档、若干待写资源
与诊断。无 React、无 DOM，只依赖 `@compose-ui/core`。

Entity 的 Preset seed 与 ID 工厂由调用方注入，因此本包不认识 Registry、物料或任何 UI。产出
计划而不是直接写盘，因为一次导入落的是资源，而资源写入不可回滚——纯函数产出、宿主写入，
测试因此不需要假造 Store。

三层：解析（XML 分词、剥离可执行内容）→ 归一化（样式求值、`transform` 烘焙、路径规范化）→
映射（产出 Entity）。前两层认识的是 XML 的结构与 CSS，与产出什么文档无关。
