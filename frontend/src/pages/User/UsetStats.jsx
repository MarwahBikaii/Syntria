import axios from "axios"
import { useEffect,useState } from "react"
export default function UserStats(){

const [initiatives, setInitiatives]= useState([])
//array of initiatives objects 


    useEffect(()=>{

        const fetchInitiatives =async()=>{
            const initiativesfetched= await 
        
         getInitiatives();

        setInitiatives(initiativesfetched)
        
        }

        fetchInitiatives();
    },[])

    const getInitiatives= async()=>{

        try{
        const initiatives=
        await axios.get("http://localhost:3001/api/initiatives"
            , {
          withCredentials: true,
        }
        )
       
        return initiatives.data.data.initiative
        console.log(initiatives.data.data.initiative)
        }catch(error){

        }
    }
return (
  <div className="max-w-7xl mx-auto px-6 py-10">

    <div className="mb-8">
      <h1 className="text-3xl font-bold">
        Explore Initiatives
      </h1>

      <p className="text-base-content/60 mt-2">
        Discover initiatives making an impact in your community.
      </p>
    </div>

    {initiatives.length === 0 ? (
      <div className="alert alert-info">
        <span>
          No initiatives are currently available.
        </span>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {initiatives.map((initiative) => (
          <div
            key={initiative._id}
            className="card bg-base-100 shadow-xl"
          >
            <div className="card-body">

             
              <div className="flex justify-between items-start gap-3">

                <h2 className="card-title">
                  {initiative.title}
                </h2>

                <span className="badge badge-primary">
                  {initiative.status}
                </span>

              </div>

        
              <p className="text-base-content/70">
                {initiative.description}
              </p>

       
              {initiative.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">

                  {initiative.tags.map((tag) => (
                    <span
                      key={tag}
                      className="badge badge-outline"
                    >
                      {tag}
                    </span>
                  ))}

                </div>
              )}

              <div className="divider"></div>

        
              <div className="text-sm">

                <p>
                  <span className="font-semibold">
                    Start:
                  </span>{" "}
                  {new Date(
                    initiative.executionPeriod
                      .plannedStartAt
                  ).toLocaleDateString()}
                </p>

                <p>
                  <span className="font-semibold">
                    End:
                  </span>{" "}
                  {new Date(
                    initiative.executionPeriod
                      .plannedEndAt
                  ).toLocaleDateString()}
                </p>

              </div>

        
              <div>
                <h3 className="font-semibold mt-3">
                  Expected Outcome
                </h3>

                <p className="text-sm text-base-content/70">
                  {initiative.expectedOutcome}
                </p>
              </div>

       
              {initiative.readiness && (
                <div className="mt-3">

                  <span className="text-sm font-semibold">
                    Readiness:
                  </span>

                  <span className="badge badge-secondary ml-2">
                    {initiative.readiness.status}
                  </span>

                </div>
              )}

       
              <div className="card-actions justify-end mt-5">

                <button
                  className="btn btn-primary btn-sm"
                >
                  View Initiative
                </button>

              </div>

            </div>
          </div>
        ))}

      </div>
    )}

  </div>
);
}
