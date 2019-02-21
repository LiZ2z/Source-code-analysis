/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0
// 初始化の一
export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // 1 给每个vm实例一个独一无二的 _uid
    vm._uid = uid++

    // 2 用于分析Vue性能
    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // 3 做个标志，避免vm实例被 observer
    vm._isVue = true
    // 4 merge options 合并选项
    if (options && options._isComponent) {
      // 4 --- 1 优化内部组件实例化，因为动态选项合并非常慢，并且没有任何内部组件选项需要特殊处理。
      initInternalComponent(vm, options)
    } else {
      // 4 --- 2 将Vue.options 跟 传入Vue构造函数的options参数合并起来 (根实例通过这里初始化)
      /*
      * resolveConstructorOptions(vm.constructor) 返回 vm.constructor.options
      * 即vm构造函数上的options属性
      * 该属性在 ../global-api/index.js中被添加
      */
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }

    // 5 初始化渲染代理
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm) 
    } else {
      vm._renderProxy = vm
    }
    // 6 暴露vm实例自身
    vm._self = vm
    // 7 初始化各种东西
    initLifecycle(vm)
    // --- 没看  003  2018-3-14
    initEvents(vm)
    // --- END 没看  003  2018-3-14
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data / props
    // 
    initState(vm)

    initProvide(vm) // resolve provide after data / props
    callHook(vm, 'created')
    // 8 给vm添加个_name属性, 再打个结束的标签
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }
    // 9 最终步骤, 把vm实例挂载在元素上
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}
// 初始化内部组件
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts._parentVnode = parentVnode
  opts.parent = options.parent
  opts._parentElm = options._parentElm
  opts._refElm = options._refElm

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

// 解析构造器选项, 在使用Vue.extend后，会记录super的 options     
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  // 1 如果实例通过 Vue.extend创建
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      // 超类的option改变了, 需要重新解析
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      // 检查是否有任何延迟修改/附加选项(#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)

      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  // 2 
  return options
}

// 解析修改的选项
function resolveModifiledOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const extended = Ctor.extendOptions
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = dedupe(latest[key], extended[key], sealed[key])
    }
  }
  return modified
}

function dedupe (latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated between merges
  // 比较最新的和密封的option，以确保生命周期挂钩不会在合并之间重复。
  if (Array.isArray(latest)) {
    const res = []
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    extended = Array.isArray(extended) ? extended : [extended]
    for (let i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    return latest
  }
}
