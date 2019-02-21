/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

// 路径 ../util/env.js  
const seenObjects = new Set() 

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 * 递归遍历对象以调用所有已转换的getter，以便将对象内的每个嵌套属性收集为“深度”依赖项。
 */
export function traverse (val: any) {
  // 1 深度遍历val(被watch的值), 将 找到的有'__ob__'属性的值的...id(val.__ob__.dep.id)添加进seenObjects
  _traverse(val, seenObjects)
  // 2. 添加完 就清除 ??? 为什么 ??? 不懂
  // START ??????????????????
  seenObjects.clear()
}

function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val)

  // --1 不是数组、对象 || 是frozen对象 || 是VNode的实例,  则 return
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  // -------------------------------------------------------------
  // --2 如果该值是已被observe 的, 看看seen里面有没有 dep的id, 没有就添加
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    // --2.1
    if (seen.has(depId)) { return }
    // --2.2
    seen.add(depId)
  }
  // ------------------------------------------------------------
  // --3.1 被watch的是数组
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
  // --3.2 被watch的是对象
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
