import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function listModels() {
  const apiKey = "AIzaSyAUyCks_YyxPxvFjLzaZ5jd_EbPWJQt1vI"; // Hardcoded for diagnostic
  console.log("Using API Key:", apiKey.slice(0, 10), "...");
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log("Full Response:", JSON.stringify(data, null, 2));
    if (data.models) {
      console.log("Available Models:", JSON.stringify(data.models.map((m: any) => m.name), null, 2));
    } else {
      console.error("No models found in response.");
    }
  } catch (err) {
    console.error("Failed to list models:", err);
  }
}

listModels();
