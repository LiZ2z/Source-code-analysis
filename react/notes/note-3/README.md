[requestcurrenttime]: ./requestCurrentTime.md
[computeexpirationforfiber]: ./computeExpirationForFiber.md
[getcontextforsubtree]: ./getContextForSubtree.md
[createfiberroot]: ../modules/createFiberRoot.md
[note4]: ../note-4/README.md

# 主线 `updateContainer(children, root, null, work._onCommit)`

这里的 children 就是`ReactDOM.render(<App/>, document.querySelector('#root');`中的`<App/>`，最终被编译成`React.createElment(App)`。root 参数为通过[ **createFiberRoot** ][createfiberroot]函数 创建的 root 对象。

```javascript
function updateContainer(element, container, parentComponent, callback) {
    var fiber = container.current; // FiberNode

    var currentTime = requestCurrentTime();

    var expirationTime = computeExpirationForFiber(currentTime, fiber);

    return updateContainerAtExpirationTime(
        element,
        container,
        parentComponent,
        expirationTime,
        callback
    );
}
```

## 支线 `requestCurrentTime`

点击[ **requestCurrentTime** ][requestcurrenttime] 看函数解析。

总的来说就是返回`currentSchedulerTime`。

## 支线 `computeExpirationForFiber`

点击[ **computeExpirationForFiber** ][computeexpirationforfiber] 看函数解析。

> 暂时没懂这个。

## 主线`updateContainerAtExpirationTime`

```javascript
function updateContainerAtExpirationTime(
    element,
    container,
    parentComponent,
    expirationTime,
    callback
) {
    // TODO: If this is a nested container, this won't be the root.
    var current$$1 = container.current;

    // fiber debugtool 对于普通开发者无用 https://github.com/facebook/react/pull/8033
    // if (ReactFiberInstrumentation_1.debugTool) {
    //     if (current$$1.alternate === null) {
    //         ReactFiberInstrumentation_1.debugTool.onMountContainer(container);
    //     } else if (element === null) {
    //         ReactFiberInstrumentation_1.debugTool.onUnmountContainer(container);
    //     } else {
    //         ReactFiberInstrumentation_1.debugTool.onUpdateContainer(container);
    //     }
    // }
    // 应该就是获取父fiber上的任务
    var context = getContextForSubtree(parentComponent); // {}
    if (container.context === null) {
        container.context = context;
    } else {
        container.pendingContext = context;
    }

    return scheduleRootUpdate(current$$1, element, expirationTime, callback);
}
```

## 支线`getContextForSubtree`

点击[ **getContextForSubtree** ][getcontextforsubtree] 看函数解析。

> 暂时没懂这个。

# [**主线 4**][note4]
