# 关于 current modules 的整个系统

current 是一个全局作用域的变量，存储的是一个 fiber。

```javascript
var current = null;
var phase = null;

function getCurrentFiberOwnerNameInDevOrNull() {
    if (current === null) {
        return null;
    }
    var owner = current._debugOwner;
    if (owner !== null && typeof owner !== 'undefined') {
        return getComponentName(owner.type);
    }
    return null;
}

function getCurrentFiberStackInDev() {
    if (current === null) {
        return '';
    }
    // Safe because if current fiber exists, we are reconciling,
    // and it is guaranteed to be the work-in-progress version.
    return getStackByFiberInDevAndProd(current);
    return '';
}

function resetCurrentFiber() {
    // ReactDebugCurrentFrame.getCurrentStack = null; // 不重要
    current = null;
    phase = null;
}

function setCurrentFiber(fiber) {
    // ReactDebugCurrentFrame.getCurrentStack = getCurrentFiberStackInDev; // 不重要
    current = fiber;
    phase = null;
}

function setCurrentPhase(lifeCyclePhase) {
    phase = lifeCyclePhase;
}
```
