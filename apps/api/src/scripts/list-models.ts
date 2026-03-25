import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

// Manually parse .env to avoid import issues
const envFile = fs.readFileSync(path.join(process.cwd(), "../../.env"), "utf-8");
const apiKeyLine = envFile.split("\n").find(line => line.startsWith("GEMINI_API_KEY="));
const apiKey = apiKeyLine ? apiKeyLine.split("=")[1].trim() : "";

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    const result = await genAI.listModels();
    for (const m of result.models) {
      console.log(`${m.name} - ${m.supportedGenerationMethods}`);
    }
  } catch (e) {
    console.error(e);
  }
}

listModels();
