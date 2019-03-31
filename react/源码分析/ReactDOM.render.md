<!--
 * @Author: LI SHUANG
 * @Email: fitz-i@foxmail.com
 * @Description: ReactDOM.render方法分析
 * @Date: 2019-03-31 17:14:57
 * @LastEditTime: 2019-03-31 17:20:04
 -->
# ReactDOM.render方法分析

### 使用方法

```jsx
//             element     container                   callback
ReactDOM.render(<App/>, document.querySelector('#root'), ()=>{});
```

ReactDOM将container转换成fiberRoot
