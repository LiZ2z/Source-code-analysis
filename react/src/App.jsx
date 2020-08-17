import React, { useEffect, useState } from 'react';

const App = () => {
    const [num, setNum] = useState(1);

    useEffect(() => {
        setInterval(() => {
            setNum((prev) => prev + 1);
        }, 1000);
    }, []);

    return <div>{num}</div>;
};

export default React.memo(App);
