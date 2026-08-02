import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testSdk() {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: "Hello world testing Gemini embeddings",
  });
  console.log("Keys:", Object.keys(response));
  console.log("Response:", response);
}

testSdk();
