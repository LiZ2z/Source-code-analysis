/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  handleError,
  formatComponentName
} from '../util/index'

import { updateListeners } from '../vdom/helpers/index'

export function initEvents (vm: Component) {
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // init parent attached events
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: any

function add (event, fn, once) {
  if (once) {
    target.$once(event, fn)
  } else {
    target.$on(event, fn)
  }
}

function remove (event, fn) {
  target.$off(event, fn)
}

export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, vm)
  target = undefined
}

// 初始化の三
export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/
  // 1 接收事件
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    // --- 1 如果传入的是事件名组成的数组, 则依次执行
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$on(event[i], fn)
      }
    } else {
      // --- 2.1 传入的是事件名, 将事件放入vm._events对应名称的属性数组中
      (vm._events[event] || (vm._events[event] = [])).push(fn)

      // --- 2.2 优化钩子：通过使用在注册时标记的布尔标志(而不是哈希查找)来降低事件成本。
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }

    }
    return vm
  }

  // 2 发布事件
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    // 1 检测事件名格式
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      // 1.1 事件名格式有问题(事件名必须小写), 警报
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    // 2 检测是否存在vm._events[event]
    let cbs = vm._events[event]
    if (cbs) {
      // 2.1 将传入$emit()中的参数(除了第一个), 都作为$on回调函数的参数
      const args = toArray(arguments, 1)
      // 2.2 触发事件
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      for (let i = 0, l = cbs.length; i < l; i++) {
        try {
          cbs[i].apply(vm, args)
        } catch (e) {
          handleError(e, vm, `event handler for "${event}"`)
        }
      }
    }
    return vm
  } // END emit

  // 3 注册一个只触发一次的事件(触发了一次之后就把事件删除掉)
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    function on () {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn
    vm.$on(event, on)
    return vm
  }

  // 4 删除注册的事件
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$off(event[i], fn)
      }
      return vm
    }
    // specific event
    const cbs = vm._events[event]
    if (!cbs) {
      return vm
    }
    if (!fn) {
      vm._events[event] = null
      return vm
    }
    if (fn) {
      // specific handler
      let cb
      let i = cbs.length
      while (i--) {
        cb = cbs[i]
        if (cb === fn || cb.fn === fn) {
          cbs.splice(i, 1)
          break
        }
      }
    }
    return vm
  }
  

}
