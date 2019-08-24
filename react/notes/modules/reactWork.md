#### reactWork

ReactWork 可以理解为负责回调函数管理的状态机（就是有状态的东西），有个过渡状态跟结束状态，其状态由内部的`_didCommit`属性控制，`_didCommit`只能从`false`变为`true`。

ReactWork 通过`.then`方法注册回调，然后将所有的回调保存在内部的数组中。通过`._onCommit`方法执行所有已注册的回调函数，同时将内部状态`_didCommit`从`false`变为`true`，该方法只能调用一次。当内部状态`_didCommit`为`true`后，后续通过`.then`方法注册的函数会被立即执行，不会再保存在内部的数组中。

```javascript
/**
 * 通过 work._didCommit 管理状态
 * 通过 work.then() 注册回调函数
 * 通过 work._onCommit 触发回调并修改状态
 * work内部有一个状态，didCommit 代表是否触发了 _onCommit 事件
 * 如果没有触发_onCommit 事件， 则通过work.then注册的事件都将被保存在 work._callbacks 这个数组中
 * 当调用 _onCommit 函数时，执行所有work._callbacks中的回调函数
 * 如果已触发_onCommit函数，则后续通过 work.then 注册的函数将立即执行
 * _onCommit 函数只能执行一次
 */
function ReactWork() {
    this._callbacks = null;
    this._didCommit = false;
    // TODO: Avoid need to bind by replacing callbacks in the update queue with
    // list of Work objects.
    this._onCommit = this._onCommit.bind(this);
}
ReactWork.prototype.then = function(onCommit) {
    if (this._didCommit) {
        onCommit();
        return;
    }
    var callbacks = this._callbacks;
    if (callbacks === null) {
        callbacks = this._callbacks = [];
    }
    callbacks.push(onCommit);
};
ReactWork.prototype._onCommit = function() {
    if (this._didCommit) {
        return;
    }
    this._didCommit = true;
    var callbacks = this._callbacks;
    if (callbacks === null) {
        return;
    }
    // TODO: Error handling.
    for (var i = 0; i < callbacks.length; i++) {
        var _callback2 = callbacks[i];
        !(typeof _callback2 === 'function')
            ? invariant(
                  false,
                  'Invalid argument passed as callback. Expected a function. Instead received: %s',
                  _callback2
              )
            : undefined;
        _callback2();
    }
};
```
