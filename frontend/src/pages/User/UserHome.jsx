import { getUser } from "../../context/auth.js";
import { useState, useEffect} from "react";
import { Link } from "react-router-dom";

import UserStats from "./UsetStats.jsx";

export default function UserHome() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await getUser();

        setUser(user);

        console.log(user);
      } catch (error) {
        console.log(
          error.response?.data || error.message
        );

        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-10">
        You must be logged in.
      </div>
    );
  }

  return (
    <>
      {user.volunteerProfile?.isActive && (
        <div
          role="alert"
          className="alert alert-success"
        >
          <span className="text-white">
            Explore initiatives to become a part of an amazing impact!
          </span>
        </div>
      )}

      <div
        className="hero min-h-screen bg-cover bg-center"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=1200&q=80)",
        }}
      >
        <div className="hero-overlay bg-opacity-60"></div>

        <div className="hero-content text-neutral-content text-center">
          <div className="max-w-md">
            <h1 className="mb-5 text-5xl font-bold">
              Hello there, {user.firstName}
            </h1>

            <p className="mb-5">
              Start making an impact with Syntria!
            </p>

            <Link to="/report" className="btn btn-success">
              Get Started
            </Link>
          </div>
        </div>
      </div>

      {/** */}
      <UserStats></UserStats>
      

    </>
  );
}