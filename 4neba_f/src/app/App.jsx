import '../App.css'
import AppRouter from "../app/providers/AppRouter/AppRouter.jsx";
import {Footer} from "../widgets/Footer/index.js";
import useWebSocket from "../features/hooks/useWebSocket.js";
import {FixedNavigation} from "../widgets/FixedNavigation/index.js";

function App() {
    const api = import.meta.env.VITE_REACT_APP_BACKEND;

    const { socket } = useWebSocket(api, 'getVr');

  return (
    <div className="App">
      <div className="content-wrapper">
        <AppRouter/>
      </div>
        <FixedNavigation/>
        <Footer/>
    </div>
  )
}

export default App
