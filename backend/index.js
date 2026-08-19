import express from 'express'
import db from './database.js'
import cookieParser from "cookie-parser";
import cors from "cors"
const app = express();


// import helmet from "helmet";
// import morgan from "morgan";

import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";
import routes from './routes/index.js'

db();

const PORT = Number(process.env.PORT) || 5000;
console.log(process.env.PORT)
/*
 * Needed when deployed behind Render, Railway, Nginx,
 * Vercel, or another reverse proxy.
 */
// if (process.env.NODE_ENV === "production") {
//   app.set("trust proxy", 1);
// }

/*
 * Security headers.
 */
// app.use(helmet());


/*
 * Allow the React frontend to communicate with the backend.
 *
 * credentials: true is required because the refresh token
 * is stored in an HTTP-only cookie.
 */

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  }),
);

/*
 * Parse JSON and form requests.
 */
// app.use(
//   express.json({
//     limit: "1mb",
//   }),
// );

// app.use(
//   express.urlencoded({
//     extended: true,
//     limit: "1mb",
//   }),
// );


/*
 * Parse cookies, including the refresh-token cookie.
 */
app.use(cookieParser());

/*
 * HTTP request logging during development.
 */
// if (process.env.NODE_ENV !== "test") {
//   app.use(morgan("dev"));
// }


app.use(express.json())
// app.use(
//   express.urlencoded({
//     extended: true,
//     limit: "1mb",
//   }),
// );

app.use("/api", routes);
/*
 * Handle routes that do not exist.
 */
app.use(notFoundHandler);

/*
 * Central error handler must always be last.
 */
app.use(errorHandler);


app.listen(process.env.PORT, ()=>{
    console.log("port is connected")
}
)