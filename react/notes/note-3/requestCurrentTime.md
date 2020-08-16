[createfiberroot]: ../阅读笔记-2/createFiberRoot.md

# `requestCurrentTime`

这些是这个分支可能用到的全局作用域内的变量

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

requestCurrentTime is called by the scheduler to compute an expiration time. Expiration times are computed by adding to the current time (the start time).
如果在同一个事件中调用了两次 updates, 即使第一次调度的实际时间比第二次调度的实际时间早，我们也应将他们的开始时间视为同时进行\_。因为 过期时间 决定了这次 updates 如何被批处理，所以我们想要所有由同一个事件触发的 updates 都能有相同的过期时间。

我们跟踪两个不同的时间：当前的 **"renderer" time** 和当前的 **"scheduler" time**。_"renderer" time 可以随时更新；它的存在只是为了最大限度地降低调用性能。但是，只有在没有需要处理的工作时，或者我们确信自己不在某个事件的中间时，"scheduler" time 才能被更新。_

该函数的大致流程为：

1. 如果 react 正处于 rendering 阶段，直接返回`currentSchedulerTime`。
2. 否则，通过`findHighestPriorityRoot()`检查是否有待处理的工作，并将其赋值给全局的变量`nextFlushedExpirationTime`。
3. 之后对`nextFlushedExpirationTime`进行判断，是否存在待完成的工作（`nextFlushedExpirationTime`值不等于`NoWork` or `Never`）。
4. 如果不存在待完成的工作。则重新计算 `currentRendererTime`，并将其赋值给`currentSchedulerTime`，返回`currentSchedulerTime`。
5. 如果存在待完成的工作，直接返回`currentSchedulerTime`。

```javascript
function requestCurrentTime() {
    if (isRendering) {
        // 已经在渲染了。返回最近读取时间。
        return currentSchedulerTime;
    }
    // 检查是否有待处理的工作。
    findHighestPriorityRoot();

    if (
        nextFlushedExpirationTime === NoWork ||
        nextFlushedExpirationTime === Never
    ) {
        // 如果没有正在处理的工作（NoWork），
        // 或者正在处理的工作在可视区域外（Never），
        // 我们可以读取当前时间而不用担心会导致问题
        recomputeCurrentRendererTime();
        currentSchedulerTime = currentRendererTime;
        return currentSchedulerTime;
    }
    // There's already pending work. We might be in the middle of a browser
    // event. If we were to read the current time, it could cause multiple updates
    // within the same event to receive different expiration times, leading to
    // tearing. Return the last read time. During the next idle callback, the
    // time will be updated.
    // 存在待完成的工作（maxSigned31BitInt）。此时我们可能正处在某个浏览器事件中。
    // 如果我们去重新计算current renderer time，可能导致在同一个event引起的多次update
    // 中收到不同的 expiration times，所以我们直接返回最后一次 计算的currentSchedulerTime
    //

    return currentSchedulerTime;
}
```

#### `findHighestPriorityRoot`

React 运行时会创建一个 Scheduled list，这个 list 是由一系列有着待完成工作的对象（root，由[**createFiberRoot**][createfiberroot] 函数创建）组成的链表。root 格式大致如下：

```javascript
const root = {
    nextScheduledRoot: null,
    expirationTime: NoWork
    // current: createFiber(),
    // ... 其他很多属性
};
```

root 之间通过`root.nextScheduledRoot`属性依次链接并形成一个闭环（可以想象自行车链），组成了一个 list。虽然是个闭环，但这个 list 有一个起点 root，有一个终点 root，分别存储在“全局”变量`firstScheduledRoot`和`lastScheduledRoot`中。

同时，如上所示，root 有一个`expirationTime`（过期时间）属性，该属性存储的不是真正的时间，而是一些数值表示，其可能的取值有：

```javascript
// `expirationTime`（过期时间）
var NoWork = 0; // 没有工作要做
var Never = 1; // 过期时间为 never，永不过期，但权限较低，可以先放着，等其他工作做完再处理
var Sync = maxSigned31BitInt; // 有工作要做，而且是权限最高的工作
```

React 将根据每个 root 的`root.expirationTime` 大小来决定 root 优先级，优先级高的 root 上的工作将被优先处理。

该函数就是通过`root.nextScheduledRoot`属性来遍历 list，根据`root.expirationTime`来找到 list 中优先级最高的 root，并将其赋值给`nextFlushedRoot`。同时，将这个 root 的`expirationTime`属性赋值给`nextFlushedExpirationTime`。

另外，在遍历的时候，如果发现`root.expirationTime === NoWork; // 0`，即当前 root 上已经没有工作要做了，就会将其从这个 list 中移除。

代码：

```javascript
function findHighestPriorityRoot() {
    var highestPriorityWork = NoWork;
    var highestPriorityRoot = null;

    if (lastScheduledRoot !== null) {
        var root = firstScheduledRoot;
        // previousScheduledRoot，指的是上面root变量在Scheduled list中的上一项，
        // 因为整个list链是一个闭环，所以firstScheduledRoot的上一个ScheduledRoot就是lastScheduledRoot
        var previousScheduledRoot = lastScheduledRoot;

        while (root !== null) {
            // remaining  剩余的
            var remainingExpirationTime = root.expirationTime;
            // 这个root已经没有工作要做了，将它从scheduler中移除。
            // This root no longer has work. Remove it from the scheduler.
            if (remainingExpirationTime === NoWork) {
                // 机翻： 在下面我们将lastScheduledRoot设置为null，即使我们在之后立即中断了循环。
                // below where we set lastScheduledRoot to null, even though we break
                // from the loop right after.
                !(previousScheduledRoot !== null && lastScheduledRoot !== null)
                    ? invariant(
                          false,
                          'Should have a previous and last root. This error is likely caused by a bug in React. Please file an issue.'
                      )
                    : undefined;
                if (root === root.nextScheduledRoot) {
                    // list中只有这一个 root
                    // This is the only root in the list.
                    root.nextScheduledRoot = null;
                    firstScheduledRoot = lastScheduledRoot = null;
                    break;
                } else if (root === firstScheduledRoot) {
                    // 这是 list 中第一个 root
                    // This is the first root in the list.
                    var next = root.nextScheduledRoot;
                    firstScheduledRoot = next;
                    lastScheduledRoot.nextScheduledRoot = next;
                    root.nextScheduledRoot = null;
                } else if (root === lastScheduledRoot) {
                    // 这是 list 中最后一个 root
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
                    // 根据root.expirationTime 大小判断root优先级高低
                    // Update the priority, if it's higher
                    highestPriorityWork = remainingExpirationTime;
                    highestPriorityRoot = root;
                }
                if (root === lastScheduledRoot) {
                    // 遍历到最后一个，都没找到优先级最高的，无论如何这个都是优先级最高的了
                    break;
                }
                if (highestPriorityWork === Sync) {
                    // Sync is highest priority by definition so
                    // we can stop searching.
                    // Sync 任务是优先级最高的任务，可以停止查找了。
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
    // scheduler.unstable_now = performance.now
    // originalStartTimeMs（原点时间）=> 当前代码执行时的 performance.now() 的返回值
    var currentTimeMs = scheduler.unstable_now() - originalStartTimeMs;
    currentRendererTime = msToExpirationTime(currentTimeMs);
}
```
