import express from "express";
import cors from "cors";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/genai";

const app = express();
const upload = multer();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.post("/api/generate", upload.none(), async (req, res) => {
  try {
    const { prompt, apiKey } = req.body;

    if (!apiKey || !prompt) {
      return res.status(400).json({ error: "Thiếu API key hoặc prompt." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);

    res.json({ output: result.response.text() });
  } catch (err) {
    console.error("Lỗi khi gọi Gemini API:", err);
    res.status(500).json({ error: "Lỗi khi xử lý yêu cầu." });
  }
});

app.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
});
