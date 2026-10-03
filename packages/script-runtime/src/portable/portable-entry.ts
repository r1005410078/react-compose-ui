/**
 * 可移植产物的入口：只带作用域与响应式原语，不带模块加载器（那一段依赖 Blob URL 与 `import()`）。
 */
export { createComposePageScriptScope } from '../scope'
