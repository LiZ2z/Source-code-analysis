### 正文

```javascript
function computeExpirationForFiber(currentTime, fiber) {
    var priorityLevel = scheduler.unstable_getCurrentPriorityLevel();

    var expirationTime = undefined;
    //              & 0b0001              0b0000
    // 也就是只要fiber的mode不是 0b0001 （ConcurrentMode 并发模式） 都会同步执行
    if ((fiber.mode & ConcurrentMode) === NoContext) {
        // 除了 concurrent mode， 其他的updates都是同步的
        expirationTime = Sync; // maxSigned31BitInt 永不工期
    } else if (isWorking && !isCommitting) {
        // During render phase, updates expire during as the current render.
        // 在渲染阶段，更新将在当前渲染期间过期
        expirationTime = nextRenderExpirationTime;
    } else {
        switch (priorityLevel) {
            case scheduler.unstable_ImmediatePriority:
                expirationTime = Sync;
                break;
            case scheduler.unstable_UserBlockingPriority:
                expirationTime = computeInteractiveExpiration(currentTime);
                break;
            case scheduler.unstable_NormalPriority:
                // This is a normal, concurrent update
                expirationTime = computeAsyncExpiration(currentTime);
                break;
            case scheduler.unstable_LowPriority:
            case scheduler.unstable_IdlePriority:
                expirationTime = Never;
                break;
            default:
                invariant(
                    false,
                    'Unknown priority level. This error is likely caused by a bug in React. Please file an issue.'
                );
        }

        // If we're in the middle of rendering a tree, do not update at the same
        // expiration time that is already rendering.
        // 如果正在渲染DOM树，不要在这个相同的过期时间内 进行 update
        if (nextRoot !== null && expirationTime === nextRenderExpirationTime) {
            expirationTime -= 1;
        }
    }

    // Keep track of the lowest pending interactive expiration time. This
    // allows us to synchronously flush all interactive updates
    // when needed.
    // TODO: Move this to renderer?
    // 跟踪最短的 正在进行的 interactive expiration time（交互式过期时间）
    // 这样当我们需要的时候，就可以一次性同步刷新flush所有 interactive updates（交互式更新）
    if (
        priorityLevel === scheduler.unstable_UserBlockingPriority &&
        (lowestPriorityPendingInteractiveExpirationTime === NoWork ||
            expirationTime < lowestPriorityPendingInteractiveExpirationTime)
    ) {
        lowestPriorityPendingInteractiveExpirationTime = expirationTime;
    }

    return expirationTime;
}
```
