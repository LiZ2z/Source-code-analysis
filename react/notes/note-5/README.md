# 主线，`scheduleWork(fiber, expirationTime)`

```javascript
function scheduleWork(fiber, expirationTime) {
    var root = scheduleWorkToRoot(fiber, expirationTime);

    if (root === null) {
        switch (fiber.tag) {
            case ClassComponent:
                warnAboutUpdateOnUnmounted(fiber, true);
                break;
            case FunctionComponent:
            case ForwardRef:
            case MemoComponent:
            case SimpleMemoComponent:
                warnAboutUpdateOnUnmounted(fiber, false);
                break;
        }
        return;
    }

    // 不懂这里
    if (
        !isWorking &&
        nextRenderExpirationTime !== NoWork &&
        expirationTime > nextRenderExpirationTime
    ) {
        // This is an interruption. (Used for performance tracking.)
        interruptedBy = fiber;
        resetStack();
    }

    markPendingPriorityLevel(root, expirationTime);

    if (
        // If we're in the render phase, we don't need to schedule this root
        // for an update, because we'll do it before we exit...
        // 如果在render阶段，我们不需要schedule这个root 的update，
        // 因为我们将会在退出之前做
        !isWorking ||
        isCommitting ||
        // ...unless this is a different root than the one we're rendering.
        // 除非，这是另一个root
        nextRoot !== root
    ) {
        var rootExpirationTime = root.expirationTime;
        requestWork(root, rootExpirationTime);
    }

    if (nestedUpdateCount > NESTED_UPDATE_LIMIT) {
        // Reset this back to zero so subsequent updates don't throw.
        nestedUpdateCount = 0;
        invariant(
            false,
            'Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.'
        );
    }
}
```

## 支线，`scheduleWorkToRoot(fiber, expirationTime)`

```javascript
function scheduleWorkToRoot(fiber, expirationTime) {
    recordScheduleUpdate();

    if (fiber.tag === ClassComponent) {
        // 警告⚠
        var instance = fiber.stateNode;
        warnAboutInvalidUpdates(instance);
    }

    // Update the source fiber's expiration time
    // 更新fiber的 过期时间
    if (fiber.expirationTime < expirationTime) {
        fiber.expirationTime = expirationTime;
    }
    var alternate = fiber.alternate;
    if (alternate !== null && alternate.expirationTime < expirationTime) {
        alternate.expirationTime = expirationTime;
    }
    // Walk the parent path to the root and update the child expiration time.
    // 遍历parent路径到root fiber 并更新childExpirationTime过期时间。
    var node = fiber.return;
    var root = null;
    if (node === null && fiber.tag === HostRoot) {
        root = fiber.stateNode;
    } else {
        while (node !== null) {
            alternate = node.alternate;
            if (node.childExpirationTime < expirationTime) {
                node.childExpirationTime = expirationTime;
            }

            if (
                alternate !== null &&
                alternate.childExpirationTime < expirationTime
            ) {
                alternate.childExpirationTime = expirationTime;
            }

            if (node.return === null && node.tag === HostRoot) {
                root = node.stateNode;
                break;
            }
            node = node.return;
        }
    }

    if (root !== null) {
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // 看不懂       看不懂
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // 存储一个  new Set()
        var interactions = tracing.__interactionsRef.current;
        if (interactions.size > 0) {
            var pendingInteractionMap = root.pendingInteractionMap;
            var pendingInteractions = pendingInteractionMap.get(expirationTime);
            if (pendingInteractions != null) {
                interactions.forEach(function(interaction) {
                    if (!pendingInteractions.has(interaction)) {
                        // Update the pending async work count for previously unscheduled interaction.
                        interaction.__count++;
                    }

                    pendingInteractions.add(interaction);
                });
            } else {
                pendingInteractionMap.set(
                    expirationTime,
                    new Set(interactions)
                );

                // Update the pending async work count for the current interactions.
                interactions.forEach(function(interaction) {
                    interaction.__count++;
                });
            }

            var subscriber = tracing.__subscriberRef.current;
            if (subscriber !== null) {
                var threadID = computeThreadID(
                    expirationTime,
                    root.interactionThreadID
                );
                subscriber.onWorkScheduled(interactions, threadID);
            }
        }
    }
    return root;
}
```

## 支线，`recordScheduleUpdate`

```javascript
function recordScheduleUpdate() {
    if (isCommitting) {
        hasScheduledUpdateInCurrentCommit = true;
    }
    if (
        currentPhase !== null &&
        currentPhase !== 'componentWillMount' &&
        currentPhase !== 'componentWillReceiveProps'
    ) {
        hasScheduledUpdateInCurrentPhase = true;
    }
}
```

## 支线，`markPendingPriorityLevel(root, expirationTime)`

```javascript
// TODO: Offscreen updates should never suspend. However, a promise that
// suspended inside an offscreen subtree should be able to ping at the priority
// of the outer render.
function markPendingPriorityLevel(root, expirationTime) {
    // If there's a gap between completing a failed root and retrying it,
    // additional updates may be scheduled. Clear `didError`, in case the update
    // is sufficient to fix the error.
    root.didError = false;

    // Update the latest and earliest pending times
    var earliestPendingTime = root.earliestPendingTime;
    if (earliestPendingTime === NoWork) {
        // No other pending updates.
        root.earliestPendingTime = root.latestPendingTime = expirationTime;
    } else {
        if (earliestPendingTime < expirationTime) {
            // This is the earliest pending update.
            root.earliestPendingTime = expirationTime;
        } else {
            var latestPendingTime = root.latestPendingTime;
            if (latestPendingTime > expirationTime) {
                // This is the latest pending update
                root.latestPendingTime = expirationTime;
            }
        }
    }
    findNextExpirationTimeToWorkOn(expirationTime, root);
}
```

## 支线，`findNextExpirationTimeToWorkOn(completedExpirationTime, root)`

```javascript
function findNextExpirationTimeToWorkOn(completedExpirationTime, root) {
    var earliestSuspendedTime = root.earliestSuspendedTime;
    var latestSuspendedTime = root.latestSuspendedTime;
    var earliestPendingTime = root.earliestPendingTime;
    var latestPingedTime = root.latestPingedTime;

    // Work on the earliest pending time. Failing that, work on the latest
    // pinged time.
    var nextExpirationTimeToWorkOn =
        earliestPendingTime !== NoWork ? earliestPendingTime : latestPingedTime;

    // If there is no pending or pinged work, check if there's suspended work
    // that's lower priority than what we just completed.
    if (
        nextExpirationTimeToWorkOn === NoWork &&
        (completedExpirationTime === NoWork ||
            latestSuspendedTime < completedExpirationTime)
    ) {
        // The lowest priority suspended work is the work most likely to be
        // committed next. Let's start rendering it again, so that if it times out,
        // it's ready to commit.
        nextExpirationTimeToWorkOn = latestSuspendedTime;
    }

    var expirationTime = nextExpirationTimeToWorkOn;
    if (expirationTime !== NoWork && earliestSuspendedTime > expirationTime) {
        // Expire using the earliest known expiration time.
        expirationTime = earliestSuspendedTime;
    }

    root.nextExpirationTimeToWorkOn = nextExpirationTimeToWorkOn;
    root.expirationTime = expirationTime;
}
```
