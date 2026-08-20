import axios from "axios"
import { useState, useEffect } from "react"
import Swal from "sweetalert2"
  
//add organizations check

export default function Register(){


const [userLocation, setUserLocation] = useState([]);



//multiple inputs in a single state in this case
const [formData, setFormData]=useState({
  firstname:"", lastname:"",email:"", password:"", confirmpassword:"",
  phone:"", accountType:"community_member",organizationId:""
})
const [locationfields,setLocationFields]=useState({
  country:"", address:""
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

const handleLocationFieldsChange=(event)=>{

  const { name, value } = event.target;


 setLocationFields( (prevData) => ({
...prevData,
     [name]:value})

  )
}

const findcoordinates=()=>{

  //triggered by button to allow location
 if (!navigator.geolocation){
   console.error('Geolocation is not supported by this browser.');
   return;
  }

  //get longitude, latitude
  const navigation= navigator.geolocation;
  const currentlocation= navigation.getCurrentPosition(
    (position)=>{
      const {longitude,latitude}= position.coords
      //save to useState
      setUserLocation([longitude,latitude])
    }

  )
   console.log(userLocation)

  
  //pass to backend request
}

const handleRegister = (event)=>
    {
        event.preventDefault();
        //get data from form, destructure from event.target object
        console.log("Register in now!!")
        console.log(formData)
        console.log(locationfields)
        console.log(userLocation)
        //send using axios to /auth/login
        const res= axios.post('http://localhost:3001/api/auth/signup',
          { 
            firstName: formData.firstname,
            lastName:formData.lastname,
            phone:formData.phone,
            accountType: formData.accountType,
            password:formData.password,
            organizationId:formData.organizationId,
            passwordConfirm:formData.confirmpassword,
            email: formData.email, password:formData.password,
            location:{
            country: locationfields.country,
            address:locationfields.address,
            coordinates:{
              coordinates: userLocation
            }
            }
          }
          ,{
    withCredentials: true,
  }

        ).then((res)=>{
          console.log(res)
      Swal.fire({
  title: "You're Signed up!",
  text: "Welcome to Syntria",
  icon: "success"
});
        })

      .catch ( (err)=>{
       console.log(res)

        Swal.fire({
  title: "Cannot Sign up",
  text: "Recheck your credentials",
  icon: "error"
})
    })
      }

    return(
        //login form
<form onSubmit={handleRegister}>
<div className="hero bg-base-200 min-h-screen p-7">
  <div className="hero-content  flex flex-col">
    <div className="text-center mr-6">
      <h1 className="text-6xl font-bold text-[#c44b0e]">Register now!</h1>
      <p className="py-6">
        Start making an impact with Syntria
      </p>
    </div>
    <div className="card bg-base-100 w-full shrink-0 shadow-2xl">
      <div className="card-body">
        <fieldset className="fieldset">

         <label className="label">First Name</label>
          <input type="text" className="input w-full mb-3" placeholder="First Name" name="firstname" onChange={handleChange} value={formData.firstname}/>        
         
          <label className="label">Last Name</label>
          <input type="text" className="input w-full mb-3" placeholder="Last Name" name="lastname" onChange={handleChange} value={formData.lastname}/>        

          
          <label className="label">Email</label>
          <input type="email" className="input w-full mb-3" placeholder="Email" name="email" onChange={handleChange} value={formData.email}/>
          
     
          <label className="label">Password</label>
          <input type="password" className="input w-full mb-3" name="password" placeholder="Password" onChange={handleChange} value={formData.password}/>

          <label className="label">Confirm Password</label>
          <input type="password" className="input w-full mb-3" name="confirmpassword" placeholder="Password" onChange={handleChange} value={formData.confirmpassword}/>
   

           <label className="label w-full">Phone</label>
           <input type="number" className="input mb-3 w-full" name="phone" placeholder="Phone" onChange={handleChange} value={formData.phone}/>

          
       
         {/**if not member add organization id */}
<div className="flex gap-7 mb-3">

  <label className="label mr-2">
    <input
      type="radio"
      className="radio radio-warning"
      name="accountType"
      value="community_member"
      onChange={handleChange}
      checked={
        formData.accountType === "community_member"
      }
    />
    Community Member
  </label>

  <label className="label mr-2">
    <input
      type="radio"
      className="radio radio-warning"
      name="accountType"
      value="community_organization"
      onChange={handleChange}
      checked={
        formData.accountType ===
        "community_organization"
      }
    />
    Community Organization
  </label>

  <label className="label mr-2">
    <input
      type="radio"
      className="radio radio-warning"
      name="accountType"
      value="resource_partner"
      onChange={handleChange}
      checked={
        formData.accountType === "resource_partner"
      }
    />
    Resource Partner
  </label>

</div>
          {/**go over user roles name as the backend field , and value as enum, backend field values , but for the user show clean names**/}
         
         {/**if org show input org id */}
         {
           
           (formData.accountType === "community_organization" ||
   
           formData.accountType === "resource_partner") &&(
            <div>
          <label className="label w-full">Organization ID</label>
           <input type="text" className="input mb-3 w-full" name="organizationId" placeholder="organizationId" onChange={handleChange} value={formData.organizationId} required/>
          </div>)
            }
         
    <fieldset className="fieldset">
  <label className="label">Country</label>
          <input type="text" className="input w-full mb-3" placeholder="Country" name="country" onChange={handleLocationFieldsChange} value={locationfields.country} required/>        
         
          <label className="label">Address</label>
          <input type="text" className="input w-full mb-3" placeholder="Address" name="address" onChange={handleLocationFieldsChange} value={locationfields.address} required/>        


      </fieldset>

          
          <button type="button" className="btn btn-neutral mt-4 mb-4 bg-[#c44b0e]" onClick={findcoordinates}>Find my location</button>

          <button className="btn btn-neutral mt-4 mb-4" type="submit">Register</button>
        </fieldset>
      </div>
    </div>
  </div>
</div></form>
    )
}