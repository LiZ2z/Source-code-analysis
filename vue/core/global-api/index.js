/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // 1 把全局config 添加为 Vue的只读属性
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        //不要替换Vue.config对象，而是设置单独的字段。
        'Do not replace the Vue.config object, set individual fields instead.' 
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  // 2.1 暴露 功能性 的方法.  这些都不是公共api的一部分--避免依赖。
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }
  // 2.2 
  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.3 给Vue设置各种options
  Vue.options = Object.create(null)
  // ASSET_TYPES = [component', 'directive', 'filter']
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })


  //  它用于标识“基本”构造函数Vue，以扩展所有在weex的多实例场景中使用的普通对象组件
  Vue.options._base = Vue

  extend(Vue.options.components, builtInComponents)
  /*
  * Vue.options = {
  *             components: {
      *                           KeepAlive: {....}
      *                       },
      *             directives: {},
      *             filters: {},
      *             _base = Vue
      *   }
      */    

  // 3 
  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  initAssetRegisters(Vue)
}
