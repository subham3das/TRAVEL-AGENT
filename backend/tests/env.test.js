import dotenv from "dotenv";

dotenv.config();

console.log("API KEY:", process.env.GEMINI_API_KEY ? "Loaded ✅" : "Missing ❌");
console.log("MODEL:", process.env.GEMINI_MODEL);