# DocuReview

DocuReview is a robust web application for seamless document proofing, annotation, and review workflows between designers and reviewers.

## Tech Stack
- **Frontend**: React, TypeScript, PrimeReact, Tailwind CSS, Vite
- **Backend**: Node.js, Express, node:sqlite (Built-in Native SQLite)
- **Features**: Real-time PDF rendering, interactive Canvas annotations, CSV & PDF exporting, Role-based Dashboards.

## Prerequisites
- Node.js (v18+ recommended)
- npm

## Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd docureview
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   *The backend runs on port `5000` by default. It will automatically generate `docureview.db` and the `uploads` folder on startup.*

3. **Frontend Setup:**
   Open a new terminal window:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *The frontend runs usually on `http://localhost:5173`.*

## Default Credentials
When the backend starts for the first time, it provisions a default administrator account. Use these credentials to log in, create Designer and Reviewer accounts, and configure the system.
- **Email**: `admin@docureview.com`
- **Password**: `admin123`

## Project Structure
- `/backend`: Contains the Express server, SQLite schema, file upload handling, and REST endpoints.
- `/frontend`: Contains the React SPA with specific routing for Admin, Designer, and Reviewer roles.
