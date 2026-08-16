## ADDED Requirements

### Requirement: 页面 Setup JavaScript 智能编辑

Editor 在页面系统启用时 MUST 为页面菜单打开或名称匹配 `*.setup.js` 的可编辑资源
注入 Setup Script Intelligence Profile。该 Profile MUST 使用 Script Runtime 公共声明为
`ctx`、State、Computed 与 setup 返回对象提供类型，且 MUST NOT 改写用户脚本。

#### Scenario: 编辑标准 Setup 导出

- **WHEN** 用户编辑 `export function setup(ctx)` 或受支持的等价直接导出
- **THEN** `ctx.` 补全 `state`、`computed` 和 `effect`，State `.value` 保留初始值类型
- **AND** 每个 Context 方法的补全详情与悬浮内容包含中文用途说明、关键生命周期语义和可用示例
- **AND** 示例使用 Markdown JavaScript fenced code block，并按当前 Monaco 主题进行语法着色
- **AND** Monaco 不在代码行内显示变量或 setup 返回对象的推导类型

#### Scenario: 类型错误不阻断保存

- **WHEN** 页面 Setup 脚本向数字 State 的 `.value` 写入字符串
- **THEN** Monaco 在可见源码的对应位置显示类型 diagnostic
- **AND** 用户仍可保存，Provider 收到的内容不包含隐藏声明或 JSDoc

#### Scenario: 非标准 Setup 声明降级

- **WHEN** Setup 脚本不使用 Editor 能够识别的直接导出形式
- **THEN** 编辑器保留 JavaScript 着色、输入和保存能力并显示不阻断的提示
- **AND** Editor 不对原始资源执行自动迁移
