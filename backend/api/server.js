import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import pdfParse from "pdf-parse-fixed";
import Tesseract from "tesseract.js";
import mammoth from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ dest: "uploads/" });

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash-lite" });

let currentPdfContent = "";
let currentImageContent = "";

/* ---------- Root Route ---------- */
app.get("/", (req, res) => {
  res.send("✅ Backend is running successfully 🚀");
});

/* ---------- Helper: strong LaTeX instruction ---------- */
const latexInstruction = `
If the answer includes mathematical notation, use LaTeX. 
Wrap display math in $$...$$ and inline math in \\(...\\) (or $...$ for inline).
Do NOT escape backslashes (produce single backslashes, e.g. \\frac{1}{2}).
Return the answer as plain text only.
`;

/* ---------- Normal Chat ---------- */
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    // Add a clear instruction so model consistently emits LaTeX when math is present
    const prompt = `
You are a helpful assistant.
${latexInstruction}
User: ${message}
`;

    const result = await model.generateContent(prompt);
    let reply = result.response.text();

    // Fallback: if the model somehow returns double-escaped backslashes (\\), convert to single.
    // This is a safe fallback but ideally you should inspect logs and remove double-escaping at the source.
    if (reply.includes("\\\\")) {
      reply = reply.replace(/\\\\/g, "\\");
    }

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
    const filePath = req.file.path;
    const mimeType = req.file.mimetype;
    let extractedText = "";

    if (mimeType.includes("pdf")) {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      extractedText = (pdfData.text || "").trim();
    } else if (mimeType.includes("word") || mimeType.includes("docx")) {
      const data = await mammoth.extractRawText({ path: filePath });
      extractedText = data.value;
    }

    currentPdfContent = extractedText || "";
    fs.unlinkSync(filePath);
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
Use the following extracted text from a PDF to answer the user's question. If not found, reply 'Not found in PDF'.
${latexInstruction}
---
${currentPdfContent}
---
Question: ${question}
`;

  try {
    const result = await model.generateContent(prompt);
    let reply = result.response.text();
    if (reply.includes("\\\\")) {
      reply = reply.replace(/\\\\/g, "\\");
    }
    res.json({ reply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------- Image Upload ---------- */
app.post("/upload-image", upload.single("file"), async (req, res) => {
  currentPdfContent = "";
  currentImageContent = "";

  try {
    const filePath = req.file.path;
    const { data: { text } } = await Tesseract.recognize(filePath, "eng");
    currentImageContent = text.trim();
    fs.unlinkSync(filePath);
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
Use the extracted text from an image to answer the question. If answer not in text say "Not found in image".
${latexInstruction}
Text:
${currentImageContent}
Question: ${question}
`;

  try {
    const result = await model.generateContent(prompt);
    let reply = result.response.text();
    if (reply.includes("\\\\")) {
      reply = reply.replace(/\\\\/g, "\\");
    }
    res.json({ reply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------- Start Server ---------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
