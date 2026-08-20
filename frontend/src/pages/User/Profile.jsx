//get profile
//display
//edit button
//edit fields and call update profile
//update password endpoint
import axios from "axios"
import { useState,useEffect } from "react";
import {getUser} from "../../context/auth"

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
        Could not load profile.
      </div>
    );
  }
  
  return (
   <div className="max-w-2xl mx-auto py-10 px-6">

      <ul className="list bg-base-100 rounded-box shadow-md">

        <li className="p-4 pb-2 text-xs opacity-60 tracking-wide">
          Profile
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

      </ul>

      <button className="btn btn-primary mt-5">
        Edit Profile
      </button>

    </div>
  );
}