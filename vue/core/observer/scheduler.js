/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

/**
 * Flush both queues and run the watchers.
 */
function flushSchedulerQueue () {
  flushing = true
  let watcher, id

  // 1 刷新前对 queue进行排序(根据每个watcher的id大小), 以确保: 
  //    (1) 按先父组件后子组件的顺序对watcher进行 update (因为父组件总是先于子组件创建)
  //    (2) 组件中 用户自定义的 watchers先于 组件自身的 render watcher (因为用户定义的watchers 先于 render watcher 创建)
  //    (3) 如果一个组件因为 运行父组件的watcher 而被销毁了, 那它的watcher会被跳过
  queue.sort((a, b) => a.id - b.id)

  // 2 不能用 index = 0, len = queue.lenght; index < len 这样缓存length, 因为 在运行过程中可能有更多的watcher 被推入数组
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    id = watcher.id
    // 2.1 刷新queue
    has[id] = null
    // 2.2 run 
    watcher.run()
    // 2.3 在开发环境中, 检测 并 阻止 circular updates, 防止陷入死循环，内存不足
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // 3 在重置状态之前保留行队列副本  keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()
  // 4 重置队列
  resetSchedulerState()

  // 5 通知组件 更新和激活 生命周期钩子函数(Update)   call component updated and activated hooks
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)

  // 6 devtool hook, 给浏览器中的Vue开发工具发送数据
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }

} // END   flushSchedulerQueue

// 通知组件 激活Updated 钩子函数
function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm._watcher === watcher && vm._isMounted) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}
//  通知组件 激活Activated 钩子函数(keep-alive 组件激活时调用)
function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * 将观察者推入观察者队列。具有重复ID的作业将被跳过，除非它在队列被刷新（flushSchedulerQueue） 时被推送。
 * 
 */
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  // 1 如果has(对象, id: true) 中没有这个watcher, 就添加
  //    这里不用全等, 因为第一次添加时 has[id] === undefined , 
  //    后续操作中(flushSchedulerQueue)  has[id] 会被赋值 null
  if (has[id] == null) {
    has[id] = true
    // 1.1 --- 1 如果此时没在刷新, 就推入观察者队列
    if (!flushing) {
      queue.push(watcher)
    } 
    // 1.1 ---2 如果正在刷新，根据传入watcher的id 的数值大小，将 watcher插入queue。 
    //       如果已经past它的id(当前正在flushSchedulerQueue中运行的watcher的id小于此id)，它将立即运行。
    else {
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }

    // 1.2 如果没在等待 queue the flush
    if (!waiting) {
      waiting = truel
      nextTick(flushSchedulerQueue)
    }
  }
}
