## MODIFIED Requirements

### Requirement: Monaco 脚本编辑

Browser MUST 为 JS、JSX、TS、TSX、JSON、CSS、SCSS、HTML 与 Markdown 动态加载 Monaco
及对应 tokenizer。编辑 MUST 产生 dirty 状态并只在 primary+S 或明确保存时写入；
切换、删除和关闭 dirty 文件前必须选择保存、放弃或取消。Theme MUST 跟随共享 Context。
Browser MUST 接受可选的、不暴露 Monaco 类型的 Script Intelligence Profile，以隐藏 shadow
model 提供补全、悬浮、签名和诊断；隐藏文本 MUST NOT 进入 dirty 比较或 Provider 写入，
推导类型 MUST NOT 以内联 Inlay Hint 显示。

#### Scenario: 按需加载并保存脚本

- **WHEN** 用户在未打开过脚本的 Browser 中浏览图片后再选择 TypeScript 文件
- **THEN** 图片流程不加载 Monaco，选择脚本时才加载 Monaco、语言 tokenizer 与所需 worker
- **AND** 编辑后 primary+S 使用当前 revision 保存并清除 dirty 状态

#### Scenario: 处理未保存切换

- **WHEN** 当前脚本 dirty 且用户选择另一个资源
- **THEN** Browser 显示保存、放弃和取消选择
- **AND** 取消保持当前编辑器和选择，保存或放弃后才完成切换

#### Scenario: 隐藏类型层不污染保存

- **WHEN** 宿主为 JavaScript 资源提供 Script Intelligence Profile 且用户修改后保存
- **THEN** Monaco 以 shadow model 中的隐藏类型插入生成补全、悬浮与诊断，但不显示类型 Inlay Hint
- **AND** Provider 只收到可见 model 的源码，错误 marker 不阻止保存

#### Scenario: 释放智能编辑会话

- **WHEN** 带 Script Intelligence Profile 的脚本编辑器卸载
- **THEN** 可见 model、shadow model、marker、监听器和 session 登记均被释放
- **AND** 迟到的 worker 结果不得重建已卸载的诊断或建议
