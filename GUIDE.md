# Syllabus AI — Premium SaaS Guide 🎓✨

Welcome to the **Syllabus AI** production-ready ecosystem. This guide covers the setup, architecture, and deployment of your high-performance study breakdown engine.

---

## 📋 Prerequisites

Ensure you have the following installed:

1.  **Node.js (v18+):** [Download here](https://nodejs.org/).
2.  **Firebase CLI:** For deploying security rules.
3.  **Google AI Studio API Key:** [Get it here](https://aistudio.google.com/app/apikey).

---

## 🛠️ Step 1: Project Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Environment Configuration (.env):**
    Create a `.env` file in the root and add your Gemini API key:
    ```env
    GEMINI_API_KEY="your_api_key_here"
    ```
3.  **Firebase Configuration:**
    Ensure `firebase-applet-config.json` exists in the root with your project credentials.

---

## 🔐 Step 2: Security & Database

We use a **Locked Down** security model. You must deploy the rules for the app to function in production.

1.  **Initialize/Login:**
    ```bash
    npx firebase-tools login
    ```
2.  **Deploy Firestore Rules:**
    ```bash
    npx firebase-tools deploy --only firestore:rules
    ```
    *Note: The project uses a custom schema that requires `status`, `createdAt`, and `updatedAt` fields for all syllabi.*

---

## 🚀 Step 3: Running the Engine

Launch the premium Glassmorphism UI:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## 🏗️ Architecture Overview

The application follows a **Decoupled Architecture** to ensure "perfect" stability:

-   **`src/services/firestoreService.ts`**: The exclusive data access layer. No component calls Firestore directly.
-   **`src/services/geminiService.ts`**: Handles intelligent syllabus parsing using the `gemini-2.0-flash` model.
-   **`src/components/ErrorBoundary.tsx`**: A safety wrapper that catches cognitive engine failures and allows for a "reboot."
-   **Global Search**: Integrated into `App.tsx`, providing unified filtering across Dashboard, Vault, and Planner.

---

## 🧩 Key Features & Workflow

1.  **Feed the Engine**: Upload a PDF, Image, or Text syllabus. The AI extracts topics, difficulty, and estimated hours.
2.  **Syllabus Vault**: Search and manage your curricula. Use the premium "Decommission" dialog to purge old data.
3.  **AI Roadmap**: Generate a cognitive-load-optimized study plan in the **Study Planner**.
4.  **Real-time Tracking**: Toggle topic mastery to watch your "Focus Trends" update on the Dashboard.

---

## 🛠️ Troubleshooting

-   **"Failed to authenticate":** Run `npx firebase-tools login` to refresh your session.
-   **"Invalid model":** Ensure `geminiService.ts` is using `gemini-2.0-flash`.
-   **White Screen:** If the app crashes, the `ErrorBoundary` will trigger. Check the browser console for the stack trace and click "Reboot Engine."

---

**Built with precision for the next generation of students.** 🚀
