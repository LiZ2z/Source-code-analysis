import React, { Component } from './react';

class App extends Component {
    state = {
        num: 1
    }
    componentDidMount(){
        setInterval(()=>{
            this.setState({
                num: this.state.num+1
            })
        },2000)
    }
  render() {
    return (
      <div className="App">
        <h1>
         {this.state.num}
        </h1>
      </div>
    );
  }
}

export default App;
