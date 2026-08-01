---
"@compose-ui/pages": patch
"@compose-ui/materials": patch
---

隔离同一页面并发读取的消费者取消信号，避免 React StrictMode 或嵌套 Page Slot 卸载时中止其他仍有效的页面加载；Page Slot 重试按钮同时阻止 Stage pointerdown 冒泡。
