/* @flow */

export default class VNode {
  tag: string | void;
  data: VNodeData | void;
  children: ?Array<VNode>;
  text: string | void;
  elm: Node | void;
  ns: string | void;
  context: Component | void; // rendered in this component's scope||在此组件的作用域中呈现
  key: string | number | void;
  componentOptions: VNodeComponentOptions | void;
  componentInstance: Component | void; // component instance  || 组件实例
  parent: VNode | void; // component placeholder node || 组件占位符节点

  // strictly internal
  raw: boolean; // contains raw HTML? (server only) || 包含原始HTML？(仅服务器)
  isStatic: boolean; // hoisted static node  || 吊装静态节点
  isRootInsert: boolean; // necessary for enter transition check || 用于 输入转换检查
  isComment: boolean; // empty comment placeholder?  || 空的注释占位符
  isCloned: boolean; // is a cloned node?  || 克隆节点
  isOnce: boolean; // is a v-once node?  || v-once 节点
  asyncFactory: Function | void; // async component factory function || 异步组件工厂函数
  asyncMeta: Object | void;
  isAsyncPlaceholder: boolean;
  ssrContext: Object | void;
  fnContext: Component | void; // real context vm for functional nodes || 用于功能节点的真实上下文VM
  fnOptions: ?ComponentOptions; // for SSR caching || 用于 SSR换缓存
  fnScopeId: ?string; // functional scope id support || 功能范围id支持


  constructor (
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    this.tag = tag
    this.data = data
    this.children = children
    this.text = text
    this.elm = elm
    this.ns = undefined
    this.context = context
    this.fnContext = undefined
    this.fnOptions = undefined
    this.fnScopeId = undefined
    this.key = data && data.key
    this.componentOptions = componentOptions
    this.componentInstance = undefined
    this.parent = undefined
    this.raw = false
    this.isStatic = false
    this.isRootInsert = true
    this.isComment = false
    this.isCloned = false
    this.isOnce = false
    this.asyncFactory = asyncFactory
    this.asyncMeta = undefined
    this.isAsyncPlaceholder = false
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  //弃用： 向后兼容的 componentInstance 别名
  /* istanbul ignore next */
  get child (): Component | void {
    return this.componentInstance
  }
}

export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  node.text = text
  node.isComment = true
  return node
}

export function createTextVNode (val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
/*
* 用于静态节点和槽节点的优化浅层克隆，
* 因为它们可以跨多个呈现重用，因此克隆
* 它们可以避免DOM操作依赖于它们的elm引用时出现错误。
*/
export function cloneVNode (vnode: VNode): VNode {
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    vnode.children,
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  )
  cloned.ns = vnode.ns
  cloned.isStatic = vnode.isStatic
  cloned.key = vnode.key
  cloned.isComment = vnode.isComment
  cloned.fnContext = vnode.fnContext
  cloned.fnOptions = vnode.fnOptions
  cloned.fnScopeId = vnode.fnScopeId
  cloned.isCloned = true
  return cloned
}
