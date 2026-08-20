## MODIFIED Requirements

### Requirement: 页面实例隔离与脚本重载

每个 Editor 页面与每个页面渲染实例 MUST 拥有独立 setup scope；相同页面或相同脚本
资源不得隐式共享 State。setup 资源 revision 变化时 MUST dispose 旧实例并以新模块创建实例，首期 MUST
重置 State 而不是保留热更新状态。

#### Scenario: 同一页面的两个实例状态隔离

- **WHEN** 两个渲染入口同时渲染引用同一 setup 的页面并只在一个实例调用方法
- **THEN** 只有该实例的 State 和绑定视图更新
- **AND** 另一个实例的 Effect 与方法闭包保持独立

#### Scenario: 保存脚本后重新初始化

- **WHEN** setup 文件成功保存并发布新 revision
- **THEN** Runtime 清理旧 Effect、加载新模块并从初始 State 重新建立作用域
- **AND** 加载失败时保留字面 fallback 并报告新 revision 的 diagnostic
