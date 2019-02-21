/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
	set,
	del,
	observe,
	defineReactive,
	toggleObserving
} from '../observer/index'

import {
	warn,
	bind,
	noop,
	hasOwn,
	hyphenate,
	isReserved,
	handleError,
	nativeWatch,
	validateProp,
	isPlainObject,
	isServerRendering,
	isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
	enumerable: true,
	configurable: true,
	get: noop,
	set: noop
}

export function proxy (target: Object, sourceKey: string, key: string) {
	sharedPropertyDefinition.get = function proxyGetter () {
		return this[sourceKey][key]
	}
	sharedPropertyDefinition.set = function proxySetter (val) {
		this[sourceKey][key] = val
	}
	// 将vm._data中的属性都 设成vm自身的访问器属性
	Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
	vm._watchers = []
	const opts = vm.$options
	if (opts.props) initProps(vm, opts.props)
	if (opts.methods) initMethods(vm, opts.methods)
	if (opts.data) {
		initData(vm)
	} else {
		observe(vm._data = {}, true /* asRootData */)
	}
	if (opts.computed) initComputed(vm, opts.computed)
	if (opts.watch && opts.watch !== nativeWatch) {
		initWatch(vm, opts.watch)
	}
}
    
function initProps (vm: Component, propsOptions: Object) {
	//只用于 new 创建的实例中。创建实例时传递 props。主要作用是方便测试。
	const propsData = vm.$options.propsData || {} 
	const props = vm._props = {}
	// cache prop keys so that future props updates can iterate using Array
	// instead of dynamic object key enumeration.
	// 缓存 prop keys 这样以后props更新时, 就可以用array更新, 而不是用动态的枚举 object keys
	const keys = vm.$options._propKeys = []
	// START   ????? ??????????????????????????????
	const isRoot = !vm.$parent
	// root instance props should be converted  根实例的props应该被转换
	if (!isRoot) {
		toggleObserving(false)  // 不是根实例 props 就不observer ???
	}
	// END   ????? ??????????????????????????????
	
	for (const key in propsOptions) {
		keys.push(key)
		const value = validateProp(key, propsOptions, propsData, vm)  // 验证prop格式
		/* istanbul ignore else */
		if (process.env.NODE_ENV !== 'production') {
			// 禁止使用保留 属性 key,ref,slot,slot-scope,is
			const hyphenatedKey = hyphenate(key)
			if (isReservedAttribute(hyphenatedKey) ||
					config.isReservedAttr(hyphenatedKey)) {
				warn(
					`"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
					vm
				)
			}
			 // 对props中不是默认值的进行 defineReactive
			defineReactive(props, key, value, () => { 
				if (vm.$parent && !isUpdatingChildComponent) {
					warn(
						`Avoid mutating a prop directly since the value will be ` +
						`overwritten whenever the parent component re-renders. ` +
						`Instead, use a data or computed property based on the prop's ` +
						`value. Prop being mutated: "${key}"`,
						vm
					)
				}
			})

		} else {
			defineReactive(props, key, value)
		}
		// static props are already proxied on the component's prototype
		// during Vue.extend(). We only need to proxy props defined at
		// instantiation here.
		// 静态 props 已经在Vue.extend() 时 在组件的原型 
		// 这里我们只需 proxy 在 实例时 定义 的props
		if (!(key in vm)) {
			proxy(vm, `_props`, key)
		}
	}
	toggleObserving(true)
}

function initData (vm: Component) {
	// 1 从vm.$options.data中提取 data, 并设置成vm._data的值
	let data = vm.$options.data
	data = vm._data = typeof data === 'function'
		? getData(data, vm)
		: data || {}
	// 2 如果 data 不是普通对象格式, 警告一下
	if (!isPlainObject(data)) {
		data = {}
		process.env.NODE_ENV !== 'production' && warn(
			'data functions should return an object:\n' +
			'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
			vm
		)
	}
	// 3 在实例上proxy data       proxy data on instance
	const keys = Object.keys(data)
	const props = vm.$options.props
	const methods = vm.$options.methods
	let i = keys.length
	while (i--) {
		const key = keys[i]
		// 3.1 验证 data中的属性名 跟方法中的属性名 相同, 报错
		if (process.env.NODE_ENV !== 'production') {
			if (methods && hasOwn(methods, key)) {
				warn(
					`Method "${key}" has already been defined as a data property.`,
					vm
				)
			}
		}
		// 3.2 验证 data中的属性名 跟props中的属性名 相同, 报错
		if (props && hasOwn(props, key)) {
			process.env.NODE_ENV !== 'production' && warn(
				`The data property "${key}" is already declared as a prop. ` +
				`Use prop default value instead.`,
				vm
			)
		} 
		// 3.3 如果data中的属性名 不是vue的保留字, 就proxy
		// 将vm._data中的属性都 设成vm自身的访问器属性
		// 这样就可以通过 this.msg 调用, 实际访问的还是 this._data.msg
		else if (!isReserved(key)) {
			proxy(vm, `_data`, key)
		}
	}
	// 4 observe data
	observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
	// #7573 disable dep collection when invoking data getters
	pushTarget()
	try {
		return data.call(vm, vm)
	} catch (e) {
		handleError(e, vm, `data()`)
		return {}
	} finally {
		popTarget()
	}
}

const computedWatcherOptions = { lazy: true }

function initComputed (vm: Component, computed: Object) {
	// $flow-disable-line
	const watchers = vm._computedWatchers = Object.create(null)
	// computed properties are just getters during SSR
	const isSSR = isServerRendering()

	for (const key in computed) {
		const userDef = computed[key]
		const getter = typeof userDef === 'function' ? userDef : userDef.get
		if (process.env.NODE_ENV !== 'production' && getter == null) {
			warn(
				`Getter is missing for computed property "${key}".`,
				vm
			)
		}

		if (!isSSR) {
			// create internal watcher for the computed property.
			watchers[key] = new Watcher(
				vm,
				getter || noop,
				noop,
				computedWatcherOptions
			)
		}

		// component-defined computed properties are already defined on the
		// component prototype. We only need to define computed properties defined
		// at instantiation here.
		if (!(key in vm)) {
			defineComputed(vm, key, userDef)
		} else if (process.env.NODE_ENV !== 'production') {
			if (key in vm.$data) {
				warn(`The computed property "${key}" is already defined in data.`, vm)
			} else if (vm.$options.props && key in vm.$options.props) {
				warn(`The computed property "${key}" is already defined as a prop.`, vm)
			}
		}
	}
}

export function defineComputed (
	target: any,
	key: string,
	userDef: Object | Function
) {
	const shouldCache = !isServerRendering()
	if (typeof userDef === 'function') {
		sharedPropertyDefinition.get = shouldCache
			? createComputedGetter(key)
			: userDef
		sharedPropertyDefinition.set = noop
	} else {
		sharedPropertyDefinition.get = userDef.get
			? shouldCache && userDef.cache !== false
				? createComputedGetter(key)
				: userDef.get
			: noop
		sharedPropertyDefinition.set = userDef.set
			? userDef.set
			: noop
	}
	if (process.env.NODE_ENV !== 'production' &&
			sharedPropertyDefinition.set === noop) {
		sharedPropertyDefinition.set = function () {
			warn(
				`Computed property "${key}" was assigned to but it has no setter.`,
				this
			)
		}
	}
	Object.defineProperty(target, key, sharedPropertyDefinition)
}

function createComputedGetter (key) {
	return function computedGetter () {
		const watcher = this._computedWatchers && this._computedWatchers[key]
		if (watcher) {
			if (watcher.dirty) {
				watcher.evaluate()
			}
			if (Dep.target) {
				watcher.depend()
			}
			return watcher.value
		}
	}
}

function initMethods (vm: Component, methods: Object) {
	const props = vm.$options.props
	// 遍历 vm实例的 methods 属性
	for (const key in methods) {
		if (process.env.NODE_ENV !== 'production') {
			// 1 如果方法不存在
			if (methods[key] == null) {
				warn(
					`Method "${key}" has an undefined value in the component definition. ` +
					`Did you reference the function correctly?`,
					vm
				)
			}
			// 2 方法名跟 props中的重复
			if (props && hasOwn(props, key)) {
				warn(
					`Method "${key}" has already been defined as a prop.`,
					vm
				)
			}
			// 3 方法名是vue保留字
			if ((key in vm) && isReserved(key)) {
				warn(
					`Method "${key}" conflicts with an existing Vue instance method. ` +
					`Avoid defining component methods that start with _ or $.`
				)
			}
		}
		// 4 将vm实例methods中的方法, 绑定到 vm实例上
		vm[key] = methods[key] == null ? noop : bind(methods[key], vm)  // shared/util/bind
	}
}

function initWatch (vm: Component, watch: Object) {
	for (const key in watch) {
		const handler = watch[key]
		if (Array.isArray(handler)) {
			for (let i = 0; i < handler.length; i++) {
				createWatcher(vm, key, handler[i])
			}
		} else {
			createWatcher(vm, key, handler)
		}
	}
}

// 创建一个Watcher实例,
function createWatcher (
	vm: Component,
	expOrFn: string | Function,
	handler: any,
	options?: Object
) {
	/*
	*  所以平时 watch 可以这么写
	*  watch: {
	*		msg: {
	*			immediate: true,   // option
	*			deep: true,        // option
	*			handler: function (v) {
	*				console.log(v)
	*			}
	*		},
	*		msg: function (v) {
	*			console.log(v)
	*		},
	*
	*    }
	*/
	if (isPlainObject(handler)) {
		options = handler
		handler = handler.handler
	}
	// 这里的代码就是为啥我们可以将 vm methods中的函数 作为 Watcher 的handler
	// 写个函数名就行了
	if (typeof handler === 'string') {
		handler = vm[handler]
	}
	return vm.$watch(expOrFn, handler, options)
}


// 初始化の二
export function stateMixin (Vue: Class<Component>) {
	// flow somehow has problems with directly declared definition object
	// when using Object.defineProperty, so we have to procedurally build up
	// the object here 关于flow.js的一些毛病

	// 1 在vm实例上添加 $props 和 $data 属性, 分别返回 vm._props  vm._data, 都不能set 
	const dataDef = {}
	dataDef.get = function () { return this._data }
	const propsDef = {}
	propsDef.get = function () { return this._props }
	if (process.env.NODE_ENV !== 'production') {
		dataDef.set = function (newData: Object) {
			warn(
				'Avoid replacing instance root $data. ' +
				'Use nested data properties instead.',
				this
			)
		}
		propsDef.set = function () {
			warn(`$props is readonly.`, this)
		}
	}
	Object.defineProperty(Vue.prototype, '$data', dataDef)
	Object.defineProperty(Vue.prototype, '$props', propsDef)
	// -----------------------------------------------------------------------------

	// 2 在vm实例上添加 $set 和 $delete 方法
	Vue.prototype.$set = set
	Vue.prototype.$delete = del
	// -----------------------------------

	// 3 在vm实例上添加 $watch 方法
	Vue.prototype.$watch = function (
		expOrFn: string | Function,
		cb: any, // callback
		options?: Object //options : { user: Boolean, lazy: Boolean, deep: Boolean, sync: Boolean, immediate: Boolean}
	): Function {
		
		const vm: Component = this

		// 1-1 如果回调函数是普通对象, 则返回一个特殊的createWatcher(), 详情在上面 
		if (isPlainObject(cb)) {
			return createWatcher(vm, expOrFn, cb, options)
		}
		// -----------------------------------------------------------------

		// 根据传入的options 配置Watcher
		options = options || {}
		// 2-1 标志 用户定义的watcher
		options.user = true 
		// ---------------------

		// 2-2 核心 - 创建一个watcher实例
		const watcher = new Watcher(vm, expOrFn, cb, options)
		// ------------------

		// 2-3 如果options的immediate属性为true, 则立即触发一次回调
		if (options.immediate) { cb.call(vm, watcher.value) }
		// -------------------------------------------------

		// 2-4 vm实例的$watch方法返回一个 unwatchFn 方法, 调用之后, 取消观察
		return function unwatchFn () {
			watcher.teardown()
		}
	}
}
