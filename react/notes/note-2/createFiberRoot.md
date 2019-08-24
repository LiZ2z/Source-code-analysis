[fiber]: ../modules/createFiber.md

# `createFiberRoot`

创建并返回一个 root 对象。该对象将赋值给 reactRoot 实例的`_internalRoot` 属性。

```javascript
function createFiberRoot(container, isConcurrent, hydrate) {
    var uninitializedFiber = createHostRootFiber(isConcurrent);

    var root = {
        // fiber
        current: uninitializedFiber,

        // 存储dom节点的引用
        containerInfo: container,
        pendingChildren: null,

        earliestPendingTime: NoWork,
        latestPendingTime: NoWork,
        earliestSuspendedTime: NoWork,
        latestSuspendedTime: NoWork,
        latestPingedTime: NoWork,
        pingCache: null,
        didError: false,
        pendingCommitExpirationTime: NoWork,
        finishedWork: null,
        timeoutHandle: noTimeout,
        context: null,
        pendingContext: null,
        hydrate: hydrate,
        nextExpirationTimeToWorkOn: NoWork,
        expirationTime: NoWork,
        firstBatch: null,
        nextScheduledRoot: null,
        // interaction => 交互    Thread => 线程   id
        interactionThreadID: tracing.unstable_getThreadID(),
        memoizedInteractions: new Set(),
        pendingInteractionMap: new Map()
    };

    uninitializedFiber.stateNode = root;

    return root;
}

/**
 * 计算fiber的 `mode`，创建fiber并返回。
 * 普通模式下mode可能的值有 0（非并发），3（并发）
 * 当启用react devTool后mode可能的值有 5（非并发），6（并发）
 */
function createHostRootFiber(isConcurrent) {
    //                         1             |  2            0
    //                        0b0001         |0b0010         0b0000
    //  1|2 => 3            0b0001 | 0b0010 =>  0b0011
    var mode = isConcurrent ? ConcurrentMode | StrictMode : NoContext;

    if (enableProfilerTimer && isDevToolsPresent) {
        // Always collect profile timings when DevTools are present.
        // This enables DevTools to start capturing timing at any point–
        // Without some nodes in the tree having empty base times.
        //
        // ProfileMode => 4 => 0b0100
        // 0b0100 | 0b0011 => 0b0111  6
        // 0b0100 | 0b0000 => 0b0100  5
        mode |= ProfileMode;
    }
    return createFiber(HostRoot, null, null, mode);
}
```

[ **创建 Fiber 看这里** ][fiber]
