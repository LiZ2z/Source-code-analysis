[fiber]: ../modules/createFiber.md

点这里看[**fiber**][fiber]格式。

# UpdateQueue

UpdateQueue 是用来处理 React 组件状态（state）更新的一种实现。PS: react 更新指的是通过调用`setState`、`forceUpdate`、`replaceState`等 api 后产生的更新。

每产生一个更新，react 会创建一个 update 对象：

```javascript
{
    // 更新的优先级，可能的值：NoWork（0）、Never（1）、Sync（maxSigned31BitInt = 1073741823）
    expirationTime: expirationTime,

    // 更新的类型，可能的值：UpdateState（0）、ReplaceState（1）、ForceUpdate（2）、CaptureUpdate（3）
    tag: UpdateState,

    // update 携带的数据通常为 state 的部分数据
    payload: null,

    // 副作用
    callback: null,

    // 用于链接下一个update
    next: null,

    // 用于链接下一个副作用
    nextEffect: null
}
```

然后 react 将这个 update 放到 Update Queue 末端。

在 **某个特定的** 时候，react 将遍历 Update Queue 中的 update，并计算出新的状态（state）。大致过程如下：

1. 遍历 Update Queue
2. 根据 update 的优先级（ expirationTime > renderExpirationTime）决定哪些 update 需要先处理。PS: renderExpirationTime 为全局变量，代表着当前 react 要处理任务的最低优先级。
3. 对于要处理的 update，react 会根据 update.tag 和 update.payload 计算出新的 state。

4. 其他细节。

## UpdateQueue 原理

UpdateQueue 是按优先顺序排列的更新的链表。

> UpdateQueue is a linked list of prioritized updates.

Like fibers, update queues come in pairs(成对出现): A current queue, which represents（代表） the visible state of the screen, and A work-in-progress（半成品）queue, which can be mutated and processed asynchronously（异步处理） before it is committed — a form of double buffering（这是一种双重缓冲的形式）. If a work-in-progress render is discarded（丢弃） before finishing, we create a new work-in-progress by cloning the current queue.

Both queues share a persistent, singly-linked list structure（两个队列共享一个持久的单链表结构。）.To schedule an update, we append it to the end of both queues. Each queue maintains a pointer to first update in the persistent list that hasn't been processed. The work-in-progress pointer always has a position equal to or greater than the current queue, since we always work on that one. The current queue's pointer is only updated during the commit phase, when we swap in the work-in-progress.

For example:

```
  Current pointer:           A - B - C - D - E - F
  Work-in-progress pointer:              D - E - F
                                         ^
                                         The work-in-progress queue has
                                         processed more updates than current.
```

The reason we append to both queues is because otherwise we might drop
updates without ever processing them. For example, if we only add updates to
the work-in-progress queue, some updates could be lost whenever a work-in
-progress render restarts by cloning from current. Similarly, if we only add
updates to the current queue, the updates will be lost whenever an already
in-progress queue commits and swaps with the current queue. However, by
adding to both queues, we guarantee that the update will be part of the next
work-in-progress. (And because the work-in-progress queue becomes the
current queue once it commits, there's no danger of applying the same
update twice.)

## Prioritization

更新不是按优先级排序，而是按插入排序；新的更新总是附加到列表的末尾。

> Updates are not sorted by priority, but by insertion; new updates are always
> appended to the end of the list.

不过，优先级仍然很重要。在渲染阶段处理更新队列时，结果中仅包括具有足够优先级的更新。如果一个更新没有足够的优先级，我们将跳过它，它将保留在队列中，以便稍后在较低优先级渲染期间进行处理。至关重要的是，跳过更新之后的所有更新也会保留在队列中*而不管它们的优先级*。这意味着高优先级更新有时会以两个不同的优先级处理两次。我们还跟踪基本状态，它表示应用队列中的第一次更新之前的状态。

> The priority is still important, though. When processing the update queue
> during the render phase, only the updates with sufficient priority are
> included in the result. If we skip an update because it has insufficient
> priority, it remains in the queue to be processed later, during a lower
> priority render. Crucially, all updates subsequent to a skipped update also
> remain in the queue _regardless of their priority_. That means high priority
> updates are sometimes processed twice, at two separate priorities. We also
> keep track of a base state, that represents the state before the first
> update in the queue is applied.

For example:

Given a base state of '', and the following queue of updates

```
    A1 - B2 - C1 - D2
```

其中数字表示优先级，通过附加字母将更新应用于以前的状态，react 将这些更新作为两个单独的渲染处理，每个优先级渲染一次：

> where the number indicates the priority, and the update is applied to the
> previous state by appending a letter, React will process these updates as
> two separate renders, one per distinct priority level:

First render, at priority 1:

```bash
Base state: ''
Updates: [A1, C1]
Result state: 'AC'
```

Second render, at priority 2:

```bash
# 暂时不知道这个 state是啥
Base state: 'A' <- The base state does not include C1,
because B2 was skipped.
Updates: [B2, C1, D2] <- C1 was rebased on top of B2
Result state: 'ABCD'
```

因为我们按插入顺序处理更新，并在跳过之前的更新时重新确定高优先级更新，不管优先级如何，最终结果都是确定性的。中间状态可以根据系统资源而变化，但最终状态总是相同的。

> Because we process updates in insertion order, and rebase high priority
> updates when preceding updates are skipped, the final result is deterministic
> regardless of priority. Intermediate state may vary according to system
> resources, but the final state is always the same.

## 全局状态（Global state）

```javascript
var UpdateState = 0;
var ReplaceState = 1;
var ForceUpdate = 2;
var CaptureUpdate = 3;

// Global state that is reset at the beginning of calling `processUpdateQueue`.
// It should only be read right after calling `processUpdateQueue`, via
// `checkHasForceUpdateAfterProcessing`.
var hasForceUpdate = false;
var didWarnUpdateInsideUpdate = false;
var currentlyProcessingQueue = null; // 在 enqueueUpdate 函数中使用
var resetCurrentlyProcessingQueue = function() {
    currentlyProcessingQueue = null;
};
```

```javascript
function createUpdateQueue(baseState) {
    var queue = {
        baseState: baseState,
        firstUpdate: null,
        lastUpdate: null,
        firstCapturedUpdate: null,
        lastCapturedUpdate: null,
        firstEffect: null,
        lastEffect: null,
        firstCapturedEffect: null,
        lastCapturedEffect: null
    };
    return queue;
}

function cloneUpdateQueue(currentQueue) {
    var queue = {
        baseState: currentQueue.baseState,
        firstUpdate: currentQueue.firstUpdate,
        lastUpdate: currentQueue.lastUpdate,

        // TODO: With resuming, if we bail out and resuse the child tree, we should
        // keep these effects.
        firstCapturedUpdate: null,
        lastCapturedUpdate: null,

        firstEffect: null,
        lastEffect: null,

        firstCapturedEffect: null,
        lastCapturedEffect: null
    };
    return queue;
}

function createUpdate(expirationTime) {
    return {
        expirationTime: expirationTime,
        tag: UpdateState, // 0 常量
        payload: null,
        callback: null,
        next: null,
        nextEffect: null
    };
}

// Append the update to the end of the list.
// 将 update 添加到 queue 的末尾
function appendUpdateToQueue(queue, update) {
    if (queue.lastUpdate === null) {
        // Queue is empty
        queue.firstUpdate = queue.lastUpdate = update;
    } else {
        // update的格式：
        //     {
        //     expirationTime: expirationTime,
        //     tag: UpdateState, // 0 常量
        //     payload: null,
        //     callback: null,
        //     next: null,
        //     nextEffect: null
        // }
        // 将 新的update 赋值给上一个update.next属性，
        // 这样整个update就串联了起来
        queue.lastUpdate.next = update;
        queue.lastUpdate = update;
    }
}
```

## `enqueueUpdate(fiber, update)`

传入 `fiber` 及一个 `update`作为参数。在这个函数里用到了 fiber 上的两个属性：

```javascript
{
    alternate: null,  // 另一个fiber
    updateQueue: null, // updateQueue对象
}
```

首先获取`fiber.alternate`，也就是另一个 fiber（这里我们称为`fiber2`），这个 `fiber2` 可能存在，也可能不存在。

然后就是确定`fiber.updateQueue`及`fiber2.updateQueue`一定存在（如果`fiber2`不存在就不用管了）。如果不存在就创建一个，或从另一个 fiber 上拷贝。这里的`updateQueue`就是通过上面`createUpdateQueue`创建的对象。

这个对象中的`firstUpdate`和`lastUpdate`属性保存着指向真正的 UpdateQueue 的指针。

**这两个 fiber 的 updateQueue 属性指向不同对象，但他们维护的队列始终是同一个。**

最后，将传入的参数`update`，添加到`updateQueue`所维护队列的末尾。

```javascript
function enqueueUpdate(fiber, update) {
    // Update queues are created lazily.
    // 更新队列是延迟创建的。
    var alternate = fiber.alternate;
    var queue1 = undefined;
    var queue2 = undefined;
    if (alternate === null) {
        // 没有其他可切换的fiber，这是唯一的一个
        queue1 = fiber.updateQueue;
        queue2 = null;
        if (queue1 === null) {
            queue1 = fiber.updateQueue = createUpdateQueue(fiber.memoizedState);
        }
    } else {
        // There are two owners.
        queue1 = fiber.updateQueue;
        queue2 = alternate.updateQueue;
        if (queue1 === null) {
            if (queue2 === null) {
                // Neither fiber has an update queue. Create new ones.
                queue1 = fiber.updateQueue = createUpdateQueue(
                    fiber.memoizedState
                );
                queue2 = alternate.updateQueue = createUpdateQueue(
                    alternate.memoizedState
                );
            } else {
                // Only one fiber has an update queue. Clone to create a new one.
                queue1 = fiber.updateQueue = cloneUpdateQueue(queue2);
            }
        } else {
            if (queue2 === null) {
                // Only one fiber has an update queue. Clone to create a new one.
                queue2 = alternate.updateQueue = cloneUpdateQueue(queue1);
            } else {
                // Both owners have an update queue.
            }
        }
    }

    if (queue2 === null || queue1 === queue2) {
        // There's only a single queue.
        appendUpdateToQueue(queue1, update);
    } else {
        // There are two queues. We need to append the update to both queues,
        // while accounting for the persistent structure of the list — we don't
        // want the same update to be added multiple times.
        // 有两个队列。我们需要将更新附加到两个队列，同时考虑到列表的持久结构-
        // 我们不希望多次添加相同的更新。
        if (queue1.lastUpdate === null || queue2.lastUpdate === null) {
            // One of the queues is not empty. We must add the update to both queues.
            appendUpdateToQueue(queue1, update);
            appendUpdateToQueue(queue2, update);
        } else {
            // Both queues are non-empty. The last update is the same in both lists,
            // because of structural sharing. So, only append to one of the lists.
            appendUpdateToQueue(queue1, update);
            // But we still need to update the `lastUpdate` pointer of queue2.
            queue2.lastUpdate = update;
        }
    }

    if (
        fiber.tag === ClassComponent &&
        (currentlyProcessingQueue === queue1 ||
            (queue2 !== null && currentlyProcessingQueue === queue2)) &&
        !didWarnUpdateInsideUpdate
    ) {
        warningWithoutStack(
            false,
            'An update (setState, replaceState, or forceUpdate) was scheduled ' +
                'from inside an update function. Update functions should be pure, ' +
                'with zero side-effects. Consider using componentDidUpdate or a ' +
                'callback.'
        );
        didWarnUpdateInsideUpdate = true;
    }
}

function enqueueCapturedUpdate(workInProgress, update) {
    // Captured updates go into a separate list, and only on the work-in-
    // progress queue.
    // 捕获的更新将放入单独的列表中，并且仅在work-in-progress的队列中。
    var workInProgressQueue = workInProgress.updateQueue;
    if (workInProgressQueue === null) {
        workInProgressQueue = workInProgress.updateQueue = createUpdateQueue(
            workInProgress.memoizedState
        );
    } else {
        // TODO: I put this here rather than createWorkInProgress so that we don't
        // clone the queue unnecessarily. There's probably a better way to
        // structure this.
        workInProgressQueue = ensureWorkInProgressQueueIsAClone(
            workInProgress,
            workInProgressQueue
        );
    }

    // Append the update to the end of the list.
    if (workInProgressQueue.lastCapturedUpdate === null) {
        // This is the first render phase update
        workInProgressQueue.firstCapturedUpdate = workInProgressQueue.lastCapturedUpdate = update;
    } else {
        workInProgressQueue.lastCapturedUpdate.next = update;
        workInProgressQueue.lastCapturedUpdate = update;
    }
}
```

## `ensureWorkInProgressQueueIsAClone(workInProgress, queue)`

确保`workInProgress.updateQueue`跟`workInProgress.alternate.updateQueue`不能是同一个。按照 UpdateQueue 的设计功能，所有的工作都在 workInProgress 上面进行，如果`workInProgress.updateQueue` 跟 `workInProgress.alternate.updateQueue`是同一个，则克隆 updateQueue 然后将其赋值给`workInProgress.updateQueue`。

```javascript
function ensureWorkInProgressQueueIsAClone(workInProgress, queue) {
    var current = workInProgress.alternate;
    if (current !== null) {
        // If the work-in-progress queue is equal to the current queue,
        // we need to clone it first.
        if (queue === current.updateQueue) {
            queue = workInProgress.updateQueue = cloneUpdateQueue(queue);
        }
    }
    return queue;
}
```

## `processUpdateQueue`（处理更新队列）

这里的逻辑就是开头概述里描述的。

> 在渲染阶段处理更新队列时，结果中仅包括具有足够优先级的更新。如果一个更新没有足够的优先级，我们将跳过它，它将保留在队列中，以便稍后在较低优先级渲染期间进行处理。至关重要的是，跳过更新之后的所有更新也会保留在队列中*而不管它们的优先级*。这意味着高优先级更新有时会以两个不同的优先级处理两次。我们还跟踪基本状态，它表示应用队列中的第一次更新之前的状态。

```javascript
function processUpdateQueue(
    workInProgress,
    queue,
    props,
    instance,
    renderExpirationTime
) {
    hasForceUpdate = false;

    // 工作只在workInProgress上进行，确保`workInProgress.updateQueue`
    // 是一个独立的queue，不会影响另一个updateQueue
    queue = ensureWorkInProgressQueueIsAClone(workInProgress, queue);

    // 在 enqueueUpdate 函数中使用
    currentlyProcessingQueue = queue;

    // These values may change as we process the queue.
    // 当我们处理队列时，这些值可能会改变
    var newBaseState = queue.baseState;
    var newFirstUpdate = null;
    var newExpirationTime = NoWork;

    // Iterate through the list of updates to compute the result.
    // 遍历updates，计算最终结果
    var update = queue.firstUpdate;
    var resultState = newBaseState;
    while (update !== null) {
        var updateExpirationTime = update.expirationTime;
        if (updateExpirationTime < renderExpirationTime) {
            // This update does not have sufficient priority. Skip it.
            // 此更新没有足够的优先级。跳过它。
            //
            // 在渲染阶段处理更新队列时，结果中仅包括具有足够优先级的更新。如果一个更新没有足够的优
            // 先级，我们将跳过它，它将保留在队列中，以便稍后在较低优先级渲染期间进行处理。
            if (newFirstUpdate === null) {
                // This is the first skipped update. It will be the first update in
                // the new list.
                newFirstUpdate = update;
                // Since this is the first update that was skipped, the current result
                // is the new base state.
                newBaseState = resultState;
            }
            // Since this update will remain in the list, update the remaining
            // expiration time.
            if (newExpirationTime < updateExpirationTime) {
                newExpirationTime = updateExpirationTime;
            }
        } else {
            // This update does have sufficient priority. Process it and compute
            // a new result.
            // update具有足够高的权限，处理它并获取结果。
            resultState = getStateFromUpdate(
                workInProgress,
                queue,
                update,
                resultState,
                props,
                instance
            );
            /* ----------- */
            /* ----------- */
            /* ----------- */
            /* 暂时不懂这里 */
            /* ----------- */
            /* ----------- */
            /* ----------- */
            var _callback = update.callback;
            if (_callback !== null) {
                //                             32
                workInProgress.effectTag |= Callback;
                // Set this to null, in case it was mutated during an aborted render.
                // 将此设置为NULL，以防在中止的渲染过程中发生变化。
                update.nextEffect = null;
                if (queue.lastEffect === null) {
                    queue.firstEffect = queue.lastEffect = update;
                } else {
                    queue.lastEffect.nextEffect = update;
                    queue.lastEffect = update;
                }
            }
        }
        // Continue to the next update.
        update = update.next;
    }

    // Separately, iterate though the list of captured updates.
    // 单独地，遍历捕获的更新列表。
    var newFirstCapturedUpdate = null;
    update = queue.firstCapturedUpdate;
    while (update !== null) {
        var _updateExpirationTime = update.expirationTime;
        if (_updateExpirationTime < renderExpirationTime) {
            // This update does not have sufficient priority. Skip it.
            if (newFirstCapturedUpdate === null) {
                // This is the first skipped captured update. It will be the first
                // update in the new list.
                newFirstCapturedUpdate = update;
                // If this is the first update that was skipped, the current result is
                // the new base state.
                if (newFirstUpdate === null) {
                    newBaseState = resultState;
                }
            }
            // Since this update will remain in the list, update the remaining
            // expiration time.
            if (newExpirationTime < _updateExpirationTime) {
                newExpirationTime = _updateExpirationTime;
            }
        } else {
            // This update does have sufficient priority. Process it and compute
            // a new result.
            resultState = getStateFromUpdate(
                workInProgress,
                queue,
                update,
                resultState,
                props,
                instance
            );
            var _callback2 = update.callback;
            if (_callback2 !== null) {
                workInProgress.effectTag |= Callback;
                // Set this to null, in case it was mutated during an aborted render.
                update.nextEffect = null;
                if (queue.lastCapturedEffect === null) {
                    queue.firstCapturedEffect = queue.lastCapturedEffect = update;
                } else {
                    queue.lastCapturedEffect.nextEffect = update;
                    queue.lastCapturedEffect = update;
                }
            }
        }
        update = update.next;
    }

    if (newFirstUpdate === null) {
        queue.lastUpdate = null;
    }
    if (newFirstCapturedUpdate === null) {
        queue.lastCapturedUpdate = null;
    } else {
        workInProgress.effectTag |= Callback;
    }
    if (newFirstUpdate === null && newFirstCapturedUpdate === null) {
        // We processed every update, without skipping. That means the new base
        // state is the same as the result state.
        newBaseState = resultState;
    }

    queue.baseState = newBaseState;
    queue.firstUpdate = newFirstUpdate;
    queue.firstCapturedUpdate = newFirstCapturedUpdate;

    // Set the remaining expiration time to be whatever is remaining in the queue.
    // This should be fine because the only two other things that contribute to
    // expiration time are props and context. We're already in the middle of the
    // begin phase by the time we start processing the queue, so we've already
    // dealt with the props. Context in components that specify
    // shouldComponentUpdate is tricky; but we'll have to account for
    // that regardless.
    // 将剩余过期时间设置为队列中剩余的任何内容。
    // 这应该没问题，因为导致到期时间的另外两个因素是道具和上下文。
    // 当我们开始处理队列时，我们已经处于开始阶段的中间，所以我们已经处理好了道具。
    // 指定shouldComponentUpdate的组件中的上下文是很棘手的；
    // 但是无论如何我们都必须考虑到这一点。
    workInProgress.expirationTime = newExpirationTime;
    workInProgress.memoizedState = resultState;

    {
        currentlyProcessingQueue = null;
    }
}
```

## **`getStateFromUpdate`**

关于 state 的函数，调用下面这些方法：

1. replaceState
2. forceUpdate
3. setState

引起的更新，经过此方法处理，返回一个新的 state

```javascript
function getStateFromUpdate(
    workInProgress,
    queue,
    update,
    prevState,
    nextProps,
    instance
) {
    switch (update.tag) {
        // replaceState() 暂时不看
        case ReplaceState: {
            var _payload = update.payload;
            if (typeof _payload === 'function') {
                // Updater function
                {
                    enterDisallowedContextReadInDEV();
                    if (
                        debugRenderPhaseSideEffects ||
                        (debugRenderPhaseSideEffectsForStrictMode &&
                            workInProgress.mode & StrictMode)
                    ) {
                        _payload.call(instance, prevState, nextProps);
                    }
                }
                var nextState = _payload.call(instance, prevState, nextProps);
                {
                    exitDisallowedContextReadInDEV();
                }
                return nextState;
            }
            // State object
            return _payload;
        }
        case CaptureUpdate: {
            workInProgress.effectTag =
                (workInProgress.effectTag & ~ShouldCapture) | DidCapture;
        }
        // Intentional fallthrough
        // 故意跌落
        // setState
        case UpdateState: {
            var _payload2 = update.payload;
            var partialState = undefined;
            if (typeof _payload2 === 'function') {
                // Updater function
                //
                // setState(prev=>{
                //    value: !prev.value
                //})
                {
                    enterDisallowedContextReadInDEV();
                    if (
                        debugRenderPhaseSideEffects ||
                        (debugRenderPhaseSideEffectsForStrictMode &&
                            workInProgress.mode & StrictMode)
                    ) {
                        _payload2.call(instance, prevState, nextProps);
                    }
                }
                partialState = _payload2.call(instance, prevState, nextProps);
                {
                    exitDisallowedContextReadInDEV();
                }
            } else {
                // Partial state object
                // 部分 state object
                //
                // setState({
                //    value: 'value'
                //})
                partialState = _payload2;
            }
            if (partialState === null || partialState === undefined) {
                // Null and undefined are treated as no-ops.
                return prevState;
            }
            // Merge the partial state and the previous state.
            return _assign({}, prevState, partialState);
        }
        case ForceUpdate: {
            hasForceUpdate = true;
            return prevState;
        }
    }
    return prevState;
}
```

## 其他

```javascript
function callCallback(callback, context) {
    !(typeof callback === 'function')
        ? invariant(
              false,
              'Invalid argument passed as callback. Expected a function. Instead received: %s',
              callback
          )
        : undefined;
    callback.call(context);
}

function resetHasForceUpdateBeforeProcessing() {
    hasForceUpdate = false;
}

function checkHasForceUpdateAfterProcessing() {
    return hasForceUpdate;
}

function commitUpdateQueue(
    finishedWork,
    finishedQueue,
    instance,
    renderExpirationTime
) {
    // If the finished render included captured updates, and there are still
    // lower priority updates left over, we need to keep the captured updates
    // in the queue so that they are rebased and not dropped once we process the
    // queue again at the lower priority.
    if (finishedQueue.firstCapturedUpdate !== null) {
        // Join the captured update list to the end of the normal list.
        if (finishedQueue.lastUpdate !== null) {
            finishedQueue.lastUpdate.next = finishedQueue.firstCapturedUpdate;
            finishedQueue.lastUpdate = finishedQueue.lastCapturedUpdate;
        }
        // Clear the list of captured updates.
        finishedQueue.firstCapturedUpdate = finishedQueue.lastCapturedUpdate = null;
    }

    // Commit the effects
    commitUpdateEffects(finishedQueue.firstEffect, instance);
    finishedQueue.firstEffect = finishedQueue.lastEffect = null;

    commitUpdateEffects(finishedQueue.firstCapturedEffect, instance);
    finishedQueue.firstCapturedEffect = finishedQueue.lastCapturedEffect = null;
}

function commitUpdateEffects(effect, instance) {
    while (effect !== null) {
        var _callback3 = effect.callback;
        if (_callback3 !== null) {
            effect.callback = null;
            callCallback(_callback3, instance);
        }
        effect = effect.nextEffect;
    }
}

function createCapturedValue(value, source) {
    // If the value is an error, call this function immediately after it is thrown
    // so the stack is accurate.
    return {
        value: value,
        source: source,
        stack: getStackByFiberInDevAndProd(source)
    };
}

function markUpdate(workInProgress) {
    // Tag the fiber with an update effect. This turns a Placement into
    // a PlacementAndUpdate.
    workInProgress.effectTag |= Update;
}

function markRef$1(workInProgress) {
    workInProgress.effectTag |= Ref;
}
```
