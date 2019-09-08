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
        !isWorking ||
        isCommitting ||
        // ...unless this is a different root than the one we're rendering.
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
