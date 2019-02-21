/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 * 不在这个文件中 使用flow 进行类型检查, 因为flow对于 数组原型上的动态访问方法 支持不好
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 * 拦截 mutating(突变) 方法 同时 发布事件
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {

    const result = original.apply(this, args)  // 记录原生方法的操作结果
    const ob = this.__ob__

    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted) // observer 新添加进来的数组项
    // notify change  通知修改
    ob.dep.notify()
    return result
  })
})
