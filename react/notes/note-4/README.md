[current]: ../modules/current.md
[enqueueupdate]: ../modules/UpdateQueue.md

# 主线`scheduleRootUpdate`

```javascript
function scheduleRootUpdate(current$$1, element, expirationTime, callback) {
    // 暂时可以不看
    if (phase === 'render' && current !== null && !didWarnAboutNestedUpdates) {
        didWarnAboutNestedUpdates = true;
        warningWithoutStack(
            false,
            'Render methods should be a pure function of props and state; ' +
                'triggering nested component updates from render is not allowed. ' +
                'If necessary, trigger nested updates in componentDidUpdate.\n\n' +
                'Check the render method of %s.',
            getComponentName(current.type) || 'Unknown'
        );
    }

    var update = createUpdate(expirationTime);

    // 注意：react DevTools当前依赖于这个属性被称为“element”。
    update.payload = { element: element };

    callback = callback === undefined ? null : callback;
    if (callback !== null) {
        update.callback = callback;
    }

    flushPassiveEffects();

    enqueueUpdate(current$$1, update);

    scheduleWork(current$$1, expirationTime);

    return expirationTime;
}
```

## 支线，关于`current`

current 是一个全局作用域的变量，存储的是一个 fiber。

看这里[**current**][current]

## 支线，`createUpdate(expirationTime)`

```javascript
function createUpdate(expirationTime) {
    return {
        expirationTime: expirationTime,
        next: null,
        payload: null,
        callback: null,
        nextEffect: null,
        tag: UpdateState // 这个值是常量 0
    };
}
```

## 支线，`flushPassiveEffects()`

这是一个功能模块。在这里不详细解释。

```javascript
function flushPassiveEffects() {
    if (passiveEffectCallbackHandle !== null) {
        cancelPassiveEffects(passiveEffectCallbackHandle);
    }
    if (passiveEffectCallback !== null) {
        // We call the scheduled callback instead of commitPassiveEffects directly
        // to ensure tracing works correctly.
        passiveEffectCallback();
    }
}
```

## 支线，`enqueueUpdate(current$$1, update)`

见 [**enqueueupdate**][enqueueupdate]
