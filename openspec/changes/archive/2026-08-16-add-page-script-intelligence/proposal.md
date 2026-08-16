# 变更：增加页面 Setup 脚本着色与智能提示

## 原因

`.setup.js` 虽然已交给 Monaco JavaScript model，但当前按需入口没有加载 JS/TS
tokenizer，因此脚本按纯文本颜色显示。同时 `setup(ctx)` 是无类型注解的普通
JavaScript，Monaco 无法推导 `ctx`、State 及返回对象。

## 变更内容

- 补齐 JavaScript/TypeScript tokenizer，让关键字、字符串、数字和注释使用 Monaco
  主题着色。
- Asset Browser 增加无 Monaco 类型泄漏的 Script Intelligence Profile，以隐藏插入构造
  JavaScript shadow model，并把补全、悬浮、签名和诊断映射回源码；推导类型不以内联文字
  显示，避免挤占源码空间。
- Script Runtime 提供与公共 Context 一致的编辑器声明文本；Editor 只为页面
  `.setup.js` 启用隐藏类型层。
- 类型错误只提示不阻止保存，Provider 始终收到用户可见的原始 JavaScript。

## 影响

- 受影响的规范：`asset-browser`、`editor-workspace-layout`
- 受影响的包：`@compose-ui/asset-browser`、`@compose-ui/script-runtime`、
  `@compose-ui/editor`
- 不改变 setup Runtime、页面文件、Bindings 或 JavaScript Loader 协议。
