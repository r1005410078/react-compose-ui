## 1. 规范与规划器

- [x] 1.1 编写 OpenSpec 增量并 `openspec validate add-stage-clipboard-actions --strict`
- [x] 1.2 在 stage-engine 增加会话剪贴板类型、规范化、建议落点和粘贴规划
- [x] 1.3 让 `createDuplicateCommand` 接受可选插入位置，跨父级不再额外偏移

## 2. Stage 菜单与快捷键

- [x] 2.1 增加 `edit.copy` / `edit.cut` / `edit.paste` 动作、默认 Primary+C/X/V 与可选 clipboard 属性
- [x] 2.2 右键菜单加入复制、剪切、粘贴，并显示当前平台键位
- [x] 2.3 独立 Stage 使用内建剪贴板；`onShortcutAction` 接管时不走内建实现
- [x] 2.4 可编辑输入中不拦截复制/剪切/粘贴

## 3. Editor 共享剪贴板

- [x] 3.1 偏好、本地化、动作目录和命令面板纳入三个新动作
- [x] 3.2 控制器提升场景树命令控制器，注入 SceneTree，并把剪贴板快照交给 Stage
- [x] 3.3 场景树复制后可在画布粘贴，画布复制后可在场景树粘贴
- [x] 3.4 粘贴规划遵守建议落点

## 4. 验证

- [x] 4.1 为 stage-engine、stage、editor 偏好/动作/控制器补充行为测试
- [x] 4.2 运行受影响包测试与 `bun run typecheck`
