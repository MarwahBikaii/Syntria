//get profile
//display
//edit button
//edit fields and call update profile
//update password endpoint
import axios from "axios"
import { useState,useEffect } from "react";
import {getUser} from "../../context/auth"
import { Link } from "react-router-dom";

export default function Profile() {

     const [user, setUser] = useState(null);
      const [loading, setLoading] = useState(true);
    
      
      useEffect(() => {
        const fetchUser = async () => {
          try {
            const user = await getUser();
    
            setUser(user);
            console.log(user) 

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

       if (!user) {
    return (
      <div className="text-center py-10">
        getting profile.
      </div>
    );
  }
  
  return (
   <div className="max-w-2xl mx-auto py-10 px-6">

      <ul className="list bg-base-100 rounded-box shadow-md">

        <li className="p-4 pb-2 text-xs opacity-60 tracking-wide">
            {
          (user.status=='active')&&
          <div className="badge badge-success text-white text-l">
  <svg className="size-[1em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="currentColor" strokeLinejoin="miter" strokeLinecap="butt"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2"></circle><polyline points="7 13 10 16 17 8" fill="none" stroke="currentColor" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2"></polyline></g></svg>
  Active
</div>}
        </li>

          <li className="p-4 pb-2 text-xs opacity-60 tracking-wide">
            {
          (!user.volunteerProfile.isActive)&&
          (<>
          <div className="badge badge-error text-white text-l mr-3">
  <svg className="size-[1em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="currentColor" strokeLinejoin="miter" strokeLinecap="butt"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2"></circle><polyline points="7 13 10 16 17 8" fill="none" stroke="currentColor" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2"></polyline></g></svg>
  Not a volunteer 
</div>
<Link to="/volunteer/activate"
        className="link link-error font-medium">Activate volunteer profile</Link>
        </>  )
}
{user.volunteerProfile.isActive && (
  <>
    <div className="badge badge-info text-white mr-3">
      You Are a Volunteer
    </div>

  {Object.entries(user.volunteerProfile)
  .filter(([key, value]) => Array.isArray(value))
  .map(([key, items]) => {
    if (items.length === 0) {
      return null;
    }

    return (
      <li
        className="list-row"
        key={key}
      >
        <div>
          <div className="font-bold mb-2">
            {key.charAt(0).toUpperCase() + key.slice(1) }
          </div>

          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <span
                key={item}
                className="badge badge-neutral"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </li>
    );
  })}
  </>
)}
        </li>

        <li className="list-row">
          <div>
            <div className="font-bold">
              {user.firstName} {user.lastName}
            </div>

            <div className="text-xs uppercase font-semibold opacity-60">
              Name
            </div>
          </div>
        </li>

        <li className="list-row">
          <div>
            <div className="font-bold">
              {user.email}
            </div>

            <div className="text-xs uppercase font-semibold opacity-60">
              Email
            </div>
          </div>
        </li>

        <li className="list-row">
          <div>
            <div className="font-bold">
              {user.phone}
            </div>

            <div className="text-xs uppercase font-semibold opacity-60">
              Phone
            </div>
          </div>
        </li>

        <li className="list-row">
          <div>
            <div className="font-bold">
              {user.accountType}
            </div>

            <div className="text-xs uppercase font-semibold opacity-60">
              Account Type
            </div>
          </div>
        </li>
          <li className="list-row">
          <div>
            <div className="font-bold">
              {user.location.country}, {user.location.address}
            </div>

            <div className="text-xs uppercase font-semibold opacity-60">
              Location
            </div>
          </div>
        </li>
        


      </ul>

      <button className="btn btn-success mt-5 text-white">
        Edit Profile
      </button>

    </div>
  );
}