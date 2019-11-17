# 主线，requestWork

只要 root 收到更新，调度程序就会调用 requestWork。在将来的某个时间点，由渲染器调用 renderRoot。

```javascript
function requestWork(root, expirationTime) {
    addRootToSchedule(root, expirationTime);
    if (isRendering) {
        // Prevent reentrancy. Remaining work will be scheduled at the end of
        // the currently rendering batch.
        // 防止重入。剩余的工作将安排在当前渲染批处理结束时。
        return;
    }

    if (isBatchingUpdates) {
        // Flush work at the end of the batch.
        if (isUnbatchingUpdates) {
            // ...unless we're inside unbatchedUpdates, in which case we should
            // flush it now.
            nextFlushedRoot = root;
            nextFlushedExpirationTime = Sync;
            performWorkOnRoot(root, Sync, false);
        }
        return;
    }

    // TODO: Get rid of Sync and use current time?
    if (expirationTime === Sync) {
        performSyncWork();
    } else {
        scheduleCallbackWithExpirationTime(root, expirationTime);
    }
}

function addRootToSchedule(root, expirationTime) {
    // Add the root to the schedule.
    // Check if this root is already part of the schedule.
    if (root.nextScheduledRoot === null) {
        // This root is not already scheduled. Add it.
        root.expirationTime = expirationTime;
        if (lastScheduledRoot === null) {
            firstScheduledRoot = lastScheduledRoot = root;
            root.nextScheduledRoot = root;
        } else {
            lastScheduledRoot.nextScheduledRoot = root;
            lastScheduledRoot = root;
            lastScheduledRoot.nextScheduledRoot = firstScheduledRoot;
        }
    } else {
        // This root is already scheduled, but its priority may have increased.
        // 此root已scheduled，但其优先级可能已增加。
        var remainingExpirationTime = root.expirationTime;
        if (expirationTime > remainingExpirationTime) {
            // Update the priority.
            root.expirationTime = expirationTime;
        }
    }
}
```

# 主线， `performWorkOnRoot(root, expirationTime, isYieldy)`

进入渲染阶段

```javascript
function performWorkOnRoot(root, expirationTime, isYieldy) {
    // 以递归方式调用了Performance WorkOnRoot。此错误可能是由REACT中的错误引起的。请提出问题。
    !!isRendering
        ? invariant(
              false,
              'performWorkOnRoot was called recursively. This error is likely caused by a bug in React. Please file an issue.'
          )
        : undefined;

    isRendering = true;

    // Check if this is async work or sync/expired work.
    if (!isYieldy) {
        // 同步渲染
        // Flush work without yielding.
        // TODO: Non-yieldy work does not necessarily imply expired work. A renderer
        // may want to perform some work without yielding, but also without
        // requiring the root to complete (by triggering placeholders).

        var finishedWork = root.finishedWork;
        if (finishedWork !== null) {
            // root 上的工作已经全部完成，可以 commit
            // This root is already complete. We can commit it.
            completeRoot(root, finishedWork, expirationTime);
        } else {
            // 开始渲染
            root.finishedWork = null;
            // If this root previously suspended, clear its existing timeout, since
            // we're about to try rendering again.
            var timeoutHandle = root.timeoutHandle;
            if (timeoutHandle !== noTimeout) {
                root.timeoutHandle = noTimeout;
                // $FlowFixMe Complains noTimeout is not a TimeoutID, despite the check above
                cancelTimeout(timeoutHandle);
            }
            renderRoot(root, isYieldy);
            finishedWork = root.finishedWork;
            if (finishedWork !== null) {
                // We've completed the root. Commit it.
                completeRoot(root, finishedWork, expirationTime);
            }
        }
    } else {
        // Flush async work.
        var _finishedWork = root.finishedWork;
        if (_finishedWork !== null) {
            // This root is already complete. We can commit it.
            completeRoot(root, _finishedWork, expirationTime);
        } else {
            root.finishedWork = null;
            // If this root previously suspended, clear its existing timeout, since
            // we're about to try rendering again.
            var _timeoutHandle = root.timeoutHandle;
            if (_timeoutHandle !== noTimeout) {
                root.timeoutHandle = noTimeout;
                // $FlowFixMe Complains noTimeout is not a TimeoutID, despite the check above
                cancelTimeout(_timeoutHandle);
            }
            renderRoot(root, isYieldy);
            _finishedWork = root.finishedWork;
            if (_finishedWork !== null) {
                // We've completed the root. Check the if we should yield one more time
                // before committing.
                if (!shouldYieldToRenderer()) {
                    // Still time left. Commit the root.
                    completeRoot(root, _finishedWork, expirationTime);
                } else {
                    // There's no time left. Mark this root as complete. We'll come
                    // back and commit it later.
                    root.finishedWork = _finishedWork;
                }
            }
        }
    }

    isRendering = false;
}
```

### 主线，`renderRoot`

```javascript
/**
 * ! important
 * 渲染节点
 */
function renderRoot(root, isYieldy) {
    !!isWorking
        ? invariant(
              false,
              'renderRoot was called recursively. This error is likely caused by a bug in React. Please file an issue.'
          )
        : undefined;

    flushPassiveEffects();

    isWorking = true;
    var previousDispatcher = ReactCurrentDispatcher.current;
    ReactCurrentDispatcher.current = ContextOnlyDispatcher;

    var expirationTime = root.nextExpirationTimeToWorkOn;

    // Check if we're starting from a fresh stack, or if we're resuming from
    // previously yielded work.
    // 检查我们是从一个新的堆栈开始，还是从以前产生的工作中恢复。
    if (
        expirationTime !== nextRenderExpirationTime ||
        root !== nextRoot ||
        nextUnitOfWork === null
    ) {
        // Reset the stack and start working from the root.
        resetStack();
        nextRoot = root;
        nextRenderExpirationTime = expirationTime;
        nextUnitOfWork = createWorkInProgress(
            nextRoot.current,
            null,
            nextRenderExpirationTime
        );
        root.pendingCommitExpirationTime = NoWork;

        // Determine which interactions this batch of work currently includes,
        // So that we can accurately attribute time spent working on it,
        var interactions = new Set();
        root.pendingInteractionMap.forEach(function(
            scheduledInteractions,
            scheduledExpirationTime
        ) {
            if (scheduledExpirationTime >= expirationTime) {
                scheduledInteractions.forEach(function(interaction) {
                    return interactions.add(interaction);
                });
            }
        });

        // Store the current set of interactions on the FiberRoot for a few reasons:
        // We can re-use it in hot functions like renderRoot() without having to recalculate it.
        // We will also use it in commitWork() to pass to any Profiler onRender() hooks.
        // This also provides DevTools with a way to access it when the onCommitRoot() hook is called.
        root.memoizedInteractions = interactions;

        if (interactions.size > 0) {
            var subscriber = tracing.__subscriberRef.current;
            if (subscriber !== null) {
                var threadID = computeThreadID(
                    expirationTime,
                    root.interactionThreadID
                );
                try {
                    subscriber.onWorkStarted(interactions, threadID);
                } catch (error) {
                    // Work thrown by an interaction tracing subscriber should be rethrown,
                    // But only once it's safe (to avoid leaving the scheduler in an invalid state).
                    // Store the error for now and we'll re-throw in finishRendering().
                    if (!hasUnhandledError) {
                        hasUnhandledError = true;
                        unhandledError = error;
                    }
                }
            }
        }
    }

    var prevInteractions = null;
    if (enableSchedulerTracing) {
        // We're about to start new traced work.
        // Restore pending interactions so cascading work triggered during the render phase will be accounted for.
        prevInteractions = tracing.__interactionsRef.current;
        tracing.__interactionsRef.current = root.memoizedInteractions;
    }

    var didFatal = false;

    startWorkLoopTimer(nextUnitOfWork);

    do {
        try {
            workLoop(isYieldy);
        } catch (thrownValue) {
            resetContextDependences();
            resetHooks();

            // Reset in case completion throws.
            // This is only used in DEV and when replaying is on.
            var mayReplay = undefined;
            if (true && replayFailedUnitOfWorkWithInvokeGuardedCallback) {
                mayReplay = mayReplayFailedUnitOfWork;
                mayReplayFailedUnitOfWork = true;
            }

            if (nextUnitOfWork === null) {
                // This is a fatal error.
                didFatal = true;
                onUncaughtError(thrownValue);
            } else {
                if (enableProfilerTimer && nextUnitOfWork.mode & ProfileMode) {
                    // Record the time spent rendering before an error was thrown.
                    // This avoids inaccurate Profiler durations in the case of a suspended render.
                    stopProfilerTimerIfRunningAndRecordDelta(
                        nextUnitOfWork,
                        true
                    );
                }

                // Reset global debug state
                // We assume this is defined in DEV
                resetCurrentlyProcessingQueue();

                if (true && replayFailedUnitOfWorkWithInvokeGuardedCallback) {
                    if (mayReplay) {
                        var failedUnitOfWork = nextUnitOfWork;
                        replayUnitOfWork(
                            failedUnitOfWork,
                            thrownValue,
                            isYieldy
                        );
                    }
                }

                // TODO: we already know this isn't true in some cases.
                // At least this shows a nicer error message until we figure out the cause.
                // https://github.com/facebook/react/issues/12449#issuecomment-386727431
                !(nextUnitOfWork !== null)
                    ? invariant(
                          false,
                          'Failed to replay rendering after an error. This is likely caused by a bug in React. Please file an issue with a reproducing case to help us find it.'
                      )
                    : undefined;

                var sourceFiber = nextUnitOfWork;
                var returnFiber = sourceFiber.return;
                if (returnFiber === null) {
                    // This is the root. The root could capture its own errors. However,
                    // we don't know if it errors before or after we pushed the host
                    // context. This information is needed to avoid a stack mismatch.
                    // Because we're not sure, treat this as a fatal error. We could track
                    // which phase it fails in, but doesn't seem worth it. At least
                    // for now.
                    didFatal = true;
                    onUncaughtError(thrownValue);
                } else {
                    throwException(
                        root,
                        returnFiber,
                        sourceFiber,
                        thrownValue,
                        nextRenderExpirationTime
                    );
                    nextUnitOfWork = completeUnitOfWork(sourceFiber);
                    continue;
                }
            }
        }
        break;
    } while (true);

    if (enableSchedulerTracing) {
        // Traced work is done for now; restore the previous interactions.
        tracing.__interactionsRef.current = prevInteractions;
    }

    // We're done performing work. Time to clean up.
    isWorking = false;
    ReactCurrentDispatcher.current = previousDispatcher;
    resetContextDependences();
    resetHooks();

    // Yield back to main thread.
    if (didFatal) {
        var _didCompleteRoot = false;
        stopWorkLoopTimer(interruptedBy, _didCompleteRoot);
        interruptedBy = null;
        // There was a fatal error.
        {
            resetStackAfterFatalErrorInDev();
        }
        // `nextRoot` points to the in-progress root. A non-null value indicates
        // that we're in the middle of an async render. Set it to null to indicate
        // there's no more work to be done in the current batch.
        nextRoot = null;
        onFatal(root);
        return;
    }

    if (nextUnitOfWork !== null) {
        // There's still remaining async work in this tree, but we ran out of time
        // in the current frame. Yield back to the renderer. Unless we're
        // interrupted by a higher priority update, we'll continue later from where
        // we left off.
        var _didCompleteRoot2 = false;
        stopWorkLoopTimer(interruptedBy, _didCompleteRoot2);
        interruptedBy = null;
        onYield(root);
        return;
    }

    // We completed the whole tree.
    var didCompleteRoot = true;
    stopWorkLoopTimer(interruptedBy, didCompleteRoot);
    var rootWorkInProgress = root.current.alternate;
    !(rootWorkInProgress !== null)
        ? invariant(
              false,
              'Finished root should have a work-in-progress. This error is likely caused by a bug in React. Please file an issue.'
          )
        : undefined;

    // `nextRoot` points to the in-progress root. A non-null value indicates
    // that we're in the middle of an async render. Set it to null to indicate
    // there's no more work to be done in the current batch.
    nextRoot = null;
    interruptedBy = null;

    if (nextRenderDidError) {
        // There was an error
        if (hasLowerPriorityWork(root, expirationTime)) {
            // There's lower priority work. If so, it may have the effect of fixing
            // the exception that was just thrown. Exit without committing. This is
            // similar to a suspend, but without a timeout because we're not waiting
            // for a promise to resolve. React will restart at the lower
            // priority level.
            markSuspendedPriorityLevel(root, expirationTime);
            var suspendedExpirationTime = expirationTime;
            var rootExpirationTime = root.expirationTime;
            onSuspend(
                root,
                rootWorkInProgress,
                suspendedExpirationTime,
                rootExpirationTime,
                -1 // Indicates no timeout
            );
            return;
        } else if (
            // There's no lower priority work, but we're rendering asynchronously.
            // Synchronously attempt to render the same level one more time. This is
            // similar to a suspend, but without a timeout because we're not waiting
            // for a promise to resolve.
            !root.didError &&
            isYieldy
        ) {
            root.didError = true;
            var _suspendedExpirationTime = (root.nextExpirationTimeToWorkOn = expirationTime);
            var _rootExpirationTime = (root.expirationTime = Sync);
            onSuspend(
                root,
                rootWorkInProgress,
                _suspendedExpirationTime,
                _rootExpirationTime,
                -1 // Indicates no timeout
            );
            return;
        }
    }

    if (isYieldy && nextLatestAbsoluteTimeoutMs !== -1) {
        // The tree was suspended.
        var _suspendedExpirationTime2 = expirationTime;
        markSuspendedPriorityLevel(root, _suspendedExpirationTime2);

        // Find the earliest uncommitted expiration time in the tree, including
        // work that is suspended. The timeout threshold cannot be longer than
        // the overall expiration.
        var earliestExpirationTime = findEarliestOutstandingPriorityLevel(
            root,
            expirationTime
        );
        var earliestExpirationTimeMs = expirationTimeToMs(
            earliestExpirationTime
        );
        if (earliestExpirationTimeMs < nextLatestAbsoluteTimeoutMs) {
            nextLatestAbsoluteTimeoutMs = earliestExpirationTimeMs;
        }

        // Subtract the current time from the absolute timeout to get the number
        // of milliseconds until the timeout. In other words, convert an absolute
        // timestamp to a relative time. This is the value that is passed
        // to `setTimeout`.
        var currentTimeMs = expirationTimeToMs(requestCurrentTime());
        var msUntilTimeout = nextLatestAbsoluteTimeoutMs - currentTimeMs;
        msUntilTimeout = msUntilTimeout < 0 ? 0 : msUntilTimeout;

        // TODO: Account for the Just Noticeable Difference

        var _rootExpirationTime2 = root.expirationTime;
        onSuspend(
            root,
            rootWorkInProgress,
            _suspendedExpirationTime2,
            _rootExpirationTime2,
            msUntilTimeout
        );
        return;
    }

    // Ready to commit.
    onComplete(root, rootWorkInProgress, expirationTime);
}
```
