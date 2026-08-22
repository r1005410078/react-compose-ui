# components

## ADDED Requirements

### Requirement: 共享标尺 Pattern

`@compose-ui/components` MUST 提供一个不含业务语义的标尺 Pattern，用于任何带视口的画布。
它 MUST 是受控组件：刻度、选择区间与交互回调全部由调用方给出，组件自身 MUST NOT 求解刻度、
MUST NOT 认识文档、视口类型或任何领域命令。

标尺 MUST 由 Canvas 2D 绘制并处理设备像素比。它 MUST 支持跟随指针的游标标记，且该标记
MUST 以命令式接口更新而不触发 React 重渲染——指针移动是高频事件，每次移动重渲染整条标尺会
在低端机上掉帧。

刻度类型 MUST 在本包内声明，MUST NOT 从求解刻度的包导入：标尺应当能绘制任何来源的刻度。

#### Scenario: 只绘制传入的刻度

- **WHEN** 调用方传入一组刻度
- **THEN** 标尺按传入内容绘制，不自行增删刻度

#### Scenario: 游标不触发重渲染

- **WHEN** 指针在画布上连续移动
- **THEN** 游标标记跟随更新
- **AND** 标尺组件不因此重新渲染

#### Scenario: 领域交互由调用方承担

- **WHEN** 用户在标尺上按下
- **THEN** 组件把事件交给调用方，自身不产生辅助线、选择或任何文档变更
