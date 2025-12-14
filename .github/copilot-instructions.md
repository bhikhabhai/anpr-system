# ANPR System - Copilot Instructions

## Project Overview
**ANPR** (Automatic Number Plate Recognition) is an end-to-end vehicle detection and license plate recognition system. It features a **FastAPI backend** processing images/videos with ONNX models, a **Next.js frontend** for UI, and uses **Supabase** for cloud storage (S3-compatible) and **PostgreSQL** for metadata persistence.

## Architecture

### Backend Structure (`/backend`)
- **FastAPI** server on `localhost:8000` with modular API routers
- **ONNX Runtime** for vehicle detection using `vehicle_detector.onnx` (CPU-based by default)
- **Supabase Client** for cloud storage and database operations
- **SQLModel + PostgreSQL** for relational data (Frames, Plates with JSONB fields)

**Key Modules:**
- `app/core/config.py` → Environment configuration (Supabase URLs, DB connection, bucket names)
- `app/core/supabase_client.py` → Supabase client initialization
- `app/services/inference.py` → Core ML pipeline: image preprocessing, ONNX inference, bounding box extraction, frame annotation
- `app/services/db.py` → SQLModel engine initialization and schema creation
- `app/services/models.py` → Data models: `Frame` (with JSONB raw_meta) and `Plate` (with JSONB bbox fields)
- `app/services/storage.py` → Supabase storage abstraction (upload annotated frames to buckets)
- `app/api/*.py` → Router modules: `infer_image`, `infer_video`, `infer_stream` (image fully implemented, video/stream are WIP)

### Frontend Structure (`/frontend`)
- **Next.js 16** with React 19.2 and TypeScript
- **Tailwind CSS 4** for styling
- **Babel Compiler** for React optimization
- Pages: `/app/page.tsx` (home), `/workspace/image/page.tsx` (image inference), `/workspace/video/page.tsx` (video inference)
- Single API client: `lib/api.ts` handling backend communication with configurable `NEXT_PUBLIC_BACKEND_URL`

### Data Flow
1. **Image Upload** → Frontend sends `FormData` with file + task (vehicle_detection|plate_recognition) + optional ROI to `/infer/image`
2. **Processing** → Backend decodes image → ONNX inference (640x640 model) → NMS post-processing → bounding box extraction
3. **Storage** → Annotated image uploaded to Supabase bucket → returns public URL
4. **Database** → Frame and Plate metadata stored in PostgreSQL with JSONB for flexible fields
5. **Response** → Backend returns frame/plate records with URLs and detection confidence scores

## Critical Developer Workflows

### Backend Setup & Running
```bash
# Windows
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Create .env with:
# SUPABASE_URL=https://xxxxx.supabase.co
# SUPABASE_KEY=service_role_xxxxx
# DATABASE_URL=postgresql+psycopg://user:pass@host:5432/postgres
# SUPABASE_STORAGE_BUCKET=anpr-frames
# SUPABASE_VIDEO_BUCKET=anpr-video
# SUPABASE_CROPS_BUCKET=anpr-crop

uvicorn app.main:app --reload --port 8000
# API Docs: http://localhost:8000/docs
```

### Frontend Setup & Running
```bash
cd frontend
npm install
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 npm run dev
# Frontend: http://localhost:3000
```

### Key Commands
- **Health Check:** `curl http://localhost:8000/health` (returns `{"status": "ok"}`)
- **Debug DB:** `curl http://localhost:8000/debug/db` (counts Frame records)
- **Image Inference:** `curl -X POST http://localhost:8000/infer/image -F "file=@image.jpg"`

## Project-Specific Patterns & Conventions

### Inference Hyperparameters
Located in `app/services/inference.py`:
- `IMG_SIZE = 640` → ONNX model expects 640×640 inputs
- `CONF_THRES = 0.30` → 30% confidence threshold for vehicle detection (adjustable)
- `IOU_THRES = 0.35` → 35% IOU for NMS (overlap threshold)

### Data Models & JSONB Usage
- `Frame` model stores `raw_meta` as PostgreSQL JSONB for flexible metadata (e.g., detection stats)
- `Plate` model uses JSONB for `bbox_vehicle` and `bbox_plate` (structured as `{"x1": float, "y1": float, "x2": float, "y2": float}`)
- This allows extending detection data without schema migrations

### Supabase Storage Abstraction
`app/services/storage.py` provides flexible bucket access:
- Three buckets: `anpr-frames` (full images), `anpr-video` (processed videos), `anpr-crop` (plate crops)
- Handles multiple Supabase client versions and storage interface variations
- Returns public URLs for uploaded objects

### CORS Configuration
FastAPI enables open CORS (`allow_origins=["*"]`) for dev. **Important:** Restrict in production with specific frontend origin.

### ROI (Region of Interest) Support
- Frontend sends ROI as JSON-encoded Form field: `{"x1": int, "y1": int, "x2": int, "y2": int}`
- Backend validates and passes to inference pipeline for cropped detection (reduces noise from irrelevant image regions)

## Integration Points & External Dependencies

### Required External Services
- **Supabase** (PostgreSQL + S3-compatible Storage): Database and file storage
- **FFmpeg** (installed system-wide): Video re-encoding in inference pipeline (checked at runtime)
- **ONNX Runtime** (`onnxruntime`): Model inference

### Frontend ↔ Backend Communication
- Base URL: `lib/api.ts` exports `API_URL` from `NEXT_PUBLIC_BACKEND_URL` env (defaults to `http://localhost:8000`)
- All calls are form-data based for file uploads; JSON for metadata responses
- Error responses include descriptive HTTP status codes (400 for validation, 500 for server errors)

### Database Schema Auto-Creation
- `app/services/db.py::init_db()` called on startup via `@app.on_event("startup")`
- Creates all SQLModel tables automatically using `SQLModel.metadata.create_all(engine)`
- No manual migrations needed for development; production should use Alembic

## Common Debugging & Extension Points

### Adding New Inference Models
1. Place ONNX file in `/backend/models/`
2. Create new `InferenceSession` in `app/services/inference.py` with model path
3. Add preprocessing/postprocessing logic to match model input/output specs
4. Create new API router in `app/api/` and include in `app/main.py`

### Extending Plate Detection
- Current setup supports vehicle detection; plate recognition is placeholder
- Pipeline collects bounding boxes in `Plate` records with confidence scores
- OCR integration would go in `app/services/inference.py` with new model session

### Frontend State Management
- Uses React hooks (no Redux/Zustand); each page manages its own state
- API calls in `lib/api.ts` are isolated functions (easy to mock for testing)
- Pages: `/image` for single image, `/video` for batch video processing
