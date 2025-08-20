# 🤖 AI ChatBot with PDF & Image Support (Gemini API)

![React](https://img.shields.io/badge/Frontend-React-blue)
![Node.js](https://img.shields.io/badge/Backend-Node.js-green)
![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini-red)
![OCR](https://img.shields.io/badge/OCR-Tesseract.js-yellow)
![PDF Parsing](https://img.shields.io/badge/PDF%20Parsing-pdf--parse--fixed-lightgrey)

This is a full-stack AI ChatBot built with React (frontend in **src**) and Node.js/Express (backend in **backend** folder).

It supports:
- Chatting with Gemini AI
- Uploading PDFs → extract text → ask questions
- Uploading Images → OCR → ask questions
- Multiple chat sessions, export chat, dark mode, typing indicator

---

## 🛠 Setup Steps

```bash
git clone <REPO_URL>         # Clone the repository
cd <project-folder>          # Enter the project folder
```

---

### Backend (Node.js)

```bash
cd backend                   # Go to backend folder
npm install                  # Install dependencies
npm install express cors multer fs pdf-parse-fixed tesseract.js mammoth dotenv @google/generative-ai
```

Create a `.env` file:

```
GOOGLE_API_KEY=YOUR_GEMINI_API_KEY_HERE
```

Run backend:
```bash
node server.js               # Starts backend on port 5000
```

---

### Frontend (React)

```bash
cd src                       # Go to frontend folder
npm install                  # Install frontend packages
npm start                    # Run React app
```

---

## ⚙ Useful Commands

| Command                                       | Purpose                                               |
|----------------------------------------------|-------------------------------------------------------|
| `netstat -ano | findstr :5000`               | Check which process is using port 5000                |
| `taskkill /PID <PID> /F`                     | Force kill the process blocking that port             |
| `GOOGLE_API_KEY=...`                         | Set your Gemini API key in environment variables      |

---

## ✅ Final

- Backend → http://localhost:5000
- Frontend → http://localhost:<PORT NUMBER>

---

## Author

Vaibhav Panda
