import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.post("/api/generate", async (req, res) => {
try {
const { prompt, apiKey } = req.body;
const key = apiKey || process.env.GEMINI_API_KEY;
if (!key || !prompt) {
return res.status(400).json({ error: "Thieu API key hoac prompt" });
}

const genAI = new GoogleGenerativeAI(key);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const result = await model.generateContent(prompt);
res.json({ output: result.response.text() });


} catch (err) {
res.status(500).json({ error: String(err.message || err) });
}
});

app.get("/", (req, res) => {
res.send("Veo3 backend ok");
});

app.listen(port, () => {
console.log("Server chay port " + port);
});
