/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * Watcher 解析一个表达式，收集依赖项，并在表达式值更改时触发回调。
 * 用于 $watch()api 和 directives
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  getter: Function;
  value: any;
  /*
    expOrFn => 要watch 的 属性名称, 或者可以返回 属性名称的函数
    cd => 回调函数
  */
  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    // 1 Watcher实例的vm属性指向 其所属的vm
    this.vm = vm
    // 2 如果isRenderWatcher(是渲染DOM的Watcher) 就给vm设置 _watcher属性
    if (isRenderWatcher) {
      vm._watcher = this
    }
    // 3 向vm的 _watchers 数组属性 添加 这个Watcher实例
    vm._watchers.push(this)

    // 4 根据传入构造函数的options 给 这Watcher实例设置相应的属性
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user  // 用户添加的watcher
      this.lazy = !!options.lazy
      this.sync = !!options.sync
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    // 5 给 Watcher添加各种属性
    this.cb = cb // callback
    this.id = ++uid // uid for batching 批处理   好像是全局唯一的id
    this.active = true
    this.dirty = this.lazy // for lazy watchers  

    this.deps = []
    this.newDeps = []

    this.depIds = new Set()
    this.newDepIds = new Set()

    this.expression = process.env.NODE_ENV !== 'production'? expOrFn.toString() : ''
    // 6 解析传入构造函数的 expOrFn 参数, 将其值 或 返回值 设为 Watcher实例 getter属性的 值 (存储获取值的方法)
    // 6.1 实例的getter属性指向的 是被观察的属性名, 如果expOrFn 参数不是 function ,就要进行解析处理了, 
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
      // 6.1.1 解析出问题了 就警告一下, 不影响继续执行, 基本上是废了
      if (!this.getter) {
        this.getter = function () {}
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 7 该属性用于存储旧的值, 根据传入构造函数的options参数中的lazy属性 设置Watcher实例的 value属性
    this.value = this.lazy ? undefined : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    // 1 将这个Watcher实例推入 Dep.target, 这东西全局唯一, 所以先将 原来的Dep.target先存入 target 堆栈
    pushTarget(this)
    // 2 获取 Watcher所 watch的值, 并处理
    let value
    const vm = this.vm
    try {
      // 2.1 获取值 !!!!!!!!!!!!!!!!!!!!

      // 这里的获取属性值 会触发 属性(已被observe) 的 getter 函数
      // 例子: vm._data 已被 observe, _data中某个属性在被get时, 
      // 会把自身的依赖添加进Dep.target (路径 ./index.js reactiveGetter 方法中get)
      // 此时的Dep.target 已经在上面被设置成这个Watcher实例了, 
      // 所以相互对应
      value = this.getter.call(vm, vm)

    } catch (e) {
      // 2.2 获取出错, 处理
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // 2.3 出错或不出错 反正都要执行的步骤
     
      // 2.3.1 'touch' 每个属性，以便它们都作为依赖项被跟踪，以便进行深入观察
      //深度遍历value(被watch的值), 将 找到的有'__ob__'属性的值的...id(val.__ob__.dep.id)添加进一个 new Set()
      if (this.deep) {
        //路径  ./traverse.js  
        traverse(value)  // >>>>>>>>>>>>>>?????????????????????? 有疑问
      }
      
      // 2.3.2 归位在步骤 1 时 被放入堆栈的原来的 Dep.target
      popTarget()

      // 2.3.4 
      this.cleanupDeps()
    }

    // 3 返回处理完的值
    return value
  }

  /**
   * Add a dependency to this directive.  向此指令添加依赖项
   */
  addDep (dep: Dep) {
    const id = dep.id
    // 1 如果Watcher实例的 newDepIds属性(Set格式)中 没有这个依赖项id, 就添加进去
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)

      // 1.1 如果Watcher实例的 depIds属性(Set格式)中 没有这个依赖项id,
      // 就向这个依赖项的sub属性中加入这个Watcher实例
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.清理依赖项集合。
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * 订阅接口, 当依赖改变时被调用
   * Subscriber interface. Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true // this.dirty 默认 等于 this.lazy
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }

  /**
   * 调度程序作业接口。将由调度程序调用。
   * Scheduler job interface. Will be called by the scheduler. 
   */
  run () {
    if (this.active) {  // this.active 默认 为 true 
      // 1 获取新的值
      const value = this.get()
      // 2 分析新值的变化及 是不是 对象
      if (
        value !== this.value ||
        //即使值相同，对象/数组上的深度观察者和观察者也应该触发事件，因为值可能已经发生了变异 。
        // (如对数组使用splice, push方法, 此时数组虽然还是那个数组, 但实际值不同了)
        isObject(value) ||
        this.deep
      ) {
        // 2.1 把新的值存储到 this.value(下次就变成旧的了)
        const oldValue = this.value
        this.value = value
        // 2.2 触发回调函数
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * 收集 依赖于这个watcher 所有dep  所依赖的数据
   * Depend on all deps collected by this watcher. 
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   * 把此 Watcher实例从所有依赖的订阅列表中 移除
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it if the vm is being destroyed.
      
      // 从vm实例的 _watchers 属性中移除这个 Watcher实例, 
      // 这个操作代价有些大, 如果vm实例 being destroyed了, 就别再执行

      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
