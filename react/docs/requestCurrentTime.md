#### 前文

读懂这里需要了解这些全局作用域内的变量

```javascript
var firstScheduledRoot = null;
var lastScheduledRoot = null;

var callbackExpirationTime = NoWork;
var callbackID = undefined;
var isRendering = false;
var nextFlushedRoot = null;
var nextFlushedExpirationTime = NoWork;
var lowestPriorityPendingInteractiveExpirationTime = NoWork;
var hasUnhandledError = false;
var unhandledError = null;

var isBatchingUpdates = false;
var isUnbatchingUpdates = false;

var completedBatches = null;

var originalStartTimeMs = scheduler.unstable_now();
var currentRendererTime = msToExpirationTime(originalStartTimeMs);
var currentSchedulerTime = currentRendererTime;

// Use these to prevent an infinite loop of nested updates
var NESTED_UPDATE_LIMIT = 50;
var nestedUpdateCount = 0;
var lastCommittedRootDuringThisBatch = null;
```

#### `requestCurrentTime`

`requestCurrentTime` 函数由 *scheduler(调度表)*调用，用来计算*过期时间*。**过期时间是通过将当前时间 (the start time)相加来计算的。如果在同一个事件中调用了两次 updates, 即使第一次调度的实际时间比第二次调度的实际时间早，我们也应将他们的开始时间视为同时进行**。因为 过期时间 决定了这次 updates 如何被批处理，所以我们想要所有由同一个事件触发的 updates 都能有相同的过期时间。我们跟踪两个不同的时间：当前的 "renderer" time 和当前的"scheduler" time。"renderer" time 可以随时更新；它的存在只是为了最大限度地降低调用性能。但是，只有在没有挂起的工作(正在处理的 ？)，或者我们确信自己不在某个事件的中间时，"scheduler" time 才能被更新。

```javascript
function requestCurrentTime() {
    // requestCurrentTime is called by the scheduler to compute an expiration
    // time.
    // Expiration times are computed by adding to the current time (the start
    // time). However, if two updates are scheduled within the same event, we
    // should treat their start times as simultaneous, even if the actual clock
    // time has advanced between the first and second call.
    // In other words, because expiration times determine how updates are batched,
    // we want all updates of like priority that occur within the same event to
    // receive the same expiration time. Otherwise we get tearing.
    // We keep track of two separate times: the current "renderer" time and the
    // current "scheduler" time. The renderer time can be updated whenever; it
    // only exists to minimize the calls performance.now.
    // But the scheduler time can only be updated if there's no pending work, or
    // if we know for certain that we're not in the middle of an event.

    if (isRendering) {
        // We're already rendering. Return the most recently read time.
        // 我们已经在渲染了。返回最近读取时间。
        return currentSchedulerTime;
    }
    // Check if there's pending work.
    // 检查是否有待处理(正在处理的 ？)的工作。
    // 找最高权限的root
    findHighestPriorityRoot();

    if (
        nextFlushedExpirationTime === NoWork ||
        nextFlushedExpirationTime === Never
    ) {
        // If there's no pending work, or if the pending work is offscreen, we can
        // read the current time without risk of tearing.
        // 如果没有正在处理的工作，或者正在处理的工作在可视区域外，我们可以读取当前时间
        // 而不用担心会导致问题
        recomputeCurrentRendererTime();
        currentSchedulerTime = currentRendererTime;
        return currentSchedulerTime;
    }
    // There's already pending work. We might be in the middle of a browser
    // event. If we were to read the current time, it could cause multiple updates
    // within the same event to receive different expiration times, leading to
    // tearing. Return the last read time. During the next idle callback, the
    // time will be updated.
    return currentSchedulerTime;
}
```

#### `findHighestPriorityRoot`

```javascript
function findHighestPriorityRoot() {
    var highestPriorityWork = NoWork;
    var highestPriorityRoot = null;
    if (lastScheduledRoot !== null) {
        var previousScheduledRoot = lastScheduledRoot;
        var root = firstScheduledRoot;
        while (root !== null) {
            var remainingExpirationTime = root.expirationTime;
            if (remainingExpirationTime === NoWork) {
                // This root no longer has work. Remove it from the scheduler.

                // TODO: This check is redudant, but Flow is confused by the branch
                // below where we set lastScheduledRoot to null, even though we break
                // from the loop right after.
                !(previousScheduledRoot !== null && lastScheduledRoot !== null)
                    ? invariant(
                          false,
                          'Should have a previous and last root. This error is likely caused by a bug in React. Please file an issue.'
                      )
                    : undefined;
                if (root === root.nextScheduledRoot) {
                    // This is the only root in the list.
                    root.nextScheduledRoot = null;
                    firstScheduledRoot = lastScheduledRoot = null;
                    break;
                } else if (root === firstScheduledRoot) {
                    // This is the first root in the list.
                    var next = root.nextScheduledRoot;
                    firstScheduledRoot = next;
                    lastScheduledRoot.nextScheduledRoot = next;
                    root.nextScheduledRoot = null;
                } else if (root === lastScheduledRoot) {
                    // This is the last root in the list.
                    lastScheduledRoot = previousScheduledRoot;
                    lastScheduledRoot.nextScheduledRoot = firstScheduledRoot;
                    root.nextScheduledRoot = null;
                    break;
                } else {
                    previousScheduledRoot.nextScheduledRoot =
                        root.nextScheduledRoot;
                    root.nextScheduledRoot = null;
                }
                root = previousScheduledRoot.nextScheduledRoot;
            } else {
                if (remainingExpirationTime > highestPriorityWork) {
                    // Update the priority, if it's higher
                    highestPriorityWork = remainingExpirationTime;
                    highestPriorityRoot = root;
                }
                if (root === lastScheduledRoot) {
                    break;
                }
                if (highestPriorityWork === Sync) {
                    // Sync is highest priority by definition so
                    // we can stop searching.
                    break;
                }
                previousScheduledRoot = root;
                root = root.nextScheduledRoot;
            }
        }
    }

    nextFlushedRoot = highestPriorityRoot;
    nextFlushedExpirationTime = highestPriorityWork;
}
```

```javascript
function recomputeCurrentRendererTime() {
    // scheduler.unstable_now    performance.now()
    // originalStartTimeMs原点时间   当前代码执行时的 performance.now()
    var currentTimeMs = scheduler.unstable_now() - originalStartTimeMs;
    currentRendererTime = msToExpirationTime(currentTimeMs);
}
```
