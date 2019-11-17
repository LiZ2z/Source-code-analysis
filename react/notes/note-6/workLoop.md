# 主线，`workLoop(isYieldy)`

```javascript
function workLoop(isYieldy) {
    if (!isYieldy) {
        // Flush work without yielding
        while (nextUnitOfWork !== null) {
            nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
        }
    } else {
        // Flush asynchronous work until there's a higher priority event
        while (nextUnitOfWork !== null && !shouldYieldToRenderer()) {
            nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
        }
    }
}
```
