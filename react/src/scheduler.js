/* eslint-disable no-var */
/**
 *  priority  [ praɪ'ɔːrətɪ ] 优先级
 *
 */
'use strict';
Object.defineProperty(exports, '__esModule', { value: true });

var ImmediatePriority = 1;
var UserBlockingPriority = 2; // 用户阻塞优先级
var NormalPriority = 3;
var LowPriority = 4;
var IdlePriority = 5; // 空闲优先级

// Max 31 bit integer. The max integer size in V8 for 32-bit systems. Math.pow(2, 30) - 1
// 运行在在32位系统中的v8引擎中的最大的31位整数 Math.pow(2, 30) - 1
//  0b111111111111111111111111111111
var maxSigned31BitInt = 1073741823;

// Times out immediately
var IMMEDIATE_PRIORITY_TIMEOUT = -1;
// Eventually times out 最终超时
var USER_BLOCKING_PRIORITY = 250;
var NORMAL_PRIORITY_TIMEOUT = 5000;
var LOW_PRIORITY_TIMEOUT = 10000;
// Never times out
var IDLE_PRIORITY = maxSigned31BitInt;

// Callbacks are stored as a circular, doubly linked list.
// 回调被存储为一个循环的双向链表。
var firstCallbackNode = null;

var currentDidTimeout = false;

// Pausing the scheduler is useful for debugging.
// var isSchedulerPaused = false;

var currentPriorityLevel = NormalPriority;
var currentEventStartTime = -1;
var currentExpirationTime = -1;

// This is set when a callback is being executed, to prevent re-entrancy.
// 这是在执行回调时设置的，以防止重新进入。
var isExecutingCallback = false;

var isHostCallbackScheduled = false;

function ensureHostCallbackIsScheduled() {
    if (isExecutingCallback) {
        // Don't schedule work yet; wait until the next time we yield.
        return;
    }
    // Schedule the host callback using the earliest expiration in the list.
    // 使用列表中最早到期的时间安排主要回调。
    var expirationTime = firstCallbackNode.expirationTime;
    if (!isHostCallbackScheduled) {
        isHostCallbackScheduled = true;
    } else {
        // Cancel the existing host callback.
        cancelHostCallback();
    }
    requestHostCallback(flushWork, expirationTime);
}

function flushFirstCallback() {
    var flushedNode = firstCallbackNode;

    // Remove the node from the list before calling the callback. That way the
    // list is in a consistent state even if the callback throws.
    // 在调用回调之前从列表中删除该节点。这样，即使回调抛出，列表也处于一致状态。
    var next = firstCallbackNode.next;
    if (firstCallbackNode === next) {
        // This is the last callback in the list.
        firstCallbackNode = null;
        next = null;
    } else {
        var lastCallbackNode = firstCallbackNode.previous;
        firstCallbackNode = lastCallbackNode.next = next;
        next.previous = lastCallbackNode;
    }

    flushedNode.next = flushedNode.previous = null;

    // Now it's safe to call the callback.
    var callback = flushedNode.callback;
    var expirationTime = flushedNode.expirationTime;
    var priorityLevel = flushedNode.priorityLevel;
    var previousPriorityLevel = currentPriorityLevel;
    var previousExpirationTime = currentExpirationTime;
    currentPriorityLevel = priorityLevel;
    currentExpirationTime = expirationTime;
    var continuationCallback;
    try {
        continuationCallback = callback();
    } finally {
        currentPriorityLevel = previousPriorityLevel;
        currentExpirationTime = previousExpirationTime;
    }

    // A callback may return a continuation. The continuation should be scheduled
    // with the same priority and expiration as the just-finished callback.
    if (typeof continuationCallback === 'function') {
        var continuationNode = {
            callback: continuationCallback,
            priorityLevel: priorityLevel,
            expirationTime: expirationTime,
            next: null,
            previous: null,
        };

        // Insert the new callback into the list, sorted by its expiration. This is
        // almost the same as the code in `scheduleCallback`, except the callback
        // is inserted into the list *before* callbacks of equal expiration instead
        // of after.
        if (firstCallbackNode === null) {
            // This is the first callback in the list.
            firstCallbackNode = continuationNode.next = continuationNode.previous = continuationNode;
        } else {
            var nextAfterContinuation = null;
            var node = firstCallbackNode;
            do {
                if (node.expirationTime >= expirationTime) {
                    // This callback expires at or after the continuation. We will insert
                    // the continuation *before* this callback.
                    nextAfterContinuation = node;
                    break;
                }
                node = node.next;
            } while (node !== firstCallbackNode);

            if (nextAfterContinuation === null) {
                // No equal or lower priority callback was found, which means the new
                // callback is the lowest priority callback in the list.
                nextAfterContinuation = firstCallbackNode;
            } else if (nextAfterContinuation === firstCallbackNode) {
                // The new callback is the highest priority callback in the list.
                firstCallbackNode = continuationNode;
                ensureHostCallbackIsScheduled();
            }

            var previous = nextAfterContinuation.previous;
            previous.next = nextAfterContinuation.previous = continuationNode;
            continuationNode.next = nextAfterContinuation;
            continuationNode.previous = previous;
        }
    }
}

function flushImmediateWork() {
    if (
        // Confirm we've exited the outer most event handler
        // 确认我们已退出最外层的事件处理程序
        currentEventStartTime === -1 &&
        firstCallbackNode !== null &&
        firstCallbackNode.priorityLevel === ImmediatePriority
    ) {
        isExecutingCallback = true;
        try {
            do {
                flushFirstCallback();
            } while (
                // Keep flushing until there are no more immediate callbacks
                firstCallbackNode !== null &&
                firstCallbackNode.priorityLevel === ImmediatePriority
            );
        } finally {
            isExecutingCallback = false;
            if (firstCallbackNode !== null) {
                // There's still work remaining. Request another callback.
                ensureHostCallbackIsScheduled();
            } else {
                isHostCallbackScheduled = false;
            }
        }
    }
}

function flushWork(didTimeout) {
    isExecutingCallback = true;
    var previousDidTimeout = currentDidTimeout;
    currentDidTimeout = didTimeout;
    try {
        if (didTimeout) {
            // Flush all the expired callbacks without yielding.
            // 清空所有已经过期的回调。
            while (firstCallbackNode !== null) {
                // 读取 current time. 清除所有已经过期或刚好过期的回调。
                // 之后继续读取，清除，重复这个步骤。
                // 尽可能的减少 performance.now 的调用次数以优化性能。
                var currentTime = exports.unstable_now();
                if (firstCallbackNode.expirationTime <= currentTime) {
                    do {
                        flushFirstCallback();
                    } while (
                        firstCallbackNode !== null &&
                        firstCallbackNode.expirationTime <= currentTime
                    );
                    continue;
                }
                break;
            }
        } else {
            // 清空所有回调，直到当前帧的时间耗尽。
            if (firstCallbackNode !== null) {
                do {
                    flushFirstCallback();
                } while (firstCallbackNode !== null && !shouldYieldToHost());
            }
        }
    } finally {
        isExecutingCallback = false;
        currentDidTimeout = previousDidTimeout;
        if (firstCallbackNode !== null) {
            // 还有工作要做。请求另一个回调。
            ensureHostCallbackIsScheduled();
        } else {
            isHostCallbackScheduled = false;
        }
        // Before exiting, flush all the immediate work that was scheduled.
        // 在退出之前，清除所有优先级为 ImmediatePriority 的工作。
        flushImmediateWork();
    }
}

function unstable_runWithPriority(priorityLevel, eventHandler) {
    switch (priorityLevel) {
        case ImmediatePriority:
        case UserBlockingPriority:
        case NormalPriority:
        case LowPriority:
        case IdlePriority:
            break;
        default:
            priorityLevel = NormalPriority;
    }

    var previousPriorityLevel = currentPriorityLevel;
    var previousEventStartTime = currentEventStartTime;
    currentPriorityLevel = priorityLevel;
    currentEventStartTime = exports.unstable_now();

    try {
        return eventHandler();
    } finally {
        currentPriorityLevel = previousPriorityLevel;
        currentEventStartTime = previousEventStartTime;

        // Before exiting, flush all the immediate work that was scheduled.
        flushImmediateWork();
    }
}

function unstable_next(eventHandler) {
    var priorityLevel = void 0;
    switch (currentPriorityLevel) {
        case ImmediatePriority:
        case UserBlockingPriority:
        case NormalPriority:
            // Shift down to normal priority
            priorityLevel = NormalPriority;
            break;
        default:
            // Anything lower than normal priority should remain at the current level.
            priorityLevel = currentPriorityLevel;
            break;
    }

    var previousPriorityLevel = currentPriorityLevel;
    var previousEventStartTime = currentEventStartTime;
    currentPriorityLevel = priorityLevel;
    currentEventStartTime = exports.unstable_now();

    try {
        return eventHandler();
    } finally {
        currentPriorityLevel = previousPriorityLevel;
        currentEventStartTime = previousEventStartTime;

        // Before exiting, flush all the immediate work that was scheduled.
        flushImmediateWork();
    }
}

function unstable_wrapCallback(callback) {
    var parentPriorityLevel = currentPriorityLevel;
    return function () {
        // This is a fork of runWithPriority, inlined for performance.
        var previousPriorityLevel = currentPriorityLevel;
        var previousEventStartTime = currentEventStartTime;
        currentPriorityLevel = parentPriorityLevel;
        currentEventStartTime = exports.unstable_now();

        try {
            return callback.apply(this, arguments);
        } finally {
            currentPriorityLevel = previousPriorityLevel;
            currentEventStartTime = previousEventStartTime;
            flushImmediateWork();
        }
    };
}

function unstable_scheduleCallback(callback, deprecated_options) {
    var startTime =
        currentEventStartTime !== -1
            ? currentEventStartTime
            : exports.unstable_now();

    var expirationTime;
    if (
        typeof deprecated_options === 'object' &&
        deprecated_options !== null &&
        typeof deprecated_options.timeout === 'number'
    ) {
        // FIXME: Remove this branch once we lift expiration times out of React.
        expirationTime = startTime + deprecated_options.timeout;
    } else {
        switch (currentPriorityLevel) {
            case ImmediatePriority:
                expirationTime = startTime + IMMEDIATE_PRIORITY_TIMEOUT;
                break;
            case UserBlockingPriority:
                expirationTime = startTime + USER_BLOCKING_PRIORITY;
                break;
            case IdlePriority:
                expirationTime = startTime + IDLE_PRIORITY;
                break;
            case LowPriority:
                expirationTime = startTime + LOW_PRIORITY_TIMEOUT;
                break;
            case NormalPriority:
            default:
                expirationTime = startTime + NORMAL_PRIORITY_TIMEOUT;
        }
    }

    var newNode = {
        callback: callback,
        priorityLevel: currentPriorityLevel,
        expirationTime: expirationTime,
        next: null,
        previous: null,
    };

    // Insert the new callback into the list, ordered first by expiration, then
    // by insertion. So the new callback is inserted any other callback with
    // equal expiration.
    if (firstCallbackNode === null) {
        // This is the first callback in the list.
        firstCallbackNode = newNode.next = newNode.previous = newNode;
        ensureHostCallbackIsScheduled();
    } else {
        var next = null;
        var node = firstCallbackNode;
        do {
            if (node.expirationTime > expirationTime) {
                // The new callback expires before this one.
                next = node;
                break;
            }
            node = node.next;
        } while (node !== firstCallbackNode);

        if (next === null) {
            // No callback with a later expiration was found, which means the new
            // callback has the latest expiration in the list.
            next = firstCallbackNode;
        } else if (next === firstCallbackNode) {
            // The new callback has the earliest expiration in the entire list.
            firstCallbackNode = newNode;
            ensureHostCallbackIsScheduled();
        }

        var previous = next.previous;
        previous.next = next.previous = newNode;
        newNode.next = next;
        newNode.previous = previous;
    }

    return newNode;
}

function unstable_pauseExecution() {
    isSchedulerPaused = true;
}

function unstable_continueExecution() {
    isSchedulerPaused = false;
    if (firstCallbackNode !== null) {
        ensureHostCallbackIsScheduled();
    }
}

function unstable_getFirstCallbackNode() {
    return firstCallbackNode;
}

function unstable_cancelCallback(callbackNode) {
    var next = callbackNode.next;
    if (next === null) {
        // Already cancelled.
        return;
    }

    if (next === callbackNode) {
        // This is the only scheduled callback. Clear the list.
        firstCallbackNode = null;
    } else {
        // Remove the callback from its position in the list.
        if (callbackNode === firstCallbackNode) {
            firstCallbackNode = next;
        }
        var previous = callbackNode.previous;
        previous.next = next;
        next.previous = previous;
    }

    callbackNode.next = callbackNode.previous = null;
}

function unstable_getCurrentPriorityLevel() {
    return currentPriorityLevel;
}

function unstable_shouldYield() {
    return (
        !currentDidTimeout &&
        ((firstCallbackNode !== null &&
            firstCallbackNode.expirationTime < currentExpirationTime) ||
            shouldYieldToHost())
    );
}

// This initialization code may run even on server environments if a component
// just imports ReactDOM (e.g. for findDOMNode). Some environments might not
// have setTimeout or clearTimeout. However, we always expect them to be defined
// on the client. https://github.com/facebook/react/pull/13088
var localSetTimeout = setTimeout;
var localClearTimeout = clearTimeout;

// We don't expect either of these to necessarily be defined, but we will error
// later if they are missing on the client.
var localRequestAnimationFrame = requestAnimationFrame;

var localCancelAnimationFrame = cancelAnimationFrame;

// 因为电源管理策略（笔记本电脑节能），浏览器会中止那些后台打开的标签页的脚本运行及一些其他操作
// 当标签页进入后台时，requestAnimationFrame将不会执行。但我们希望即使标签页在后台打开，脚本还是能
// 继续执行，这样页面可以继续加载，所以我们这时使用setTimeout作为备用功能。
// TODO: Need a better heuristic for backgrounded work.
var ANIMATION_FRAME_TIMEOUT = 100;
var rAFID;
var rAFTimeoutID;
var requestAnimationFrameWithTimeout = function (callback) {
    // 这个函数的作用就是用来在每一帧开始前调用animationTick函数
    // 所以callback指的就是固定的 animationTick 函数

    // schedule rAF and also a setTimeout
    rAFID = localRequestAnimationFrame(function (timestamp) {
        // 下一次重绘之前更新动画帧所调用的函数(即上面所说的回调函数)。
        // 该回调函数会被传入DOMHighResTimeStamp参数，该参数与performance.now()的返回值相同，
        // 它表示requestAnimationFrame() 开始去执行回调函数的时刻。

        // cancel the setTimeout
        localClearTimeout(rAFTimeoutID);
        callback(timestamp);
    });
    rAFTimeoutID = localSetTimeout(function () {
        // cancel the requestAnimationFrame
        localCancelAnimationFrame(rAFID);
        callback(exports.unstable_now());
    }, ANIMATION_FRAME_TIMEOUT);
};

var Performance = performance;
exports.unstable_now = function () {
    return Performance.now();
};

var scheduledHostCallback = null;
var isMessageEventScheduled = false;
var timeoutTime = -1;

var isAnimationFrameScheduled = false;

var isFlushingHostCallback = false;

// frameDeadline指的是当前帧最迟的执行时间
var frameDeadline = 0;
// FrameTime 这里指的是帧与帧的间隔时间，如果帧率为30fps，则间隔大约为 33ms。
// 一开始假设我们以30fps运行，即帧与帧间隔时间为33ms，后续算法会判断当前屏幕的实际刷新率，从而动态调整
var previousFrameTime = 33;
var activeFrameTime = 33;

var shouldYieldToHost = function () {
    return frameDeadline <= exports.unstable_now();
};

// We use the postMessage trick to defer idle work until after the repaint.
// 我们使用postMessage技巧将闲置工作推迟到重新绘制之后。
var channel = new MessageChannel();
var port = channel.port2;
channel.port1.onmessage = function (event) {
    isMessageEventScheduled = false;

    var prevScheduledCallback = scheduledHostCallback;
    var prevTimeoutTime = timeoutTime;
    scheduledHostCallback = null;
    timeoutTime = -1;

    var currentTime = exports.unstable_now();

    var didTimeout = false;

    // 这个函数在重新绘制帧后开始执行。currentTime: 当前执行的时间； frameDeadline: 下一帧开始时间
    // 如果frameDeadline < currentTime，说明我们在这段空闲的时间里已经没有剩余的时间了
    if (frameDeadline - currentTime <= 0) {
        // There's no time left in this idle period. Check if the callback has
        // a timeout and whether it's been exceeded.
        if (prevTimeoutTime !== -1 && prevTimeoutTime <= currentTime) {
            // 已超时。
            // 即使没有剩余空闲时间，也要调用回调。
            didTimeout = true;
        } else {
            // 没超时
            if (!isAnimationFrameScheduled) {
                // Schedule another animation callback so we retry later.
                isAnimationFrameScheduled = true;
                requestAnimationFrameWithTimeout(animationTick);
            }
            // Exit without invoking the callback.
            scheduledHostCallback = prevScheduledCallback;
            timeoutTime = prevTimeoutTime;
            return;
        }
    }

    if (prevScheduledCallback !== null) {
        // 开始执行闲置任务，做个记号
        isFlushingHostCallback = true;
        try {
            prevScheduledCallback(didTimeout);
        } finally {
            isFlushingHostCallback = false;
        }
    }
};

// animationTick 会作为requestAnimationFrame的回调函数被调用，
// 该回调函数会被传入DOMHighResTimeStamp参数，该参数与performance.now()的返回值相同，
// 它表示requestAnimationFrame() 开始去执行回调函数的时刻。
// 所以rafTime的值是可以认为是performance.now()

var animationTick = function (rafTime) {
    if (scheduledHostCallback !== null) {
        // Eagerly schedule the next animation callback at the beginning of the
        // frame. If the scheduler queue is not empty at the end of the frame, it
        // will continue flushing inside that callback. If the queue *is* empty,
        // then it will exit immediately. Posting the callback at the start of the
        // frame ensures it's fired within the earliest possible frame. If we
        // waited until the end of the frame to post the callback, we risk the
        // browser skipping a frame and not firing the callback until the frame
        // after that.
        // 尽早的将下一个 requestAnimationFrameWithTimeout(animationTick) 安排在这一帧的开始。
        // 如果调度任务队列在当前帧的末尾不是空的，则继续调用，否则立即退出。
        // 在帧的开头放置回调可确保在尽可能早的帧内触发回调。
        // 如果我们等到帧的末尾才执行回调，那么浏览器可能会跳过一帧，直到下一帧才触发回调。
        requestAnimationFrameWithTimeout(animationTick);
    } else {
        // No pending work. Exit.
        // scheduledHostCallback === null，不存在需要进行的处理的工作，没必要继续执行
        isAnimationFrameScheduled = false;
        return;
    }

    /* ----------------- */
    /* 用来矫正帧率的算法 */
    /* ----------------- */

    // frameDeadLine：上一帧时我们预测的这一帧开始的时间： rafTime + activeFrameTime。
    // rafTime：这帧实际开始时间
    // nextFrameTime = rafTime - frameDeadline + activeFrameTime ===> rafTime - prevRafTime - activeFrameTime + activeFrameTime
    // nextFrameTime：当前帧与上一帧的实际时间间隔
    var nextFrameTime = rafTime - frameDeadline + activeFrameTime;
    if (
        nextFrameTime < activeFrameTime &&
        previousFrameTime < activeFrameTime
    ) {
        if (nextFrameTime < 8) {
            // 防御性编码。我们不支持高于120 Hz的帧频。如果计算的帧时间小于8，则可能是错误。
            // 1s = 1000ms  1000ms/120hz = 8.33333333 即帧间隔时间为8.33333333ms
            nextFrameTime = 8;
        }
        // 如果一帧变长了，那么下一帧可以变短来互补。
        // 但是如果连续有两个帧较短，则表明我们的帧速率实际上高于我们当前设定的帧率（在120 Hz显示器或90 Hz VR显示器上运行）。
        // 我们相应地动态调整我们的启发式算法。
        // 取两个中的最大值，以防其中一个因错过帧截止日期而出现异常。
        activeFrameTime =
            nextFrameTime < previousFrameTime
                ? previousFrameTime
                : nextFrameTime;
    } else {
        previousFrameTime = nextFrameTime;
    }
    // 这个frameDeadline才是我们真正想要的东西
    frameDeadline = rafTime + activeFrameTime;

    // 调用port.postMessage，postMessage技巧将闲置工作推迟到重新绘制之后
    if (!isMessageEventScheduled) {
        // channel.port1.onmessage 的回调中会将 isMessageEventScheduled 这个值设为 false
        isMessageEventScheduled = true;
        port.postMessage(undefined);
    }
};

var requestHostCallback = function (callback, absoluteTimeout) {
    // callback就是 flushWork 函数
    scheduledHostCallback = callback;
    timeoutTime = absoluteTimeout;

    if (isFlushingHostCallback || absoluteTimeout < 0) {
        // Don't wait for the next frame. Continue working ASAP, in a new event.
        port.postMessage(undefined);
    } else if (!isAnimationFrameScheduled) {
        // If rAF didn't already schedule one, we need to schedule a frame.
        // TODO: If this rAF doesn't materialize because the browser throttles, we
        // might want to still have setTimeout trigger rIC as a backup to ensure
        // that we keep performing work.
        isAnimationFrameScheduled = true;
        requestAnimationFrameWithTimeout(animationTick);
    }
};

var cancelHostCallback = function () {
    scheduledHostCallback = null;
    isMessageEventScheduled = false;
    timeoutTime = -1;
};

exports.unstable_ImmediatePriority = ImmediatePriority;
exports.unstable_UserBlockingPriority = UserBlockingPriority;
exports.unstable_NormalPriority = NormalPriority;
exports.unstable_IdlePriority = IdlePriority;
exports.unstable_LowPriority = LowPriority;
exports.unstable_runWithPriority = unstable_runWithPriority;
exports.unstable_next = unstable_next;
exports.unstable_scheduleCallback = unstable_scheduleCallback;
exports.unstable_cancelCallback = unstable_cancelCallback;
exports.unstable_wrapCallback = unstable_wrapCallback;
exports.unstable_getCurrentPriorityLevel = unstable_getCurrentPriorityLevel;
exports.unstable_shouldYield = unstable_shouldYield;
exports.unstable_continueExecution = unstable_continueExecution;
exports.unstable_pauseExecution = unstable_pauseExecution;
exports.unstable_getFirstCallbackNode = unstable_getFirstCallbackNode;
