/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 * 被observe的数据 都会生成一个 dep,  dep会被若干个watcher依赖
 * 一个 watcher会有 若干个 dep 
 */
export default class Dep {
  static target: ?Watcher;  //  ??? 不是没有静态属性么
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++   // 每个dep 有一个唯一的 id
    this.subs = []
  }

  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  notify () {
    // 获取订阅列表副本, 对副本进行操作不影响原数组
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}



//当前 evaluated （计算, 不知怎么翻译） 的目标Watcher。   全局唯一，因为在任何时候只能有一个watcher在被evaluated。
Dep.target = null
const targetStack = []    // target 堆栈


export function pushTarget (_target: ?Watcher) {
  if (Dep.target) targetStack.push(Dep.target)
  Dep.target = _target
}

export function popTarget () {
  Dep.target = targetStack.pop()
}
