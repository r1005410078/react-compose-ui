/**
 * 构建可移植产物时注入的补齐：运行时自己用到、而 V4 没有的两样。
 *
 * @remarks
 * `queueMicrotask` 以导出形式注入，编译器把 `reactivity.ts` 里的自由引用改写成它——V4 的全局对象
 * 只读，挂不上去。`Promise.prototype.then` 在 V4 里是微任务语义，与浏览器的 `queueMicrotask` 同一个
 * 队列次序。`Array.prototype.flatMap` 是方法，只能补在原型上；只在缺失时补。
 */
export function queueMicrotask(callback: () => void): void {
  void Promise.resolve().then(callback)
}

if (typeof Array.prototype.flatMap !== 'function') {
  Object.defineProperty(Array.prototype, 'flatMap', {
    configurable: true,
    writable: true,
    value: function flatMap<T, U>(
      this: T[],
      callback: (value: T, index: number, array: T[]) => U | readonly U[],
      thisArg?: unknown,
    ): U[] {
      const result: U[] = []
      for (let index = 0; index < this.length; index += 1) {
        const mapped = callback.call(thisArg, this[index]!, index, this)
        if (Array.isArray(mapped)) result.push(...mapped)
        else result.push(mapped as U)
      }
      return result
    },
  })
}
