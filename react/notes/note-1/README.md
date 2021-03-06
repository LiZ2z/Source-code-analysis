一切始于`ReactDOM.render(element, container, callback)`。此方法在开发环境下会做一些安全校验，然后调用`legacyRenderSubtreeIntoContainer(null, element, container, false, callback)`。

#### `legacyRenderSubtreeIntoContainer(parentComponent, children, container, forceHydrate, callback)`

legacy 遗产？React 的文档上说明：

> 如果我们发现很多应用中必要的模式我们找不到一个完美的 API，我们会提供一个临时欠佳的 API，只要以后可以移除它并且方便后续的优化。

以 legacy 开头的命名可能就是代表这个意思。

这个函数同时被 `ReactDOM.render()` 和 `ReactDOM.unmountComponentAtNode()`调用，当被`ReactDOM.render()`调用时，`element`参数是一个有效的 React 元素，被`ReactDOM.unmountComponentAtNode()`调用时`element`参数的值为`null`。

1. (TODO: 仔细看)校验参数 container， `topLevelUpdateWarnings(container)`会对 container 进行校验, 例如是否在未使用 React api 情况下删除了 React 节点中的内容、不能用`ReactDOM.render`向已有 react 组件的节点中渲染内容、container 不能是 document.body

2. 判断 `container._reactRootContainer`（**root**） 存不存在? 如果不存在 ，
   则通过`legacyCreateRootFromDOMContainer(continaer)`函数创建一个 root，并赋值给 `container._reactRootContainer`。如果存在，就继续向下执行。

3. 根据之前判断的`container._reactRootContainer`存在与否，这里采用不同的更新方式(Update)， 如果不存在，则使用`unbatchedUpdates`方式进行更新，否则直接更新。更新就是调用`root.render()`方法。

```javascript
function legacyRenderSubtreeIntoContainer(
    parentComponent,
    children,
    container,
    forceHydrate,
    callback
) {
    // 对container 元素做一些检测，例如不能是 document.body 、不能已经作为container被使用过
    topLevelUpdateWarnings(container);

    // member of intersection type." Whyyyyyy.
    var root = container._reactRootContainer;
    if (!root) {
        root = container._reactRootContainer = legacyCreateRootFromDOMContainer(
            container,
            forceHydrate
        );

        if (typeof callback === 'function') {
            var originalCallback = callback;
            callback = function() {
                var instance = getPublicRootInstance(root._internalRoot);
                originalCallback.call(instance);
            };
        }

        // Initial mount should not be batched.
        unbatchedUpdates(function() {
            if (parentComponent != null) {
                root.legacy_renderSubtreeIntoContainer(
                    parentComponent,
                    children,
                    callback
                );
            } else {
                root.render(children, callback);
            }
        });
    } else {
        if (typeof callback === 'function') {
            var originalCallback = callback;
            callback = function() {
                var instance = getPublicRootInstance(root._internalRoot);
                originalCallback.call(instance);
            };
        }
        // Update
        if (parentComponent != null) {
            root.legacy_renderSubtreeIntoContainer(
                parentComponent,
                children,
                callback
            );
        } else {
            root.render(children, callback);
        }
    }
    return getPublicRootInstance(root._internalRoot);
}
```

[**阅读笔记 2**](../note-2/README.md)
