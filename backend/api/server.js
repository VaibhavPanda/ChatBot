import express from "express";
import cors from "cors";
import multer from "multer";
import pdfParse from "pdf-parse-fixed";
import Tesseract from "tesseract.js";
import mammoth from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Use memory storage (no disk writes)
const upload = multer({ storage: multer.memoryStorage() });

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash-lite" });

let currentPdfContent = "";
let currentImageContent = "";

/* ---------- Normal Chat ---------- */
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const result = await model.generateContent(message);
    const reply = result.response.text();
    res.json({ reply });
  } catch (error) {
    console.error("Error calling Google API:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------- PDF Upload ---------- */
app.post("/upload", upload.single("file"), async (req, res) => {
  currentImageContent = "";
  currentPdfContent = "";

  try {
    const mimeType = req.file.mimetype;
    let extractedText = "";

    if (mimeType.includes("pdf")) {
      const pdfData = await pdfParse(req.file.buffer);
      extractedText = (pdfData.text || "").trim();
    } else if (mimeType.includes("word") || mimeType.includes("docx")) {
      const data = await mammoth.extractRawText({ buffer: req.file.buffer });
      extractedText = data.value;
    }

    currentPdfContent = extractedText || "";
    res.json({ reply: "PDF uploaded. You can now ask questions about it." });
  } catch (error) {
    console.error("Error processing PDF:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------- Ask about PDF ---------- */
app.post("/ask-pdf", async (req, res) => {
  const { question } = req.body;
  if (!currentPdfContent) {
    return res.json({ reply: "No PDF content loaded. Please upload a PDF first." });
  }
  const prompt = `
Use the following extracted text from a PDF to answer the user's question. 
If not found, reply 'Not found in PDF'.
---
${currentPdfContent}
---
Question: ${question}
`;
  try {
    const result = await model.generateContent(prompt);
    res.json({ reply: result.response.text() });
  } catch (error) {
    console.error("Error answering PDF:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------- Image Upload ---------- */
app.post("/upload-image", upload.single("file"), async (req, res) => {
  currentPdfContent = "";
  currentImageContent = "";

  try {
    const { data: { text } } = await Tesseract.recognize(req.file.buffer, "eng");
    currentImageContent = text.trim();
    res.json({ reply: "Image uploaded. You can now ask questions about the text in it." });
  } catch (error) {
    console.error("Error processing image:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------- Ask about Image ---------- */
app.post("/ask-image", async (req, res) => {
  const { question } = req.body;
  if (!currentImageContent) {
    return res.json({ reply: "No image content loaded. Please upload an image first." });
  }
  const prompt = `
Use the extracted text from an image to answer the question. 
If answer not in text say "Not found in image".
Text:
${currentImageContent}
Question: ${question}
`;
  try {
    const result = await model.generateContent(prompt);
    res.json({ reply: result.response.text() });
  } catch (error) {
    console.error("Error answering image:", error);
    res.status(500).json({ error: error.message });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

export default app;
