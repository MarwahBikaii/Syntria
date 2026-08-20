import axios from "axios"
//get user from backend
//access when needed
export async function getUser(){
    try{
    const res= await
    axios.get("http://localhost:3001/api/users/me",
         {
        withCredentials: true,
      }
    )
    
    return res.data.data.user
    //my backend response is like this
    /**  
     * res :{
     * data:{
     * success:true,
     * data:{
     * user:{
     * ......}}
     * }
     * }
     * */ 

    //axios sends server response in a response object (promise)
    //not actual data directly
    
}
catch(error){
    console.error("Error fetching user profile:", error);
    throw error; 

}}

