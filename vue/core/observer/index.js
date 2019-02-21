/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

// In some cases we may want to disable observation inside a component's update computation.
// 在某些情况下，可能希望在组件的更新计算中禁用观察
export let shouldObserve: boolean = true
export function toggleObserving (value: boolean) {
  shouldObserve = value
}

// 给被观察的对象添加个Observer实例作为其__ob__属性的值, 
// Observer 把目标对象的属性 转换成访问器属性, 
// 在属性的 setter 方法中 收集依赖项, 并派发更新
export class Observer {
  value: any;
  dep: Dep;
  // number of vms that has this object as root $data
  //将此对象作为根$data的VMS的数目 (机翻QAQ)
  vmCount: number; 

  constructor (value: any) {
    // 1 给Observer实例设置属性
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0

    // 2 把Observer实例设成 被观察目标对象的__ob__属性的值 
    def(value, '__ob__', this)  

    // 3.1 observe 数组
    if (Array.isArray(value)) {
      // 3.1.1 修改数组的原型方法, 当数组被修改(添加或者移除数组项)了, 根据依赖通知修改
      // 这里就是为什么vue不支持 arr[arr.length] = 'hehe' 等修改数组长度的操作, 因为监测不到修改
      const augment = hasProto ? protoAugment : copyAugment
      augment(value, arrayMethods, arrayKeys)
      // 3.1.2 数组列表中的每项也要observe
      this.observeArray(value)
    } else {
    // 3.2 oberse 普通对象
    // 只对目标对象中 每个属性的修改 进行监听, 对于对象属性的增添, 无法监测. 需要使用vue.$set
      // 将对象的属性全都转成访问器属性, 当给对象属性设置新的值时, 会通过属性的set 方法,在set方法中收集依赖并触发更新
      this.walk(value)
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   * 遍历每个属性并将其转换为getter/setter。
   * 只有当值类型为对象时才应调用此方法。
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }
  // 3.1.2 数组列表中的每项也要observe
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment（增加 ） an target Object or Array by intercepting（拦截）
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object, keys: any) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

// observe 函数
export function observe (value: any, asRootData: ?boolean): Observer | void {
  // --- 1 如果传入的值不是 对象 || 或者 是VNode实例, 不观察 直接返回
  if (!isObject(value) || value instanceof VNode) {return}
  // --- 2 如果传入的值已经被 observed ,直接返回
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) { // 已经被观察了
    ob = value.__ob__
  } 
  // --- 3.1 值是(普通对象 或 数组格式)且是可扩展的, 不是服务器渲染环境, 不是Vue根实例, 开始observe
  else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  // --- 3.2 如果传入了asRootData = true, vmCount ++   ??????
  if (asRootData && ob) {
    ob.vmCount++
  }
  
  return ob
}

/**
 * Define a reactive property on an Object.
 * 在一个对象上定义一个 reactive 属性 , 用来观察对象的
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean  // 浅
) {
  const dep = new Dep()

  // --- 1 当属性存在但是不可配置则 return
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // --- 2.1 保存原始的 setter \ getter
  const setter = property && property.set
  const getter = property && property.get
  // --- 2.2 如果不是访问器属性, 直接获取值
  if (!getter && arguments.length === 2) {
    val = obj[key]
  }

  // --- 2.3 判断是否需要深层observe
  let childOb = !shallow && observe(val) 
  // --- 2.4 把observe目标对象上的属性全转成 访问器属性
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      // 1 获取该属性的值 
      const value = getter ? getter.call(obj) : val
      // 2 如果当前Dep.target(Watcher实例) 存在, 向其中添加此项依赖 (此处用于Watcher)
      if (Dep.target) {
        dep.depend()
        // 如果 深层observe, 把child observer的依赖也添加进Dep.target
        if (childOb) {
          childOb.dep.depend()
          // 
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      // 3 把值 返回
      return value
    },
    set: function reactiveSetter (newVal) {
      // 1 获取旧的值
      const value = getter ? getter.call(obj) : val  //闭包 
      // --- 2.1 设置的值与原来的值相同  或 新值是NaN  则不触发更新
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      // 传进来的参数customSetter  no-self-compare 不跟自己比较
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()  
      }
      // ----------------------------------------------------
      
      // --- 2.2.1 根据原来的属性的类型, 设置新的值
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal  // 闭包
      }

      // --- 2.2.2 如果不是浅层的observe, 则继续 observe 新的值
      childOb = !shallow && observe(newVal)

      // --- 2.2.3 通知依赖项进行更新
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 * 在对象上设置属性。
 * 添加新属性，如果属性不存在则触发更改通知
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    !Array.isArray(target) &&
    !isObject(target)
  ) {
    warn(`Cannot set reactive property on non-object/array value: ${target}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    !Array.isArray(target) &&
    !isObject(target)
  ) {
    warn(`Cannot delete reactive property on non-object/array value: ${target}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.\
 * 当数组被 访问时, 收集数组元素的依赖项,
 * 因为我们不能像 property getter 那样拦截数组元素的访问
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    // 将依赖项 添加进 Dep.target
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
