/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'

export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
   /* 每个实例构造函数(包括Vue Vue.cid = 0)都有一个惟一的cid(Constructor id)。
   *  这使我们能够为原型继承创建一个包装的“子构造函数”并缓存它们。
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   */
  Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {}
    const Super = this // 最开始是 Vue, 如果是进一步extend 就是
    const SuperId = Super.cid
    // 从extendOptions 的构造函数缓存 属性(没有就 创建一个)里面 根据Super.cid找 构造函数, 找到就返回 ,没有就创建
    // 1 避免重复 创建
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) { return cachedCtors[SuperId] }

    // 2 验证 component name属性格式是否正确
    const name = extendOptions.name || Super.options.name // 自己没有name 就用 超类型构造函数的name
    if (process.env.NODE_ENV !== 'production' && name) {
      validateComponentName(name)
    }
    // 3 创建一个 子类型构造函数
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    // 3.1 让子类型构造函数的原型 继承 超类型构造函数(Vue or ..)的原型
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
    // 3.2 给子类型构造函数一个独一的 cid
    Sub.cid = cid++
    // 3.3 把传入Vue.extend() 的options参数, 跟超类型构造函数(Vue or ..)的options属性合并起来
    // 设为 子类型构造函数(VueComponent)的options属性
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    // 3.4 一个指针, 超类型构造函数（Vue or ..）
    Sub['super'] = Super

    // !!! !!! !!! !!! !!! !!! !!! !!! !!! !!! !!! !!! 
    // 4 ??? 对于props和计算属性，扩展时，在Vue原型上定义 proxy getter。
    //    这样就避免了每次创建实例时 都要调用Object.defineProperty。
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }
    // -----------------------------------------------

    // 5 允许进一步扩展/混合/插件使用
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    // 6 创建 asset 存储, 这样 extended 类型就有他们自己的assets
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // 7 启用递归自查找
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    // 8 在extend时, 保留一个对超类型options属性的一个引用. 稍后在实例化的时候,就可以检查Super`s options 是否更新
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)  // 密封的


    // 9 缓存构造函数  Sub.options._Ctor[SuperId] = Sub, 避免重复创建
    cachedCtors[SuperId] = Sub

    return Sub

  }  // END  Vue.extend
}  // END initExtend


// Comp = Sub ， 把props属性添加到Comp.ptototype上, 在每个实例中都可以通过this.dataMsg访问,
// 只是proxy, 通过this.dataMsg访问的还是this._props.dataMsg
// 这里
function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
