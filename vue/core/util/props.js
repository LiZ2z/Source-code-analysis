/* @flow */

import { warn } from './debug'
import { observe, toggleObserving, shouldObserve } from '../observer/index'
import {
  hasOwn,
  isObject,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
};

/*  验证 prop
    1. 先检查 prop 的期待(type)中有没有布尔值,  you => 若父组件未传这个prop且prop没设default, 返回false
                                            若父组件传值 为 '' or 同名字符串,判断所期待(type)的布尔值的优先级更高, 返回true
    2. 父组件未传prop, 获取默认值

*/

export function validateProp (
  key: string,
  propOptions: Object,
  propsData: Object,
  vm?: Component
): any {
  const prop = propOptions[key]
  const absent = !hasOwn(propsData, key)
  let value = propsData[key]
  // boolean casting 
  const booleanIndex = getTypeIndex(Boolean, prop.type) 
  // 当期待的 有布尔值时
  if (booleanIndex > -1) {   
    if (absent && !hasOwn(prop, 'default')) {  // 如果未传值, 且prop没有default值
      value = false
    } else if (value === '' || value === hyphenate(key)) { 
      // 当期待的是布尔值时 props = { someProp: Boolean }
      // 在传递prop时， 可以这么写 <components some-prop /> || <components some-prop ='' /> ，都会被判定为传递了 true
      // only cast empty string / same name to boolean if
      // boolean has higher priority
      // 如果布尔值具有较高的优先级 props: { isTrue: [Boolean, String]}，
      // 则将 空字符串/同名 <components is-true /> || <components is-true ='' /> 强制转换为布尔值 true。  
      const stringIndex = getTypeIndex(String, prop.type)
      if (stringIndex < 0 || booleanIndex < stringIndex) {
        value = true
      }
    }
  }
  // check default value
  if (value === undefined) {
    value = getPropDefaultValue(vm, prop, key)
    // since the default value is a fresh copy,
    // make sure to observe it.
    const prevShouldObserve = shouldObserve  // 记录, 用于下面归位
    toggleObserving(true)
    observe(value)  // 由于默认值是一个新的副本, 确保要 observer 它, 如果是基础类型的, 则直接return
    toggleObserving(prevShouldObserve)  // 归位
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    // skip validation for weex recycle-list child component props
    !(__WEEX__ && isObject(value) && ('@binding' in value))
  ) {
    assertProp(prop, key, value, vm, absent)
  }
  return value
}

/**
 * Get the default value of a prop.
 */
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // no default, return undefined
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  const def = prop.default
  // warn against non-factory defaults for Object & Array
  // 如果prop期待的是一个Object & Array , 则默认值必须通过 function 返回   ??? 为啥呢
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  //  ？？？？？？？？？？？？？？？？？
  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  // 如果在上一个渲染中  raw prop 值 也未定义, 则返回上一个默认值 以避免触发不必要的 wachter
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }
  //  ？？？？？？？？？？？？？？？？？
  
  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  // 如果prop的 期待的不是一个Function, 而默认值是一个函数, 就返回这个函数的执行结果, 默认返回 def
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 */
function assertProp (
  prop: PropOptions,
  name: string,
  value: any,
  vm: ?Component,
  absent: boolean
) {
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }
  if (value == null && !prop.required) {
    return
  }
  let type = prop.type
  let valid = !type || type === true
  const expectedTypes = []
  if (type) {
    if (!Array.isArray(type)) {
      type = [type]
    }
    for (let i = 0; i < type.length && !valid; i++) {
      const assertedType = assertType(value, type[i])
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }
  if (!valid) {
    warn(
      `Invalid prop: type check failed for prop "${name}".` +
      ` Expected ${expectedTypes.map(capitalize).join(', ')}` +
      `, got ${toRawType(value)}.`,
      vm
    )
    return
  }
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/

function assertType (value: any, type: Function): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  const expectedType = getType(type)
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value)
  } else {
    valid = value instanceof type
  }
  return {
    valid,
    expectedType
  }
}

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 * 用函数的字符串名称检测 内建类型, 因为简单的相等判断 在运行不同的 vms/ iframes 时会失败
 */
function getType (fn) {
  const match = fn && fn.toString().match(/^\s*function (\w+)/)
  return match ? match[1] : ''
}

function isSameType (a, b) {
  return getType(a) === getType(b)
}

function getTypeIndex (type, expectedTypes): number {
  if (!Array.isArray(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  for (let i = 0, len = expectedTypes.length; i < len; i++) {
    if (isSameType(expectedTypes[i], type)) {
      return i
    }
  }
  return -1
}
