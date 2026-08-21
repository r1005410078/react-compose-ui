# 任务

## 1. 校验器协议

- [x] 1.1 `DocumentValidationResultOf<TDocument>` 泛型化，`DocumentValidationResult` 保留为
      `ComposeDocument` 上的别名
- [x] 1.2 新增 `DocumentValidator<TDocument>`

## 2. 类型泛型化（默认参数 ComposeDocument）

- [x] 2.1 `ApplyDocumentPatchesResult`
- [x] 2.2 `CommandHandler`
- [x] 2.3 `TransactionRuntimeState`
- [x] 2.4 `TransactionRuntimeEvent`
- [x] 2.5 `TransactionRuntimeOptions`（新增可选 `validate`）
- [x] 2.6 `TransactionRuntime`
- [x] 2.7 `applyDocumentPatches`

## 3. 运行时

- [x] 3.1 `createDocumentTransactionRuntime<TDocument>`：`validate` 必填
- [x] 3.2 四处 `validateComposeDocument` 调用改为调用注入的校验器
- [x] 3.3 `createTransactionRuntime` 保持签名，转调泛型入口并传入 `validateComposeDocument`
- [x] 3.4 `core/src/index.ts` 导出新增名称，既有名称集合不变

## 4. 测试

- [x] 4.1 新增用例：自定义文档类型 + 自定义校验器，跑通 dispatch / undo / redo / reset
- [x] 4.2 新增用例：校验器返回规范化文档时，运行时采用返回的那一份
- [x] 4.3 确认既有 core 测试一行未改

## 5. 验证

- [x] 5.1 `bun run lint`
- [x] 5.2 `bun run typecheck --force`
- [x] 5.3 `bun run test --force`
- [x] 5.4 `bun run build --force`
- [x] 5.5 `bun run test:e2e`

## 6. 实施中发现的额外解耦

- [x] 6.1 `createBuiltinCommandHandlers()` 的注册从泛型运行时移到 ComposeDocument 特化。
      `entity.*` 那套是 ComposeDocument 的命令词汇，预置给其他文档类型既是一批必然失败的
      handler，还会把这些 type 占住。注册顺序（内建在前、宿主在后）与注入化之前一致。
      `transaction.batch` 例外，它是事务原语而非文档命令，仍由泛型运行时内联处理。
- [x] 6.2 `patches.ts` 的四个私有 helper 参数由 `ComposeDocument` 收窄为 `object`——它们
      只把文档当作路径根用。失败分支另立 `PatchFailure` 类型，因为它不携带文档，可在任意
      文档类型上复用。
- [x] 6.3 初始文档非法的错误文案由「Invalid **ComposeDocument**」改为「Invalid document」。
      泛型入口对任意文档类型抛出，原文案会误导。仓库内无断言该文案的用例。
