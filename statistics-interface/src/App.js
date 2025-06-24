import './App.css';
import {Route, Routes} from "react-router-dom";
import {AuthPage} from "./pages/AuthPage/AuthPage";
import {StatsPage} from "./pages/StatsPage/StatsPage";
import PrivateRoute from "./utils/privateRoute";

function App() {
  return (
    <div className="App">
      <div className="appWrapper">
        <Routes>
            <Route path="/" element={<AuthPage />} />
            <Route path="/stats" element={<PrivateRoute> <StatsPage/> </PrivateRoute>} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
