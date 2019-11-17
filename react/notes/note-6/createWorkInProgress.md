# 支线，`createWorkInProgress(current, pendingProps, expirationTime)`

创建一个 **alternate fiber**，工作将在这个 fiber 上进行。

```javascript
// This is used to create an alternate fiber to do work on.
function createWorkInProgress(current, pendingProps, expirationTime) {
    var workInProgress = current.alternate;
    if (workInProgress === null) {
        // 我们使用双缓冲池技术，因为我们知道我们最多只需要一个树的两个版本。我们将可以自由
        // 重用的“其他”未使用节点汇集在一起。这是懒惰地创建的，以避免为从未更新的内容分配额外
        // 的对象。如果需要，它还允许我们回收额外的内存。
        // We use a double buffering pooling technique because we know that we'll
        // only ever need at most two versions of a tree. We pool the "other" unused
        // node that we're free to reuse. This is lazily created to avoid allocating
        // extra objects for things that are never updated. It also allow us to
        // reclaim the extra memory if needed.
        workInProgress = createFiber(
            current.tag,
            pendingProps,
            current.key,
            current.mode
        );
        workInProgress.elementType = current.elementType;
        workInProgress.type = current.type;
        workInProgress.stateNode = current.stateNode;
        workInProgress.alternate = current;
        current.alternate = workInProgress;
    } else {
        workInProgress.pendingProps = pendingProps;

        // We already have an alternate.
        // Reset the effect tag.
        workInProgress.effectTag = NoEffect;

        // The effect list is no longer valid.
        workInProgress.nextEffect = null;
        workInProgress.firstEffect = null;
        workInProgress.lastEffect = null;

        if (enableProfilerTimer) {
            // We intentionally reset, rather than copy, actualDuration & actualStartTime.
            // This prevents time from endlessly accumulating in new commits.
            // This has the downside of resetting values for different priority renders,
            // But works for yielding (the common case) and should support resuming.
            workInProgress.actualDuration = 0;
            workInProgress.actualStartTime = -1;
        }
    }

    workInProgress.childExpirationTime = current.childExpirationTime;
    workInProgress.expirationTime = current.expirationTime;

    workInProgress.child = current.child;
    workInProgress.memoizedProps = current.memoizedProps;
    workInProgress.memoizedState = current.memoizedState;
    workInProgress.updateQueue = current.updateQueue;
    workInProgress.contextDependencies = current.contextDependencies;

    // These will be overridden during the parent's reconciliation
    workInProgress.sibling = current.sibling;
    workInProgress.index = current.index;
    workInProgress.ref = current.ref;

    if (enableProfilerTimer) {
        workInProgress.selfBaseDuration = current.selfBaseDuration;
        workInProgress.treeBaseDuration = current.treeBaseDuration;
    }

    return workInProgress;
}
```
