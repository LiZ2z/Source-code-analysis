
## `ReactDOM.render(<App/>, document.querySelector('#root'))` 调用栈


1. `legacyRenderSubtreeIntoContainer` 将虚拟节点渲染到 真实的 dom节点中
    1. `legacyCreateRootFromDOMContainer` 返回ReactRoot
        1. 前置工作
        2. `new ReactRoot(container, isConcurrent, shouldHydrate)`
            1. 创建一个实例有 `render`、`unmount`、`createBatch`等方法
            2. `createContainer` > `createFiberRoot` 创建一个root对象
                1. `createHostRootFiber` 
                    1. 计算Fiber的mode (暂时没懂)
                    2. `createFiber` > `new FiberNode` 生成一个FiberNode实例 （uninitializedFiber）
                2. 创建一个`root`对象， 将FiberNode实例赋值给`root`对象的`current`属性
                3. `uninitializedFiber.stateNode = root`
                4. 返回`root`
            3. 将root对象赋值给实例的`_internalRoot`属性
    2. `unbatchedUpdates` > `root.render()`
        1. `new ReactWork()` 创建一个 ReactWork实例，有`then`、`_onCommit`方法
        2.  `updateContainer`
            1. `requestCurrentTime` （这个地方暂时没懂 关于 renderer time 和 scheduler time ）
                1. `findHighestPriorityRoot`
                2. `recomputeCurrentRendererTime`
                    当前 Render timer：总过期时间 减去 从React开始执行到现在花费的时间
                    1. `msToExpirationTime`
                    说明：React将10ms视为自身的一个单位过期时间。当打开一个react项目时，该React的总过期时间为 在32位系统的 V8 中的最大的31位整数：`Math.pow(2, 30) - 1`(0b111111111111111111111111111111)（约127天）。

            2. `computeExpirationForFiber`
            
            3. `updateContainerAtExpirationTime`

    3. `getPublicRootInstance(root._internalRoot)`


