import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config();

export default async function connection (){
    try{
    await mongoose.connect(process.env.Database_URL);
    console.log("connected")
    }
    catch(error){
      console.log(error)
    }

}