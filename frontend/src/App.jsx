import './App.css'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import "bootstrap-icons/font/bootstrap-icons.css"
import Header from './components/Header.jsx';
import Footer from "./components/Footer.jsx"
import Home from "./pages/Home.jsx"
import Login from "./components/auth/Login.jsx"
import Register from './components/auth/Register.jsx';
import UserHome from './pages/User/UserHome.jsx'
import Profile from "./pages/User/Profile.jsx"
import Volunteer from "./pages/User/Volunteer.jsx"
import Report from "./pages/User/Report.jsx"
function App() {
  return (
    <BrowserRouter>
    <Header></Header>
     <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/Register" element={<Register />} />
        <Route path="/Home" element={<UserHome />} />

        <Route path="/profile" element={<Profile />} />
        <Route path="/volunteer/activate" element={<Volunteer />} />
        <Route path="/report" element={<Report />} />


      </Routes>
      <Footer></Footer>
    </BrowserRouter>
  );
}

export default App
