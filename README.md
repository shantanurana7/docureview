# Brand Review Tool

A lightweight, **frontend-only** web application for brand compliance review of design assets. Runs entirely in the browser — no backend, no database, no server required.

Built for KPMG brand reviewers to annotate images and PDFs, run logo placement and window motif overlay tests, and export annotated PDF reports.

---

## Features

### 📂 File Upload
- Upload **PNG / JPG / JPEG images** or **multi-page PDFs**
- Drag & drop or click-to-browse
- PDF page count shown immediately on upload
- Image thumbnail preview before starting review

### ✏️ Annotation
- **Rectangle highlighter** — draw directly on the image or PDF page
- Click an existing annotation to edit or delete it
- Numbered badges on each annotation
- Sidebar comment list with inline edit support
- Comments tagged per page for PDF reviews

### 📄 PDF Viewer
- Multi-page PDF rendering using **pdfjs-dist** (local worker, no CDN dependency)
- **Pagination bar** below the viewer — Prev / Next buttons + jump-to-page input
- Annotation count pill shows how many annotations exist on the current page
- Switching pages updates the annotation overlay automatically
- **Reference Pages Accordion** — Dedicated side panel for PDF uploads with click-to-enlarge structural references (Insights led page, Hub page, Contact page, Infographics, Video banners)

### ✅ Brand Checklist *(image reviews only)*
- **Platform selector** — LinkedIn (1200×700), Twitter (1024×1024), Ecomms (600×400)
- **Image size auto-check** — compares uploaded image dimensions against platform requirements; auto-fills failure comment
- **Style toggle** — Style 1.1 (Human), 1.2 (Object), 2 (Only Text), 3.1 (Action), 3.2 (Architecture)
- **Logo placement overlay** — draggable KPMG C-logo overlay (blue or white), scale + opacity sliders
- **Window motif overlay** — draggable ratio box (7:10 or 10:7), scale + opacity sliders
- Each test has an explicit **Save Result** button — results only appear in the PDF export after saving
- Brand checklist is automatically hidden for PDF uploads (annotations only)

### 📊 Dashboard
- Overview of all reviews with status, job ID, and designer
- Charts using KPMG brand palette
- Click any review to re-open it

### 📤 Export & Share
- **Save PDF** — generates an annotated image (page 1) plus a drawn summary page with all comments and brand test results (page 2)
- **Send to Designer** — opens a pre-filled `mailto:` draft with the full review summary (you can manually attach the downloaded PDF)
- **Download JSON** — exports all review metadata, annotations, and test results (without PDF binary data)
- **Load JSON** — restore a workspace from a previously downloaded file; supports merge or replace

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Styling | Tailwind CSS v3 |
| Routing | React Router v7 |
| PDF Rendering | pdfjs-dist v6 (local worker) |
| PDF Generation | pdf-lib + html2canvas |
| Charts | Chart.js |
| Build | Vite + vite-plugin-singlefile |
| Storage | Browser `localStorage` + exportable JSON |

---

## Prerequisites

- Node.js v22+
- npm

---

## Installation & Setup

```bash
# 1. Clone the repo
git clone https://github.com/shantanurana7/docureview.git
cd docureview/frontend

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev
```

The app will be available at `http://localhost:3000` (or the next available port).

---

## Production Build

The project uses `vite-plugin-singlefile` to bundle all JavaScript and CSS into a **single `index.html`** file, ensuring it can run directly from the `file://` protocol without a local server. Image assets are stored externally in a companion `assets/` folder to keep the HTML lightweight and organized.

```bash
# Important: Ensure your images are placed in frontend/public/assets/ before building
npm run build
# Output: 
# frontend/dist/index.html
# frontend/dist/assets/ (contains all images and logos)
```

Distribute both the `dist/index.html` file and the `dist/assets/` directory together. Users can double-click `index.html` to open the app directly in their browser with no install or server needed.

---

## How to Use

1. **New Review** — Click `+ New Review`, upload a PNG/JPG or PDF, fill in the details, and click **Start Review**.
2. **Annotate** — Draw rectangles on the image or PDF page; add a comment in the modal that appears. For PDFs, the center column displays an accordion of **Reference Pages** with click-to-enlarge sample references.
3. **Brand Checklist** *(images only)* — Select the target platform, check image dimensions, run logo and motif overlay tests, save each result
4. **PDF Navigation** — For PDF uploads, use the pagination bar below the viewer to navigate pages and annotate per page
5. **Persist & Complete** — Click **Save & Mark Complete** to calculate the test score, save the progress, and move the file to the Completed dashboard
6. **Export** — Use **Save PDF** or **Send to Designer** from a review. In the Dashboard, click **Export CSV** to download a detailed report of all completed reviews, including individual brand test scores.
7. **Resume / Backup** — Open the app later and **Load JSON** to restore your workspace (merge or replace existing data), or use **Download JSON** to backup

---

## Storage Model

| File type | Base64 in localStorage | Base64 in JSON export |
|---|---|---|
| Image (PNG/JPG) | ✅ Yes | ✅ Yes |
| PDF | ❌ No (too large) | ❌ No |

PDF reviews persist their **metadata and annotations** to localStorage but not the file binary. Reloading the page will require re-uploading the PDF file, while all comments and test results are retained.

---

## Project Structure

```
docureview/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   └── review/
│   │   │       └── BrandChecklist.tsx   # Platform, style, overlay tests
│   │   ├── pages/
│   │   │   ├── UploadPage.tsx           # File upload + metadata form
│   │   │   ├── ReviewPage.tsx           # Annotation canvas + PDF viewer + sidebar
│   │   │   ├── ReviewerDashboard.tsx    # All reviews overview
│   │   │   └── ViewReviewedPage.tsx     # Read-only completed review view
│   │   ├── services/
│   │   │   └── localStore.ts            # localStorage + JSON persistence
│   │   ├── context/
│   │   │   └── StoreContext.tsx
│   │   └── types.ts
│   ├── public/
│   │   └── assets/
│   │       ├── KPMG_blue_logo.svg
│   │       ├── KPMG_white_logo.svg
│   │       └── sample-*.jpg
│   └── package.json
└── README.md
```
