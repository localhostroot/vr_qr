import '../App.css'
import AppRouter from "../app/providers/AppRouter/AppRouter.jsx";
import {FixedNavigation} from "../widgets/FixedNavigation/index.js";
import {Footer} from "../widgets/Footer/index.js";
import {useDispatch} from "react-redux";
import {useEffect} from "react";
import {setClients} from "../shared/reducers/clientsReducer.js";
import useWebSocket from "../features/hooks/useWebSocket.js";
import usePaymentStatus from "@/features/hooks/usePaymentStatus.js";

function App() {
    const dispatch = useDispatch();
    const databaseApi = import.meta.env.VITE_REACT_APP_DATABASE;
    const statApi = import.meta.env.VITE_REACT_APP_STAT;
    const api = import.meta.env.VITE_REACT_APP_BACKEND;

    const { checkPaymentStatus, isLoading, error } = usePaymentStatus(databaseApi, statApi);

    useEffect(() => {
        checkPaymentStatus();
    }, [checkPaymentStatus]);

    const { clients, socket } = useWebSocket(api, 'getVr');

    useEffect(() => {
        if (clients && clients.length > 0) {
            dispatch(setClients(clients));
        }
    }, [clients, dispatch]);

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
