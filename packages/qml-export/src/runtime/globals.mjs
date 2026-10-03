// 页面脚本在 Qt（V4 引擎）里的可移植全局：定时器、微任务、fetch 子集与 WebSocket。
//
// V4 的全局对象只读，挂不上这些名字；导出时编译器把脚本里对它们的引用改写成对本模块的 import
// （清单见 @compose-ui/script-runtime 的 COMPOSE_PORTABLE_GLOBALS，两处必须一致——有用例校验）。
// 本文件不经过降级编译，只能写 V4 支持的语法：不用 async/await、对象展开与类字段。
//
// 定时器与 WebSocket 都挂在当前页面（ComposePage）上，页面销毁时由 detach 一并停掉——与浏览器端
// effect cleanup 释放资源同一个时机。
/* global Qt, XMLHttpRequest */

let owner = null
let baseUrl = ''
let nextId = 1
const timers = new Map()
const sockets = new Set()

// base 是场景文件所在目录：fetch 的相对路径相对它解析，与浏览器里相对页面地址解析对应。
// 不传的话 XMLHttpRequest 会相对调用方模块（ComposeRuntime/）解析，同一个 'data.json' 在两边
// 指向不同的文件。
export function attach(page, base) {
  owner = page
  baseUrl = String(base || '')
}

function resolveUrl(input) {
  const url = String(input)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) || baseUrl === '') return url
  if (url.charAt(0) === '/') return baseUrl.replace(/^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]*).*$/, '$1') + url
  return baseUrl + url.replace(/^\.\//, '')
}

export function detach(page) {
  if (owner !== page) return
  timers.forEach(function (timer) { timer.stop(); timer.destroy() })
  timers.clear()
  sockets.forEach(function (socket) { socket.close() })
  sockets.clear()
  owner = null
}

function schedule(callback, delay, repeat, args) {
  if (typeof callback !== 'function' || owner === null) return 0
  const id = nextId++
  const timer = Qt.createQmlObject('import QtQuick; Timer {}', owner, 'compose-timer')
  timer.interval = Math.max(0, Number(delay) || 0)
  timer.repeat = repeat
  timer.triggered.connect(function () {
    if (!repeat) {
      timers.delete(id)
      timer.destroy()
    }
    callback.apply(undefined, args)
  })
  timers.set(id, timer)
  timer.start()
  return id
}

function cancel(id) {
  const timer = timers.get(id)
  if (!timer) return
  timers.delete(id)
  timer.stop()
  timer.destroy()
}

export function setTimeout(callback, delay) {
  return schedule(callback, delay, false, Array.prototype.slice.call(arguments, 2))
}

export function setInterval(callback, delay) {
  return schedule(callback, delay, true, Array.prototype.slice.call(arguments, 2))
}

export function clearTimeout(id) { cancel(id) }

export function clearInterval(id) { cancel(id) }

// V4 的 Promise.prototype.then 是微任务语义，与浏览器 queueMicrotask 同一个队列次序。
export function queueMicrotask(callback) {
  Promise.resolve().then(callback)
}

function parseHeaders(raw) {
  const headers = new Map()
  String(raw || '').split(/\r?\n/).forEach(function (line) {
    const index = line.indexOf(':')
    if (index > 0) headers.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim())
  })
  return {
    get: function (name) { const value = headers.get(String(name).toLowerCase()); return value === undefined ? null : value },
    has: function (name) { return headers.has(String(name).toLowerCase()) },
  }
}

// fetch 子集：method / headers / body 与 Response.text() / json()；不支持流、AbortSignal 与 CORS
// （Qt 里没有同源策略）。网络错误与浏览器一样以 TypeError 拒绝。
export function fetch(input, init) {
  const options = init || {}
  return new Promise(function (resolve, reject) {
    const request = new XMLHttpRequest()
    request.onreadystatechange = function () {
      if (request.readyState !== XMLHttpRequest.DONE) return
      if (request.status === 0) {
        reject(new TypeError('Failed to fetch ' + input))
        return
      }
      const body = request.responseText
      resolve({
        ok: request.status >= 200 && request.status < 300,
        status: request.status,
        statusText: request.statusText,
        url: String(input),
        headers: parseHeaders(request.getAllResponseHeaders()),
        text: function () { return Promise.resolve(body) },
        json: function () {
          return new Promise(function (done) { done(JSON.parse(body)) })
        },
      })
    }
    request.open(options.method || 'GET', resolveUrl(input))
    const headers = options.headers || {}
    Object.keys(headers).forEach(function (name) { request.setRequestHeader(name, headers[name]) })
    request.send(options.body === undefined ? null : options.body)
  })
}

// WebSocket：包装 QtWebSockets 的 WebSocket，对齐 onopen / onmessage / onerror / onclose / send / close。
// 需要 Qt 安装 qtwebsockets 模块；缺失时构造即抛错，由 setup 的诊断兜住。
// 以 `new WebSocket(url)` 调用：构造函数返回对象时 `new` 取返回值，因此这里不碰 `this`。
export function WebSocket(url) {
  if (owner === null) throw new Error('WebSocket 只能在页面运行期间创建')
  const self = {}
  const socket = Qt.createQmlObject('import QtWebSockets; WebSocket {}', owner, 'compose-websocket')
  self.url = String(url)
  self.readyState = 0
  self.onopen = null
  self.onmessage = null
  self.onerror = null
  self.onclose = null
  // 每个连接只发一次 close。连接失败时 QtWebSockets 先报 Closed 再报 Error，而浏览器是 error 之后
  // close(1006) 各一次——因此 Closed 推迟一拍再发，期间来了 Error 就由 error 那一支发 close。
  let closed = false
  const emitClose = function (code, reason) {
    if (closed) return
    closed = true
    self.readyState = 3
    sockets.delete(self)
    if (self.onclose) self.onclose({ type: 'close', code: code, reason: reason })
  }
  socket.statusChanged.connect(function () {
    // QtWebSockets: Connecting 0, Open 1, Closing 2, Closed 3, Error 4
    if (socket.status === 1) {
      self.readyState = 1
      if (self.onopen) self.onopen({ type: 'open' })
    }
    else if (socket.status === 4) {
      if (closed) return
      if (self.onerror) self.onerror({ type: 'error', message: socket.errorString })
      emitClose(1006, socket.errorString)
    }
    else if (socket.status === 3) {
      schedule(function () { emitClose(1000, '') }, 0, false, [])
    }
  })
  socket.textMessageReceived.connect(function (data) {
    if (self.onmessage) self.onmessage({ type: 'message', data: data })
  })
  self.send = function (data) { socket.sendTextMessage(String(data)) }
  self.close = function () { self.readyState = 2; socket.active = false }
  sockets.add(self)
  socket.url = self.url
  socket.active = true
  return self
}
