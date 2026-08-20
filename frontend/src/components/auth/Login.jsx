import axios from "axios"
import { useState } from "react"
import Swal from "sweetalert2"

  


export default function Login(){

//multiple inputs in a single state in this case
const [formData, setFormData]=useState({
  email:"", password:""
})

const handleChange = (event) => {
  //get name and value of the input targetted
  //email change=> name="email", value=initial state
  //email changes again => name="email" , value=most recent state (value in the input)
  //same for password
  const { name, value } = event.target;

  //set form data //now for email
  //prevData => old values, don't erase
  //dynamically access name and set it to the value in the input

  setFormData((prevData) => ({
    ...prevData,
    [name]: value,
  }));
  // (x)=>{...x} return object, get previous values
  //update only targetted input value
  //if key exists update
  //if key does not exist create and save
};

const handleLogin = (event)=>
    {
        event.preventDefault();
        //get data from form, destructure from event.target object
        console.log("log in now!!")
        console.log(formData)
        //send using axios to /auth/login
        const res= axios.post('http://localhost:3001/api/auth/login',
          { email: formData.email, password:formData.password}
          ,{
    withCredentials: true,
  }

        ).then((res)=>{
          console.log(res)
      Swal.fire({
  title: "You're logged in!",
  text: "Welcome back",
  icon: "success"
});
localStorage.setItem("isLoggedin", true)
navigation.navigate('/Home')
        })

      .catch ( (err)=>{
       console.log(res)

        Swal.fire({
  title: "Cannot log in",
  text: "Recheck your credentials",
  icon: "error"
})
    })
      }

    return(
        //login form
<form onSubmit={handleLogin}>
<div className="hero bg-base-200 min-h-screen">
  <div className="hero-content flex flex-col">
    <div className="text-center">
      <h1 className="text-6xl font-bold">Login now!</h1>
      <p className="py-6">
        Start making an impact with Syntria
      </p>
    </div>
    <div className="card bg-base-100 w-full shrink-0 shadow-2xl">
      <div className="card-body">
        <fieldset className="fieldset">
          <label className="label">Email</label>
          <input type="email" className="input" placeholder="Email" name="email" onChange={handleChange} value={formData.email}/>
          <label className="label">Password</label>
          <input type="password" className="input" name="password" placeholder="Password" onChange={handleChange} value={formData.password}/>
          <div><a className="link link-hover">Forgot password?</a></div>
         <div><a className="link font-bold link-hover text-[#c44b0e]">Don't have an account?</a></div>

          <button className="btn btn-neutral mt-4" type="submit">Login</button>
        </fieldset>
      </div>
    </div>
  </div>
</div></form>
    )
}