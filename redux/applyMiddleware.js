import compose from './compose'

/**
 * Creates a store enhancer that applies middleware to the dispatch method
 * of the Redux store. This is handy for a variety of tasks, such as expressing
 * asynchronous actions in a concise manner, or logging every action payload.
 *
 * See `redux-thunk` package as an example of the Redux middleware.
 *
 * Because middleware is potentially asynchronous, this should be the first
 * store enhancer in the composition chain.
 *
 * Note that each middleware will be given the `dispatch` and `getState` functions
 * as named arguments.
 *
 * @param {...Function} middlewares The middleware chain to be applied.
 * @returns {Function} A store enhancer applying the middleware.
 */
export default function applyMiddleware(...middlewares) {
  return createStore => (...args) => {
    const store = createStore(...args)
    // 不允许在 写中间件 构造函数时, 使用 dispatch
    let dispatch = () => {
      throw new Error(
        `Dispatching while constructing your middleware is not allowed. ` +
          `Other middleware would not be applied to this dispatch.`
      )
    }

    const middlewareAPI = {
      getState: store.getState,
      dispatch: (...args) => dispatch(...args)
    }

  

    const chain = middlewares.map(middleware => middleware(middlewareAPI))
    
    dispatch = compose(...chain)(store.dispatch)

      /**
     * 所以 中间件的基本格式 应该为
     * 
     * function myMiddleware(middlewareAPI) {
     *    //* 不能在这里调用 middlewareAPI.dispatch, 这里将会在 middlewares.map(middleware => middleware(middlewareAPI)) 时， 执行
     *    return function( ** 上一个middleware, 传过来的参数, 如果为第一个 middleware， 则arg为 redux自带的dispatch ** ) {
     *      //* 不能在这里调用 middlewareAPI.dispatch, 这里将会在 compose(...chain)(store.dispatch) 时， 执行
     *      //* 在这里的 middlewareAPI.dispatch 将是 最后一个 middleware 的返回值，
     *      return 作为下一个 middleware 的参数
     *    }
     * }
     */

    return {
      ...store,
      dispatch
    }
  }
}
