/* @flow */

import config from '../config'
import { warn } from './debug'
import { nativeWatch } from './env'
import { set } from '../observer/index'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 * 选项复写策略  定义 parent 及 child 中属性 的合并方式
 */
const strats = config.optionMergeStrategies

strats.provide = mergeDataOrFn

/**
 * Options with restrictions 有限制的选项
 * 系统自带的两个特殊的属性(el, propsData) 的合并策略
 * 默认策略: child中的同名属性 会覆盖 parent 中的
 * 即子组件有值就返回子组件的, 否则就返回父组件的值
 */ 
if (process.env.NODE_ENV !== 'production') {

  strats.el = strats.propsData = function (parent, child, vm, key) {
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}

/**
 * 用于处理 递归合并两个数据对象
 */
// 合并data第三步, 真正的合并  就是把parent.data中的数据全部 拷贝到  child.data上, 然后返回 child.data
// 遍历 parent.data中的每个属性, 
// 然后判断child.data 是否有相同属性名的 属性, 没有就 set()  
// 如果有 再判断 parent.data 和 child.data 此同名属性的值 是不是都是 对象 true则继续mergeData
// 
//
function mergeData (to: Object, from: ?Object): Object {
  if (!from) return to
  let key, toVal, fromVal
  const keys = Object.keys(from)
  for (let i = 0; i < keys.length; i++) {
    key = keys[i]       //from的某属性
    toVal = to[key]     // to[from的某属性]
    fromVal = from[key]  // from[from的某属性]
    if (!hasOwn(to, key)) {   // to 没有 from的某属性
      set(to, key, fromVal)
    } else if (isPlainObject(toVal) && isPlainObject(fromVal)) {
      mergeData(toVal, fromVal)
    }
  }
  return to
}

// 合并data第二步, child.data 或 parent.data 如果是 函数, 则运行 并获取内部对象
// child.data 或 parent.data 有一个是 undefined 则返回另一个
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {   // --------------没看--------------
    // in a Vue.extend merge, both should be functions
    // 在 vue.extend 合并时, parent 和 child 的 data 都应该是函数
    // 如果有一不存在就用另一个
    if (!childVal) {
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions.
    // 我们需要返回一个函数，该函数返回两个函数的合并结果
    // no need to check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    //这里不需要检查parentVal是否是一个函数，因为它必须是一个传递先前合并的函数
    return function mergedDataFn () {
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this, this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
      )
    }
  } else {
    return function mergedInstanceDataFn () {
      // instance merge 实例合并
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm, vm)
        : childVal
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm, vm)
        : parentVal
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}
// 合并data第一步, 先判断是不是第一次初始化
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {   // --------------没看--------------
  // 没有vm的 应该不是根实例 而是由component 等添加的实例, 所以要验证data是函数
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )
      return parentVal
    }
    return mergeDataOrFn(parentVal, childVal)
  }

  return mergeDataOrFn(parentVal, childVal, vm)
}



/**
 * Watchers.
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 * 观察者 hashes 不应该覆盖另一个, 所以应该合并为数组
 */
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // work around Firefox's Object.prototype.watch... 
  // 火狐浏览器中自带 Object.prototype.watch 
  // MDN是这么说的 
  /* 你应该尽量避免使用 watch()和  unwatch() 这两个方法。
  *  因为只有 Gecko 实现了这两个方法，并且它们主要是为了在调试方便。
  *  另外，使用 watchpoint 对性能有严重的负面影响，在全局对象（如 window）上使用时尤其如此。
  *  你可以使用 setters and getters 或者 proxy 代替。
  */
  // 所以要把 对象中继承的watch设为 undefined
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined

  /* istanbul ignore if */
  // ??? 001  2018-3-14  ???
  // 创建一个继承的实例, 为什么创建实例呢?? 这样行不行?  parentVal || Object.create(null) 
  if (!childVal) return Object.create(parentVal || null)  

  if (process.env.NODE_ENV !== 'production') {
    // 只需要检测childVal, 因为(非火狐浏览器)初始化时, parent 即 Vue.watch是undefined,
    // 然后如果有childVal且是对象就会返回 childVal 不然就返回 {} , 合并了之后parent的watch肯定是对象
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal

  const ret = {}
  extend(ret, parentVal)  //  parent extend  ret
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent
      ? parent.concat(child)
      : Array.isArray(child) ? child : [child]
  }

  return ret
}

/**
 * Other object hashes.
 * child 的配置 覆盖掉 parent 的配置
 * 例如 child 和 parent 的methods中都有一个hanler函数
 * child的handler会覆盖 parent 中的 handler
 * 
 */
strats.props =  
strats.methods =
strats.inject =
strats.computed = 
function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  if (childVal && process.env.NODE_ENV !== 'production') {
    // 判断 childVal 是不是普通对象格式, 不是就报错
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = Object.create(null)
  extend(ret, parentVal)
  if (childVal) extend(ret, childVal)
  return ret
}

/**
 * 钩子和 props ??? 作为数组合并  哪里来的props
 * Hooks and props are merged as arrays. 
 * 
 */
function mergeHook (
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  return childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
}

LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 * child中的 属性会 覆盖 parent 中的同名属性
 */
function mergeAssets (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  const res = Object.create(parentVal || null)
  if (childVal) {
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    return extend(res, childVal)
  } else {
    return res
  }
}

ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})


/**
 * Default strategy.默认策略。
 * 即子组件有值就返回子组件的, 否则就返回父组件的值
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * Validate component names
 */
function checkComponents (options: Object) {
  for (const key in options.components) {
    validateComponentName(key)
  }
}
// compoent 的名字格式规范化 'a-b-c', 且不能为 内建标签 slot component 等
export function validateComponentName (name: string) {
  if (!/^[a-zA-Z][\w-]*$/.test(name)) {
    warn(
      'Invalid component name: "' + name + '". Component names ' +
      'can only contain alphanumeric characters and the hyphen, ' +
      'and must start with a letter.'
    )
  }
   // isBuiltInTag = makeMap('slot,component', true)
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component ' +
      'id: ' + name
    )
  }
}

/**                         语句
 * Ensure all props option syntax are normalized into the
 * Object-based format.  //基于对象的格式
 * 确保所有props选项语法规范化为基于对象的格式.
 * 
 * 
 * 如果props是数组格式 : ['a', 'b-c']
 * porps 键转成驼峰式, 且值都为{type: null}
 *             {
 *                a: {type: null},
 *                bC: {type: null} 
 *             }
 * 如果props 是普通对象 { 
 *                a: String,
 *                'b-c': {
 *                    type: Number,
 *                    default: 8
 *                }
 *              }
 * props键转成驼峰式, 根据值的类型转换
 *              {
 *                a: {type: String},
 *                bC: {
 *                    type: Number,
 *                    default: 8
 *                    }
 *              }
 */
function normalizeProps (options: Object, vm: ?Component) {
  const props = options.props
  if (!props) return
  const res = {}
  let i, val, name
  if (Array.isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]
      if (typeof val === 'string') {
        name = camelize(val)
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        // 加上 process.env.NODE_ENV !== 'production' 在开发环境中不报错
        // 使用数组语法时，props必须是字符串。
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) {
    for (const key in props) {
      val = props[key]
      name = camelize(key)
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  options.props = res
}

// --- START normalizeInject  没看 -1  2018-3-12 第二天    暂时不知道注入是干嘛的 ?? 
/**
 * Normalize all injections into Object-based format
 */
function normalizeInject (options: Object, vm: ?Component) {
  const inject = options.inject
  if (!inject) return
  const normalized = options.inject = {}
  if (Array.isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = { from: inject[i] }
    }
  } else if (isPlainObject(inject)) {
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}
// --- END normalizeInject  没看 -1


/**
 * Normalize raw function directives into object format.
 * 将 函数式的directives 转成 对象格式
 * direction :{
        test: function() {}
     }
  ==> 
   direction: {
        test: {
            bind : function () {},
            update : function () {}
        }
   }   
 */
function normalizeDirectives (options: Object) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}
// 判断 value 是不是普通对象格式, 不是就报错
//                      name(props methods ...)   value    vm
function assertObjectType (name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 * 用于实例化和继承的核心实用程序。
 */
export function mergeOptions (
  parent: Object,
  child: Object,
  vm?: Component
): Object { 
  if (process.env.NODE_ENV !== 'production') {
    // 检查实例的 components 的名字格式是否正确
    checkComponents(child)
  }
  if (typeof child === 'function') {
    child = child.options
  }
  normalizeProps(child, vm)  // 规范化props
  normalizeInject(child, vm) // 规范化注入
  normalizeDirectives(child)  // 规范化指令 


  // 将child中的 extends 及 mixins 的option 都先跟parent合并进来
  const extendsFrom = child.extends
  if (extendsFrom) {
    parent = mergeOptions(parent, extendsFrom, vm)
  }
  if (child.mixins) {
    for (let i = 0, l = child.mixins.length; i < l; i++) {
      parent = mergeOptions(parent, child.mixins[i], vm)
    }
  }


  /* 此函数核心部分 */
  const options = {}
  let key
  // 开始合并 data, methods, watch ....等属性
  function mergeField (key) {
    // 用对应的合并策略来合并
    // 默认规则是 子组件有的属性就用子组件的
    const strat = strats[key] || defaultStrat  
    options[key] = strat(parent[key], child[key], vm, key)
  }

  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    // 不是 parent 自身的属性 都合并, 此判断避免重复合并
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
