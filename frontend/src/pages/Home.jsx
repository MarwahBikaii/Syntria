import Hero from "../components/Hero.jsx"
import About from "../components/About.jsx"
import HowitWorks from '../components/HowitWorks.jsx'
import Stats from '../components/Stats.jsx'
import Contactus from "../components/Contactus.jsx"

export default function Home(){
    return(
<div>
      <Hero></Hero>
      <About></About>
      <HowitWorks></HowitWorks>
      <Stats></Stats>
      <Contactus></Contactus>
   
    </div>
    )
}