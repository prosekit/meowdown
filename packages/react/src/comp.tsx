import { useState } from 'react'

function MyReactComponent() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <h1>Hello, React!</h1>
      <p>Count: {count}</p>
      <p onClick={() => setCount(count + 1)}>This is a simple React component.</p>
    </div>
  )
}

export { MyReactComponent }
