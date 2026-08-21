## ADDED Requirements

### Requirement: 适配层的纯逻辑与 React 分离

Stage 适配层中不依赖 React 的确定性逻辑 MUST 住在独立模块，MUST NOT 与组件实现混在同一个
文件里——预览文档烘焙、指针几何归一化、资源落点排布与快捷键匹配都属于这一类。

这些模块 MUST NOT 引入 Hook、ref 或组件闭包，使它们可以脱离渲染独立求值与测试。

#### Scenario: 预览烘焙可独立求值

- **WHEN** 给定文档、布局快照与一组预览变换
- **THEN** 烘焙结果完全由输入决定，不需要挂载任何组件

#### Scenario: 快捷键匹配可独立求值

- **WHEN** 给定一个键盘事件与键位表
- **THEN** 匹配结果完全由输入决定
