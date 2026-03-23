# DocuReview (Standalone Client)

DocuReview is a lightweight, frontend-only web application for seamless document proofing, annotation, and review workflows. It runs entirely in the browser using local JSON files for data persistence—no backend server or database required.

## Tech Stack
- **Frontend**: React, TypeScript, PrimeReact, Tailwind CSS, Vite
- **Storage**: Browser `localStorage` (session) and exportable JSON files (with Base64 embedded PDFs/Images).
- **Features**: 
  - Real-time PDF and Image rendering
  - Interactive Canvas annotations (rectangles, circles, severity/error tagging, Predefined Comments)
  - Pagination Jump-to-Page for multipage PDFs
  - Export reviews to visually annotated PDFs
  - Local JSON state load/save and duplicate conflict resolution
  - Email notification Generation via `mailto` with review scores
  - Monolithic single-file HTML build

## Prerequisites
- Node.js (v18+ recommended)
- npm

## Installation & Setup (Development)

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd docureview/frontend
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Run Dev Server:**
   ```bash
   npm run dev
   ```
   *The application will be available at `http://localhost:3000`.*

## Standalone Client Build (Production)

DocuReview is configured with `vite-plugin-singlefile` to compile all CSS, JavaScript, and assets into one single standalone `index.html` file. This entirely bypasses browser CORS restrictions for local files (`file://`).

1. **Build the project:**
   ```bash
   npm run build
   ```
2. **Access the Client:**
   The build process outputs to the `frontend/dist` folder (and is copied to the root `/client` folder).
   You can distribute the `/client` folder or just the monolithic `index.html` file to anyone.
   
   **To run the app, simply double-click `client/index.html` in your file explorer.** No local server is required.

## How to Use

1. **Start a Review**: Click "+ New Review", upload a PDF or Image, and fill in the metadata.
2. **Annotate & Score**: Draw directly on the document, add comments, and fill out the scoring matrix.
3. **Save Progress**: Click "Save" in the navbar to persist data to your current browser session.
4. **Export Data**: Click "Download JSON" to save all your reviews (including the embedded documents) to a `.json` file on your computer.
5. **Resume Work**: Open the app later and click "Load JSON" to restore your entire workspace from your downloaded file. If you have overlapping session data, the app will ask if you want to Merge or Replace the data.
6. **Finalize**: Generate an annotated PDF and use the "Email to Designer" button to instantly draft a summary email with the review scores.
