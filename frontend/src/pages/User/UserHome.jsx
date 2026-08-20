import { use } from "react"
import {getUser} from "../../context/auth.js"
import { useState,useEffect } from "react"

export default function UserHome(){

    // const user=  getUser();
    //returns promise
    const [user, setUser]= useState({})
    //if no user logged in don't let them enter

    //fetching data=> affecting the component: useEffect()
    useEffect(
        ()=>{ //callback function, dont use async function directly
            //runs on every render

            const fetchuser= async ()=>{
            const user= await getUser()                
            setUser(user)
            console.log(user)
            };

            fetchuser();

            

        },[] //dependency array (triggers the useeffect action) // [] render always
    )//[user]=> infinite loop


    return(
        <div className="hero bg-base-200 min-h-screen">
  <div className="hero-content text-center">
    <div className="max-w-md">
      <h1 className="text-5xl font-bold">Hello {user.firstName}</h1>
      <p className="py-6">
        Take a step forward for a better community.
      </p>
      <button className="btn btn-primary">Report issue</button>
    </div>
  </div>
</div>
    )
}