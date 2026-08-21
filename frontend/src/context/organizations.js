import axios from "axios";

export async function getOrganizations() {
  try {
    const res = await axios.get(
      "http://localhost:3001/api/organizations",
      {
        withCredentials: true,
      }
    );

    return res.data.data.organizations;
    
  } catch (error) {
    console.error(
      "Error fetching organizations:",
      error.response?.data || error.message
    );

    throw error;
  }
}