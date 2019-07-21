``` javascript
var ImmediatePriority = 1;
var UserBlockingPriority = 2; // 用户阻塞优先级
var NormalPriority = 3;
var LowPriority = 4;
var IdlePriority = 5; // 空闲优先级

// Max 31 bit integer. The max integer size in V8 for 32-bit systems. Math.pow(2, 30) - 1
// 运行在在32位系统中的v8引擎中的最大的31位整数 Math.pow(2, 30) - 1
// 0b111111111111111111111111111111
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

var hasNativePerformanceNow = typeof performance === 'object' && typeof performance.now === 'function';

var localDate = Date;

// This initialization code may run even on server environments if a component
// just imports ReactDOM (e.g. for findDOMNode). Some environments might not
// have setTimeout or clearTimeout. However, we always expect them to be defined
// on the client. https://github.com/facebook/react/pull/13088
var localSetTimeout = typeof setTimeout === 'function' ? setTimeout : undefined;
var localClearTimeout = typeof clearTimeout === 'function' ? clearTimeout : undefined;

// We don't expect either of these to necessarily be defined, but we will error
// later if they are missing on the client.
var localRequestAnimationFrame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : undefined;
var localCancelAnimationFrame = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : undefined;

// requestAnimationFrame does not run when the tab is in the background. If
// we're backgrounded we prefer for that work to happen so that the page
// continues to load in the background. So we also schedule a 'setTimeout' as
// a fallback.
// TODO: Need a better heuristic for backgrounded work.
var ANIMATION_FRAME_TIMEOUT = 100;
var rAFID;
var rAFTimeoutID;



var globalValue = null;


/*  -------------------------------------   */
/*             function                     */
/*  -------------------------------------   */

function ensureHostCallbackIsScheduled() {}
function flushFirstCallback() {}
function flushImmediateWork() {}
function flushWork() {}
function unstable_runWithPriority() {}
function unstable_next() {}
function unstable_wrapCallback() {}
function unstable_scheduleCallback() {}
function unstable_pauseExecution() {}
function unstable_continueExecution() {}
function unstable_getFirstCallbackNode() {}
function unstable_cancelCallback() {}
function unstable_getCurrentPriorityLevel() {}
function unstable_shouldYield() {}
function requestAnimationFrameWithTimeout() {}
if (hasNativePerformanceNow) {
    var Performance = performance;
    exports.unstable_now = function () {
        return Performance.now();
    };
} else {
    exports.unstable_now = function () {
        var localDate = Date;
        return localDate.now();
    };
}

function shouldYieldToHost() {}
function cancelHostCallback() {}
function requestHostCallback() {}


```