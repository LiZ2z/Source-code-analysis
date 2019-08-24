[fiber]: ../modules/createFiber.md

# `getContextForSubtree`

[Fiber 的格式点这里][fiber]

```javascript
function getContextForSubtree(parentComponent) {
    if (!parentComponent) {
        return emptyContextObject;
    }

    var fiber = get(parentComponent);
    var parentContext = findCurrentUnmaskedContext(fiber);

    if (fiber.tag === ClassComponent) {
        var Component = fiber.type;
        if (isContextProvider(Component)) {
            return processChildContext(fiber, Component, parentContext);
        }
    }

    return parentContext;
}
```

# 子任务

```javascript
function get(key) {
    return key._reactInternalFiber;
}
```

```javascript
function findCurrentUnmaskedContext(fiber) {
    // Currently this is only used with renderSubtreeIntoContainer; not sure if it
    // makes sense elsewhere
    !(isFiberMounted(fiber) && fiber.tag === ClassComponent)
        ? invariant(
              false,
              'Expected subtree parent to be a mounted class component. This error is likely caused by a bug in React. Please file an issue.'
          )
        : undefined;

    var node = fiber;
    do {
        switch (node.tag) {
            case HostRoot:
                return node.stateNode.context;
            case ClassComponent: {
                var Component = node.type;
                if (isContextProvider(Component)) {
                    return node.stateNode
                        .__reactInternalMemoizedMergedChildContext;
                }
                break;
            }
        }
        node = node.return;
    } while (node !== null);
    invariant(
        false,
        'Found unexpected detached subtree parent. This error is likely caused by a bug in React. Please file an issue.'
    );
}
```

```javascript
function isContextProvider(type) {
    var childContextTypes = type.childContextTypes;
    return childContextTypes !== null && childContextTypes !== undefined;
}
```

## `processChildContext`

检查 child Context

```javascript
function processChildContext(fiber, type, parentContext) {
    var instance = fiber.stateNode;
    var childContextTypes = type.childContextTypes;

    // TODO (bvaughn) Replace this behavior with an invariant() in the future.
    // It has only been added in Fiber to match the (unintentional) behavior in Stack.
    if (typeof instance.getChildContext !== 'function') {
        var componentName = getComponentName(type) || 'Unknown';

        if (!warnedAboutMissingGetChildContext[componentName]) {
            warnedAboutMissingGetChildContext[componentName] = true;
            warningWithoutStack(
                false,
                '%s.childContextTypes is specified but there is no getChildContext() method ' +
                    'on the instance. You can either define getChildContext() on %s or remove ' +
                    'childContextTypes from it.',
                componentName,
                componentName
            );
        }
        return parentContext;
    }

    var childContext = undefined;
    setCurrentPhase('getChildContext');
    startPhaseTimer(fiber, 'getChildContext');
    childContext = instance.getChildContext();
    stopPhaseTimer();
    setCurrentPhase(null);
    for (var contextKey in childContext) {
        !(contextKey in childContextTypes)
            ? invariant(
                  false,
                  '%s.getChildContext(): key "%s" is not defined in childContextTypes.',
                  getComponentName(type) || 'Unknown',
                  contextKey
              )
            : undefined;
    }
    var name = getComponentName(type) || 'Unknown';
    checkPropTypes(
        childContextTypes,
        childContext,
        'child context',
        name,
        // In practice, there is one case in which we won't get a stack. It's when
        // somebody calls unstable_renderSubtreeIntoContainer() and we process
        // context from the parent component instance. The stack will be missing
        // because it's outside of the reconciliation, and so the pointer has not
        // been set. This is rare and doesn't matter. We'll also remove that API.
        getCurrentFiberStackInDev
    );

    return _assign({}, parentContext, childContext);
}
```
