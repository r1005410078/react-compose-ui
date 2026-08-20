## 1. core 协议

- [x] 1.1 在 `packages/core/src/document-types.ts` 新增 `Interaction` Component 类型、
      trigger/action 可判别联合与内建 Component Key
- [x] 1.2 新增 `Interaction` 的校验:未知 event/action 拒绝、同一 event 不重复、空数组合法
- [x] 1.3 确认 `Interaction` 不参与布局求解与几何,补一条"加上前后求解结果一致"的测试
- [x] 1.4 在 `packages/core/src/page/` 新增 `ComposeNavigationPort` 协议类型并从公共入口导出
- [x] 1.5 core 单测:校验分支、页面引用复用、端口类型不引入 React/DOM

## 2. pages 导航会话

- [x] 2.1 在 `@compose-ui/pages` 实现导航会话:当前页、返回栈、订阅通知
- [x] 2.2 实现从 `homePageKey` 起步与"未设首页"的确定空状态
- [x] 2.3 实现跳转 / 返回 / 空栈 no-op / 同页 no-op / 返回栈上限
- [x] 2.4 实现目标不存在与读取失败两类可判别 issue,失败时保留当前页
- [x] 2.5 pages 单测覆盖以上全部分支,并断言无浏览器全局引用

## 3. script-runtime 逃生舱

- [x] 3.1 `createComposePageScriptScope` 选项接受可选导航端口
- [x] 3.2 `ctx` 暴露 `navigate` / `navigateBack`,委托同一端口
- [x] 3.3 未注入端口调用产生 diagnostic 而不抛出;setup 同步期调用被忽略并 diagnostic
- [x] 3.4 单测覆盖三种情形,并确认包未新增对 `pages` 的依赖

## 4. preview 页面宿主

- [x] 4.1 新增 `ComposePageHost`:按导航端口加载页面、渲染 `activeFrameId` 指向的 Frame
- [x] 4.2 复用 `useComposePageScriptScope`,切页时先 dispose 旧 scope 再建新 scope
- [x] 4.3 为带 `Interaction` 的 Entity 建立 click 处理与 button 语义、键盘可达性、可访问名称
- [x] 4.4 处理器挂在 Entity 容器层且不阻止冒泡到物料自身交互
- [x] 4.5 加载中 / 导航失败作为可区分的确定状态暴露给宿主
- [x] 4.6 `ComposePreviewDialog` 接受导航端口后切换为页面预览;场景选择器跟随当前页面
- [x] 4.7 未提供端口时对话框行为与变更前完全一致(回归测试)

## 5. materials Inspector

- [ ] 5.1 注册 `Interaction` 的 Component Definition 与 Inspector
- [ ] 5.2 trigger 列表编辑:添加 / 编辑 / 移除单条,单次操作一条可撤销事务
- [ ] 5.3 navigate 目标复用既有 node 页面拖入赋值,拒绝非页面文件
- [ ] 5.4 目标为空与目标缺失的明确呈现
- [ ] 5.5 组件测试覆盖以上,断言不引入第二套页面选择器

## 6. stage 编辑期约束

- [ ] 6.1 确认命中测试与手势不因 `Interaction` 改变,补回归测试
- [ ] 6.2 可选的交互视觉标记不参与命中、不改变几何

## 7. 示例与端到端

- [ ] 7.1 示例应用提供两个互相跳转的页面与首页设置
- [ ] 7.2 e2e:在预览对话框中点击跳转、返回、目标缺失时停留在当前页
- [ ] 7.3 e2e:画布上点击带跳转的 Entity 只选中、不跳转

## 8. 文档与验证

- [ ] 8.1 更新 `AGENTS.md`:`Interaction` 是 Entity Component、导航类型在 core /
      实现在 pages / 消费在 preview、编辑期不跳转
- [ ] 8.2 更新 `openspec/project.md` 中受影响的包边界描述
- [ ] 8.3 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e` 全绿
