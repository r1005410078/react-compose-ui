// 页面脚本在 Qt 里的宿主：加载 setup、建作用域、把被绑定的导出写回本对象上的属性。
//
// 导出器为每个被绑定的导出名在本对象上生成一条 `property var x_<名>`（不给初值），绑定写成
// `text: page.x_temperature === undefined ? <静态值> : page.text(page.x_temperature)`。于是脚本
// 还没跑完、导出缺失、类型不符三种情形下，每个对象都显示它自己在文档里的静态值。
//
// 响应式语义来自 @compose-ui/script-runtime 的可移植产物（script-runtime.mjs），这里不实现任何
// state / computed / effect。
import QtQuick
import "script-runtime.mjs" as Runtime
import "globals.mjs" as Globals

QtObject {
    id: page

    // page.setup.mjs 导出的 setup 函数；没有 setup 的页面不会生成本对象。
    property var setup: null
    // 导出名 → { property: 本对象上的属性名, kinds: ['text' | 'color', ...] }。
    property var bindings: ({})
    property var scope: null

    // 绑定表达式里的值转换。
    function text(value) {
        return value === null || value === undefined ? "" : String(value)
    }
    function color(value) {
        // 文档用 CSS 的 #rrggbbaa / #rgba，Qt 读 #aarrggbb——与导出器的 qmlColor 同一条换算。
        const color = String(value).trim()
        let match = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/.exec(color)
        if (match) return ("#" + match[2] + match[1]).toLowerCase()
        match = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(color)
        if (match) return ("#" + match[4] + match[4] + match[1] + match[1] + match[2] + match[2] + match[3] + match[3]).toLowerCase()
        return color.toLowerCase()
    }
    // 调用脚本导出的方法；同步异常与 Promise 拒绝都归一为诊断。
    function call(name) {
        if (scope) scope.invokeMethod(name, Array.prototype.slice.call(arguments, 1))
    }

    function accepts(kind, value) {
        if (kind === "text") return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        if (kind === "color") return typeof value === "string"
        return false
    }

    property var reported: ({})
    // setup 本身失败（抛错、没返回对象、找不到 setup）时，每个绑定的「导出缺失」都只是它的后果，
    // 不再逐个报——否则一处抛错淹没成一屏警告，真正的原因反而不显眼。
    property bool setupFailed: false
    function report(code, name, message) {
        if (setupFailed && code === "script.binding-missing-export") return
        const key = code + ":" + name
        if (reported[key]) return
        reported[key] = true
        console.warn("[compose] " + code + " " + message)
        scope.reportDiagnostic({ code: code, message: message })
    }

    function sync(name) {
        const binding = bindings[name]
        const item = scope.getExport(name)
        if (!item || item.kind !== "value") {
            page[binding.property] = undefined
            report("script.binding-missing-export", name, "绑定的导出「" + name + "」不存在，保持静态值")
            return
        }
        for (let i = 0; i < binding.kinds.length; i++) {
            if (!accepts(binding.kinds[i], item.value)) {
                page[binding.property] = undefined
                report("script.binding-type-mismatch", name, "导出「" + name + "」的值不能用于 " + binding.kinds[i] + "，保持静态值")
                return
            }
        }
        page[binding.property] = item.value
    }

    Component.onCompleted: {
        // 本文件在 ComposeRuntime/ 里，上一级就是场景文件所在目录。
        Globals.attach(page, Qt.resolvedUrl("../"))
        scope = Runtime.createComposePageScriptScope(setup)
        // 先打印 setup 自己的诊断，再同步绑定：同步阶段的诊断由 report 自己打印，放在后面打印
        // 快照会把它们再打一遍。
        const diagnostics = scope.getSnapshot().diagnostics
        for (let i = 0; i < diagnostics.length; i++) {
            const code = diagnostics[i].code
            if (code === "script.setup-threw" || code === "script.invalid-return" || code === "script.missing-setup") setupFailed = true
            console.warn("[compose] " + code + " " + diagnostics[i].message)
        }
        const names = Object.keys(bindings)
        for (let i = 0; i < names.length; i++) {
            const name = names[i]
            sync(name)
            scope.subscribeExport(name, function () { sync(name) })
        }
    }

    Component.onDestruction: {
        if (scope) scope.dispose()
        Globals.detach(page)
    }
}
