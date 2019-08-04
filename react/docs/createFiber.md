Fiber 是一个对象，它描述了 React 对一个 Component 要做的工作, Fiber 的状态要么已完成要么待完成。一个 React Component 可以拥有多个 Fiber。

Fiber 中同时保存着一个 React Component 的一些属性 及状态，例如：props,state

```javascript
var createFiber = function(tag, pendingProps, key, mode) {
    return new FiberNode(tag, pendingProps, key, mode);
};

// A Fiber is work on a Component that needs to be done or was done. There can
// be more than one per component.

var debugCounter = 1;
function FiberNode(tag, pendingProps, key, mode) {
    //
    // tag 是一个用来表示React Component类型的数值型的值，其可能的值有：
    // var FunctionComponent = 0; 函数式组件
    // var ClassComponent = 1; class式组件
    // var IndeterminateComponent = 2;  未知组件类型，Before we know whether it is function or class
    // var HostRoot = 3;  Root of a host tree. Could be nested inside another node.
    // var HostPortal = 4;  A subtree. Could be an entry point to a different renderer.
    // var HostComponent = 5;
    // var HostText = 6;
    // var Fragment = 7;
    // var Mode = 8;
    // var ContextConsumer = 9;
    // var ContextProvider = 10;
    // var ForwardRef = 11;
    // var Profiler = 12;
    // var SuspenseComponent = 13;
    // var MemoComponent = 14;
    // var SimpleMemoComponent = 15;
    // var LazyComponent = 16;
    // var IncompleteClassComponent = 17;
    // var DehydratedSuspenseComponent = 18;
    this.tag = tag;
    this.key = key;
    this.elementType = null;
    this.type = null;
    this.stateNode = null;

    // Fiber
    this.return = null;
    this.child = null;
    this.sibling = null;
    this.index = 0;

    this.ref = null;

    this.pendingProps = pendingProps;
    this.memoizedProps = null;
    this.updateQueue = null;
    this.memoizedState = null;
    this.contextDependencies = null;

    this.mode = mode;

    // Effects
    this.effectTag = NoEffect;
    this.nextEffect = null;

    this.firstEffect = null;
    this.lastEffect = null;

    this.expirationTime = NoWork;
    this.childExpirationTime = NoWork;

    this.alternate = null;

    if (enableProfilerTimer) {
        // Note: The following is done to avoid a v8 performance cliff.
        //
        // Initializing the fields below to smis and later updating them with
        // double values will cause Fibers to end up having separate shapes.
        // This behavior/bug has something to do with Object.preventExtension().
        // Fortunately this only impacts DEV builds.
        // Unfortunately it makes React unusably slow for some applications.
        // To work around this, initialize the fields below with doubles.
        //
        // Learn more about this here:
        // https://github.com/facebook/react/issues/14365
        // https://bugs.chromium.org/p/v8/issues/detail?id=8538
        this.actualDuration = Number.NaN;
        this.actualStartTime = Number.NaN;
        this.selfBaseDuration = Number.NaN;
        this.treeBaseDuration = Number.NaN;

        // It's okay to replace the initial doubles with smis after initialization.
        // This won't trigger the performance cliff mentioned above,
        // and it simplifies other profiler code (including DevTools).
        this.actualDuration = 0;
        this.actualStartTime = -1;
        this.selfBaseDuration = 0;
        this.treeBaseDuration = 0;
    }

    this._debugID = debugCounter++;
    this._debugSource = null;
    this._debugOwner = null;
    this._debugIsCurrentlyTiming = false;
    this._debugHookTypes = null;
    if (!hasBadMapPolyfill && typeof Object.preventExtensions === 'function') {
        Object.preventExtensions(this);
    }
}
```
