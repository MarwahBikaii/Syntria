import { useEffect, useState, } from "react";
import { getUser } from "../context/auth";
import { useNavigate,useLocation,Link } from "react-router-dom";
import axios from "axios"
import Swal from "sweetalert2"

export default function Header() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  
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

const navigation= useNavigate();
const location = useLocation();

  const handleLogout =async () =>{
  try {
      const res= axios.post("http://localhost:3001/api/auth/logout",
       {}, {withCredentials:true}
      )
      
         Swal.fire({
          title: "You're logged out",
          text: "Come back soon!",
          icon: "success"
        });
        setUser("")
        navigation('/login')
        console.log("LOGOUT RESPONSE:", res);
      
      }
      catch(error){
      
              Swal.fire({
        title: "Cannot log out",
        text: "Try again later",
        icon: "error"
      })
       navigation('/login')
    }
        
  }

  return (
    <div className="container max-w-[1400px] mx-auto px-8 bg-base-100 shadow-sm">
      <div className="navbar px-0">

     
        <div className="flex-1">
          <a className="btn btn-ghost text-xl">
            Syntria
          </a>
        </div>

  
        <div className="flex-none">
          <ul className="menu menu-horizontal items-center px-1">

           
            {loading && (
              <li>
                <span className="loading loading-spinner loading-sm"></span>
              </li>
            )}

            
            {!loading && !user && (
              <>
                <li>
                  <a>Contact Us</a>
                </li>

                <li>
                  <details>
                    <summary>About Us</summary>

                    <ul className="bg-base-100 rounded-box p-2 w-48 z-20 shadow">
                      <li>
                        <a>Impact</a>
                      </li>

                      <li>
                        <a>Common Questions</a>
                      </li>
                    </ul>
                  </details>
                </li>

                <li>
                  <button className="btn btn-primary">
                    Get Started
                  </button>
                </li>
              </>
            )}

          
            {!loading && user && (
              <>
               <Link to="/home">Home</Link>

                <li>
                  <a>Explore</a>
                </li>

           
                <li>
                  <details>
                    <summary>
                      <span className="font-medium">
                        {user.email}
                      </span>
                    </summary>
                   


                    <ul className="bg-base-100 rounded-box p-2 w-52 z-20 shadow right-0">
   <li>
  <Link to="/profile">
    Profile
  </Link>
</li>

                  

                      <li>
                        <button type="button" onClick={handleLogout} className="btn btn-error">Logout</button>
                      
                        
                      </li>
                    </ul>
                  </details>
                </li>
              </>
            )}

          </ul>
        </div>
      </div>
    </div>
  );
}