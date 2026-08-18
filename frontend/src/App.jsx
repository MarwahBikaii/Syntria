import './App.css'
import "bootstrap-icons/font/bootstrap-icons.css"
import Header from "./components/Header.jsx"
import Hero from "./components/Hero.jsx"
import About from "./components/About.jsx"
import HowitWorks from './components/HowitWorks.jsx'
import Footer from './components/Footer.jsx'
import Stats from './components/Stats.jsx'
import Contactus from "./components/Contactus.jsx"
function App() {
  return (
    <div>
      <Header></Header>
      <Hero></Hero>
      <About></About>
      <HowitWorks></HowitWorks>
      <Stats></Stats>
      <Contactus></Contactus>
      <Footer></Footer>
    </div>
  );
}

export default App
