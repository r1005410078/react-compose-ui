## ADDED Requirements

### Requirement: 可配置绘制与变换工具快捷键

Editor Preferences MUST 将 select、move、scale、rotate、pan、container、rectangle、line、arrow、circle 与 text
工具动作纳入同一份可配置 shortcut action map，并对同一 scope 使用现有冲突检测。默认触发键 MUST 与 toolbar
tooltip、shape menu 和设置面板显示的键位一致；输入与 IME 隔离规则保持不变。

#### Scenario: 使用默认工具快捷键

- **WHEN** Stage 获得焦点且用户按下某一默认工具快捷键
- **THEN** controller 请求切换到对应工具且默认 toolbar 的 pressed 状态同步
- **AND** 该快捷键不会产生文档事务

#### Scenario: 拒绝工具快捷键冲突

- **WHEN** 用户在 Settings 中尝试把两个相同 scope 的工具动作绑定为同一按键组合
- **THEN** Preferences 返回现有稳定冲突标识并拒绝该绑定
- **AND** 已保存的其他快捷键保持不变
