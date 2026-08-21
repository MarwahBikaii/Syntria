import axios from "axios"
import { useState ,useEffect} from "react"
import Swal from "sweetalert2"
import {getUser} from "../../context/auth"
import {getOrganizations} from "../../context/organizations"
import { Link } from "react-router-dom";
  
export default function Report(){

  const [user, setUser] = useState(null);
const [municipalities, setMunicipalities] = useState([]);
    

  const [formData, setFormData]=useState({
   title:"",description:"",category:"", priority:"" , 
     location: {
    country: "Lebanon",
    district: "",
    address: "",

    coordinates: {
      type: "Point",
      coordinates: [],
    },
  },
   municipality:"",
   tags:[]

})

 useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await getUser();

        setUser(user);
      } catch (error) {
        console.error(
          "Failed to fetch logged in user:",
          error.response?.data
        );

        
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

useEffect(() => {
  const fetchMunicipalities = async () => {
    try {
      const organizations =
        await getOrganizations();

    //filter=> get what you want
      const municipalityOrganizations =
        organizations.filter(
        (  (organization) =>
            organization.organizationType ===
            "municipality"
        ))

      setMunicipalities(
        municipalityOrganizations
      );

    } catch (error) {
      console.error(error);
    }
  };

  fetchMunicipalities();
}, []);

const priority=[
    "low", "medium", "high", "critical"
]
const districts = [

  "Beirut",


  "Akkar",


  "Tripoli",
  "Miniyeh-Danniyeh",
  "Zgharta",
  "Bsharri",
  "Koura",
  "Batroun",


  "Baabda",
  "Aley",
  "Chouf",
  "Matn",
  "Keserwan",
  "Jbeil",


  "Zahle",
  "Western Beqaa",
  "Rashaya",


  "Baalbek",
  "Hermel",

 
  "Sidon",
  "Tyre",
  "Jezzine",

 
  "Nabatieh",
  "Bint Jbeil",
  "Marjayoun",
  "Hasbaya",
];

const tags = [
  "Education",
  "Healthcare",
  "Environment",
  "Emergency Response",
  "Community Support",
  "Youth",
  "Elderly",
  "Disability Support",
  "Food Assistance",
  "Infrastructure",
  "Public Spaces",
  "Technology",
  "Awareness",
  "Volunteering",
  "Logistics",
];
const priorityBadge = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "success",
};
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
            console.log(formData)


}

    const handleLocationChange = (event)=>{
    const {name, value}= event.target

    console.log(name)
    console.log(value)
    setFormData(

        (prevData)=>({
            ...prevData,
           //kep prev data other than location
           
          location:
{
            ...prevData.location, //keep location prev data
            [name]:value //change only district
}
    }
)
        )
        console.log(formData)

}

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

   console.log(formData)

  // (x)=>{...x} return object, get previous values
  //update only targetted input value
  //if key exists update
  //if key does not exist create and save
};



const handleReport = (event)=>
    {
        event.preventDefault();
        //get data from form, destructure from event.target object
    
        const res= axios.post('http://localhost:3001/api/issues',
          { 
            title:formData.title,
            description:formData.description,
            category:formData.category,
            location:formData.location,
            createdBy:user._id,
            tags:formData.tags,
            municipality:formData.municipality


          }
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
      const handleChangeRadio = (event) => {
  const { name, value } = event.target;

  setFormData((prevData) => ({
    ...prevData,
    [name]: value,
  }));
};
      //inpu title , description, location
return( 
<form onSubmit={handleReport}>
<div className="hero bg-base-200 min-h-screen">
  <div className="hero-content flex flex-col">
    <div className="text-center">
      <h1 className="text-6xl font-bold">Take a step further for a better community</h1>
      <p className="py-6">
        Report an issue
      </p>
    </div>
    <div className="card bg-base-100 w-full shrink-0 shadow-2xl">
      <div className="card-body">
        <fieldset className="fieldset">
          <label className="label">Title</label>
          <input type="text" className="input" placeholder="Title" name="title" onChange={handleChange} value={formData.title}/>
          <label className="label">Description</label>
          <input type="text" className="input" name="description" placeholder="Description" onChange={handleChange} value={formData.description}/>

<label className="label">Location</label>
<input type="text" className="input" name="address" placeholder="Address" onChange={handleLocationChange} value={formData.location.address}/>

<details className="dropdown">
  <summary className="btn m-1">Pick District</summary>
  <ul className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
{districts.map((item) => {
  return (
    <li key={item}>
      <label className="label cursor-pointer">
        <span className="label-text">
          {item}
        </span>

        <input
          type="radio"
          value={item}
          className="radio radio-accent"
          name="district"
          checked={formData.location.district === item}
          onChange={handleLocationChange}
        />
      </label>
    </li>
  );
})}  </ul>    </details>

{(formData.location.district) && (

  <div
    key={formData.location.district}
    className="badge badge-accent"
  >
    {formData.location.district}
  </div>
) }

<details className="dropdown">
  <summary className="btn m-1">Pick Priority</summary>
  <ul className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">

{priority.map((item) => {
 
  return (
    <li key={item}>
      <label className="label cursor-pointer">
        <span className="label-text">
          {item}
        </span>

        <input
          type="radio"
          value={item}
          className="radio radio-accent"
          name="priority"
          checked={
            formData.location.priority === item
          }
          onChange={handleChangeRadio}
        />
      </label>
    </li>
  );
})}  </ul>    </details>

{formData.priority && (
  <div
    className={`badge badge-${priorityBadge[formData.priority]}`}
  >
    {formData.priority}
  </div>
)}

<details className="dropdown">
  <summary className="btn m-1">Pick Tags</summary>
  <ul className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
{tags.map((item) => {
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
          name="tags"
          checked={formData.tags.includes(item)}
          onChange={handleChangeCheckbox}
        />
      </label>
    </li>
  );
})}
  </ul>
</details>
{/**dynamic tags rendering, to display below input */}
{formData.tags.map((item) => (
  <div
    key={item}
    className="badge badge-accent"
  >
    {item}
  </div>
))}

<details className="dropdown">
  <summary className="btn m-1">
    Pick Municipality
  </summary>

  <ul className="dropdown-content menu bg-base-100 rounded-box z-[1] w-60 p-2 shadow">
    {municipalities.map((item) => (
      <li key={item._id}>
        <label className="label cursor-pointer">

          <span className="label-text">
            {item.name}
          </span>

          <input
            type="radio"
            name="municipality"
            value={item._id}
            className="radio radio-primary"
            checked={
              formData.municipality === item._id
            }
            onChange={handleChange}
          />

        </label>
      </li>
    ))}
  </ul>
</details>



          
          <button className="btn btn-neutral mt-4" type="submit">Submit</button>
        </fieldset>
      </div>
    </div>
  </div>
</div></form>
)


}