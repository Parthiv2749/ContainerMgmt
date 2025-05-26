

import Sidebar from './MenuPanel/Menu';
import ContainerEntry from './Pages/DataEntry/ConatinerEntry';
import LoginPage from './Pages/Login/Login';
import { Routes, Route } from "react-router-dom";
import PrivateRoute from './PrivateRoute';
import Dashboard from './Pages/Dashboard/dashboard';

export default function MainPage() {
  return (
    <div className='flex'>

      
          <Routes>
            <Route path="/" element={<LoginPage />} />

            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Sidebar/>
                  <Dashboard />
                  {/* <ContainerEntry/> */}
                  
                </PrivateRoute>
              }
            />

      {/* <Route path="*" element={<div>404 Not Found</div>} /> */}
    </Routes>
    </div>

  );
}