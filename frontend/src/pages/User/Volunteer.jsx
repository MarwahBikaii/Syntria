
import axios from "axios"
import { useState } from "react"
import Swal from "sweetalert2"

export default function Volunteer(){

const [formData, setFormData]=useState({
  qualifications
:[], skills:[],serviceAreas:[]
})

//pick skills

//add qualifications

//pick service area from the country of the user

//may add availability time

const skillOptions = [
  "First Aid",
  "Event Coordination",
  "Project Management",
  "Communication",
  "Teaching",
  "Translation",
  "Driving",
  "IT Support",
];

const qualificationOptions = [
  "High School Diploma",
  "University Student",
  "Bachelor's Degree",
  "Master's Degree",
  "First Aid Certificate",
  "Professional Certification",
];

const serviceAreaOptions = [
  "Education",
  "Healthcare",
  "Environment",
  "Community Support",
  "Emergency Response",
  "Youth Development",
  "Food Assistance",
  "Logistics",
];



const handleChangeCheckbox = (event)=>{
    const {name, value,checked}= event.target
    setFormData(

        (prevData)=>({
            ...prevData,
            // if skill exists,
            
            [name]:checked?
            
         
            [...prevData[name],value]:
                       //filter array , get data from specific condition
            prevData[name].filter(
                item=>item!==value
            )
        })
    )

}




const  handleVolunteer= async (event)=>{
    event.preventDefault();

    try{

        const res= await axios.put("http://localhost:3001/api/users/me/volunteer-profile",
         
            { 
            skills:formData.skills,
            qualifications: formData.qualifications,
            serviceAreas: formData.serviceAreas
    },{
    withCredentials:                true,
  })

  Swal.fire({
    title: "Your volunteer profile has been activated!",
    text: "Welcome to the volunteering community",
    icon: "success"
  });
  navigation.navigate('/Home')

    }catch(error){
        console.log(error)
             Swal.fire({
          title: "Cannot activate volunteer profile",
          text: "Recheck your input",
          icon: "error"
        })
    }
}
return(

   <form onSubmit={handleVolunteer}>
<div className="hero bg-base-200 min-h-screen">
  <div className="hero-content flex flex-col">
    <div className="text-center">
      <h1 className="text-6xl font-bold">Become a volunteer</h1>
      <p className="py-6">
        Start making an impact with Syntria by being a volunteer!
      </p>
    </div>
    <div className="card bg-base-100 w-full shrink-0 shadow-2xl">
      <div className="card-body">

<details className="dropdown">
  <summary className="btn m-1">Pick Skills</summary>
  <ul className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
{skillOptions.map((item) => {
  return (
    <li key={item}>
      <label className="label cursor-pointer">
        <span className="label-text">
          {item}
        </span>

        <input
          type="checkbox"
          value={item}
          className="checkbox checkbox-primary"
          name="skills"
          checked={formData.skills.includes(item)}
          onChange={handleChangeCheckbox}
        />
      </label>
    </li>
  );
})}
  </ul>
</details>

{/**dynamic skills rendering, to display belo input */}
{formData.skills.map((item) => (
  <div
    key={item}
    className="badge badge-success"
  >
    {item}
  </div>
))}


<details className="dropdown">
  <summary className="btn m-1">Pick Qualifications</summary>
  <ul className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
{qualificationOptions.map((item) => {
  return (
    <li key={item}>
      <label className="label cursor-pointer">
        <span className="label-text">
          {item}
        </span>

        <input
          type="checkbox"
          value={item}
          className="checkbox checkbox-primary"
          name="qualifications"
          checked={formData.qualifications.includes(item)}
          onChange={handleChangeCheckbox}
        />
      </label>
    </li>
  );
})}
  </ul>
</details>

{/**dynamic skills rendering, to display belo input */}
{formData.qualifications.map((item) => (
  <div
    key={item}
    className="badge badge-accent"
  >
    {item}
  </div>
))}


<details className="dropdown">
  <summary className="btn m-1">Pick Area of Service</summary>
  <ul className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
{serviceAreaOptions.map((item) => {
  return (
    <li key={item}>
      <label className="label cursor-pointer">
        <span className="label-text">
          {item}
        </span>

        <input
          type="checkbox"
          value={item}
          className="checkbox checkbox-primary"
          name="serviceAreas"
          checked={formData.serviceAreas.includes(item)}
          onChange={handleChangeCheckbox}
        />
      </label>
    </li>
  );
})}
  </ul>
</details>

{/**dynamic skills rendering, to display belo input */}
{formData.serviceAreas.map((item) => (
  <div
    key={item}
    className="badge badge-error"
  >
    {item}
  </div>
))}



    
        

  <button className="btn btn-neutral join-item">Submit</button>
</div>

      </div>
    </div>
  </div>
</form>
)
}