[createfiberroot]: ./createFiberRoot.md
[reactwork]: ../modules/reactWork.md
[note3]: ../note-3/README.md

### 正文

当我们调用`ReactDOM.render(element, container)`时，React 会基于*container 元素*创建一个 ReactRoot 的实例对象，该对象有一个`render`方法，通过此方法将所有的组件渲染出来。

#### `legacyCreateRootFromDOMContainer(continaer)`

这个函数没啥看的。

1. 开发模式下会做一些校验

2. 通过`new ReactRoot(container, isConcurrent, shouldHydrate)`，创建一个 root 并返回。`isConcurrent`表示使用并发模式，在这里始终为`false`。`shouldHydrate`跟服务端渲染有关，也是`false`。

```javascript
function legacyCreateRootFromDOMContainer(container) {
    var shouldHydrate = false;
    var warned = false;
    var rootSibling = undefined;
    while ((rootSibling = container.lastChild)) {
        {
            if (
                !warned &&
                rootSibling.nodeType === ELEMENT_NODE &&
                rootSibling.hasAttribute(ROOT_ATTRIBUTE_NAME)
            ) {
                warned = true;
                warningWithoutStack(
                    false,
                    'render(): Target node has markup rendered by React, but there ' +
                        'are unrelated nodes as well. This is most commonly caused by ' +
                        'white-space inserted around server-rendered markup.'
                );
            }
        }
        container.removeChild(rootSibling);
    }
    // Legacy roots are not async by default.
    // 非并发
    var isConcurrent = false;
    return new ReactRoot(container, isConcurrent, shouldHydrate);
}
```

#### `new ReactRoot(container, isConcurrent, shouldHydrate)`

root 实例具有的属性及方法如下：

```javascript
function ReactRoot(container, isConcurrent, hydrate) {
    var root = createContainer(container, isConcurrent, hydrate);
    this._internalRoot = root;
}

/**
 * ！！主线更新将调用这个函数
 */
ReactRoot.prototype.render = function(children, callback) {
    var root = this._internalRoot;
    var work = new ReactWork();
    callback = callback === undefined ? null : callback;
    if (callback !== null) {
        work.then(callback);
    }
    updateContainer(children, root, null, work._onCommit);
    return work;
};

ReactRoot.prototype.unmount = function(callback) {
    var root = this._internalRoot;
    var work = new ReactWork();
    callback = callback === undefined ? null : callback;
    if (callback !== null) {
        work.then(callback);
    }
    updateContainer(null, root, null, work._onCommit);
    return work;
};

ReactRoot.prototype.legacy_renderSubtreeIntoContainer = function(
    parentComponent,
    children,
    callback
) {
    var root = this._internalRoot;
    var work = new ReactWork();
    callback = callback === undefined ? null : callback;
    if (callback !== null) {
        work.then(callback);
    }
    updateContainer(children, root, parentComponent, work._onCommit);
    return work;
};

ReactRoot.prototype.createBatch = function() {
    var batch = new ReactBatch(this);
    var expirationTime = batch._expirationTime;

    var internalRoot = this._internalRoot;
    var firstBatch = internalRoot.firstBatch;
    if (firstBatch === null) {
        internalRoot.firstBatch = batch;
        batch._next = null;
    } else {
        // Insert sorted by expiration time then insertion order
        var insertAfter = null;
        var insertBefore = firstBatch;
        while (
            insertBefore !== null &&
            insertBefore._expirationTime >= expirationTime
        ) {
            insertAfter = insertBefore;
            insertBefore = insertBefore._next;
        }
        batch._next = insertBefore;
        if (insertAfter !== null) {
            insertAfter._next = batch;
        }
    }

    return batch;
};
```

先来看构造函数中的 `createContainer` 方法，该方法创建并返回一个 root 对象，并赋值给实例的`_internalRoot`属性。

```javascript
//                                  false         false
function createContainer(container, isConcurrent, hydrate) {
    return createFiberRoot(container, isConcurrent, hydrate);
}
```

`createFiberRoot`见：[ **createFiberRoot** ][createfiberroot]

#### `root.render()`

待创建完 react Root 实例后，后续的主线任务将调用实例的`render`(见上方)方法，进行 dom 渲染。在`root.render`中，首先创建了一个 reactWork 实例。

见：[ **reactWork** ][reactwork]

```javascript
ReactRoot.prototype.render = function(children, callback) {
    var root = this._internalRoot;
    var work = new ReactWork();
    callback = callback === undefined ? null : callback;
    if (callback !== null) {
        work.then(callback);
    }
    //             <App/>
    updateContainer(children, root, null, work._onCommit);
    return work;
};
```

之后调用`updateContainer(children, root, null, work._onCommit)`

见：[ **阅读笔记 3** ][note3]
