import logo from './logo.svg';
import './App.css';
import { AuthProvider } from './context/AuthContext';
import MainPage from './component/MainPage';
import { BrowserRouter } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
       <MainPage/>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
