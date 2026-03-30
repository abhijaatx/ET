import OpenAI from "openai";
import fs from "fs";
import path from "path";

// Manually parse .env to avoid import issues
const envFile = fs.readFileSync(path.join(process.cwd(), "../../.env"), "utf-8");
const apiKeyLine = envFile.split("\n").find(line => line.startsWith("NVIDIA_API_KEY="));
const apiKey = apiKeyLine ? apiKeyLine.split("=")[1]!.trim() : "";

const nvidia = new OpenAI({
  apiKey,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

async function listModels() {
  try {
    const result = await nvidia.models.list();
    for await (const m of result) {
      console.log(`${m.id} - ${m.owned_by}`);
    }
  } catch (e) {
    console.error(e);
  }
}

listModels();
