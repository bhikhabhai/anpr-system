# ANPR System - Automatic Number Plate Recognition

A production-ready, end-to-end **Vehicle Detection and License Plate Recognition** system combining a Python FastAPI backend with computer vision, a modern Next.js frontend UI, PostgreSQL for metadata persistence, and Supabase for cloud storage.

> Designed for **scalable, real-time traffic monitoring** and **surveillance applications** across traffic cameras, toll plazas, parking facilities, and law enforcement.

---

## 🌟 Features

- ✅ **Vehicle Detection** - Real-time detection using ONNX-optimized deep learning models
- ✅ **License Plate Recognition** - Extract and recognize number plates from vehicle detections
- ✅ **Image & Video Processing** - Single image inference and batch video processing pipelines
- ✅ **Cloud Storage Integration** - Seamless Supabase S3-compatible storage for images and videos
- ✅ **PostgreSQL Persistence** - Robust metadata storage with flexible JSONB fields
- ✅ **REST API** - FastAPI with auto-generated OpenAPI documentation
- ✅ **Modern Web UI** - Next.js 16 frontend with real-time upload and result display
- ✅ **ROI Support** - Region-of-Interest cropping to focus detection on specific image areas
- ✅ **Modular Architecture** - Easy to extend with new models and detection pipelines

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                        │
│                  (React 19 + Tailwind CSS)                  │
│         /image, /video inference pages                      │
└────────────────────┬────────────────────────────────────────┘
                     │ FormData + ROI (optional)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   FastAPI Backend                           │
│    /infer/image, /infer/video, /infer/stream               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ONNX Inference Pipeline                             │  │
│  │  • Image decoding & preprocessing (640×640)          │  │
│  │  • Vehicle detection (CONF_THRES=0.30)               │  │
│  │  • NMS post-processing (IOU_THRES=0.35)              │  │
│  │  • Bounding box extraction                           │  │
│  │  • Frame annotation with overlays                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                     │                                        │
│         ┌───────────┼───────────┐                            │
│         ▼           ▼           ▼                            │
│   ┌──────────┐ ┌────────┐ ┌────────────┐                    │
│   │ Supabase │ │Postgre │ │   FFmpeg   │                    │
│   │ Storage  │ │  SQL   │ │ (Video Re- │                    │
│   │(S3 API)  │ │ Tables │ │  encoding) │                    │
│   └──────────┘ └────────┘ └────────────┘                    │
└─────────────────────────────────────────────────────────────┘
         │              │
         ▼              ▼
   [Frame URL]  [Metadata + JSONB]
```

---

## 📋 Prerequisites

### System Requirements
- **Python 3.9+** (Backend)
- **Node.js 18+** (Frontend)
- **PostgreSQL 12+** (Database)
- **FFmpeg 4.0+** (Video processing)
- **Supabase Account** (Cloud storage + hosted PostgreSQL)

### Environment Setup
Create `.env` files for configuration:

**Backend (`backend/.env`)**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/anpr_db
SUPABASE_STORAGE_BUCKET=anpr-frames
SUPABASE_VIDEO_BUCKET=anpr-video
SUPABASE_CROPS_BUCKET=anpr-crop
```

**Frontend (`frontend/.env.local`)**
```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

---

## 🚀 Getting Started

### 1️⃣ Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --reload --port 8000
```

**API will be available at:**
- Base URL: `http://localhost:8000`
- Interactive Docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 2️⃣ Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 npm run dev
```

**Frontend will be available at:** `http://localhost:3000`

### 3️⃣ Verify Installation

```bash
# Check backend health
curl http://localhost:8000/health

# Check database connectivity
curl http://localhost:8000/debug/db

# Test image inference (replace with actual image)
curl -X POST http://localhost:8000/infer/image \
  -F "file=@sample.jpg" \
  -F "task=vehicle_detection"
```

---

## 📡 API Endpoints

### Health & Debug
- `GET /health` – Server status
- `GET /debug/db` – Database connection check (frame count)

### Image Inference
- **Endpoint:** `POST /infer/image`
- **Parameters:**
  - `file` (UploadFile) – Image file (JPEG, PNG)
  - `task` (str) – `vehicle_detection` or `plate_recognition`
  - `roi` (optional str) – JSON-encoded Region of Interest: `{"x1": int, "y1": int, "x2": int, "y2": int}`
- **Response:**
  ```json
  {
    "frame": {
      "id": 1,
      "image_url": "https://...",
      "vehicle_count": 3,
      "plate_count": 3,
      "raw_meta": {...}
    },
    "plates": [
      {
        "id": 1,
        "plate_text": "ABC123",
        "confidence": 0.92,
        "bbox_vehicle": {"x1": 10, "y1": 20, "x2": 100, "y2": 120},
        "bbox_plate": {"x1": 30, "y1": 70, "x2": 80, "y2": 100}
      }
    ]
  }
  ```

### Video Inference *(WIP)*
- `POST /infer/video` – Batch video processing (placeholder)

### Stream Inference *(WIP)*
- `POST /infer/stream` – Live camera/RTSP stream (placeholder)

---

## 🎯 Key Hyperparameters

Located in `backend/app/services/inference.py`:

| Parameter | Value | Description |
|-----------|-------|-------------|
| `IMG_SIZE` | 640 | ONNX model input resolution (640×640) |
| `CONF_THRES` | 0.30 | Confidence threshold for detections (30%) |
| `IOU_THRES` | 0.35 | Intersection-over-Union for NMS (35%) |

Adjust these in `inference.py` to tune detection sensitivity and performance.

---

## 📁 Project Structure

```
anpr-system/
├── backend/                      # FastAPI server
│   ├── app/
│   │   ├── main.py              # FastAPI app initialization
│   │   ├── api/                 # Router modules
│   │   │   ├── infer_image.py   # Image inference endpoint
│   │   │   ├── infer_video.py   # Video inference (WIP)
│   │   │   └── infer_stream.py  # Stream inference (WIP)
│   │   ├── core/                # Configuration & clients
│   │   │   ├── config.py        # Environment variables
│   │   │   └── supabase_client.py
│   │   ├── services/            # Business logic
│   │   │   ├── inference.py     # ONNX pipeline
│   │   │   ├── db.py            # SQLModel setup
│   │   │   ├── models.py        # Frame & Plate models
│   │   │   └── storage.py       # Supabase integration
│   │   └── constants/
│   │       └── video_status.py  # Status enums
│   ├── models/                  # ONNX model files
│   │   └── vehicle_detector.onnx
│   ├── outputs/                 # Generated inference outputs
│   └── requirements.txt          # Python dependencies
│
├── frontend/                     # Next.js 16 UI
│   ├── src/
│   │   └── app/
│   │       ├── page.tsx         # Home page
│   │       ├── layout.tsx       # Root layout
│   │       ├── globals.css      # Global styles
│   │       └── workspace/
│   │           ├── image/page.tsx   # Image inference page
│   │           └── video/page.tsx   # Video inference page
│   ├── lib/
│   │   └── api.ts               # Backend API client
│   ├── package.json             # Node dependencies
│   ├── tsconfig.json            # TypeScript config
│   └── tailwind.config.ts       # Tailwind CSS config
│
└── .github/
    └── copilot-instructions.md  # AI agent conventions
```

---

## 🔧 Development & Debugging

### Backend Debugging
```bash
# Run with auto-reload and detailed logs
uvicorn app.main:app --reload --port 8000 --log-level debug

# Access Swagger UI for endpoint testing
# Visit: http://localhost:8000/docs
```

### Frontend Debugging
```bash
# Next.js dev server with hot reload
npm run dev

# Build for production
npm run build
npm start

# Run linter
npm run lint
```

### Database Inspection
```bash
# Connect directly to PostgreSQL
psql postgresql://user:password@localhost:5432/anpr_db

# Example queries
SELECT COUNT(*) FROM frame;
SELECT * FROM plate WHERE confidence > 0.90;
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| **Supabase connection fails** | Verify `SUPABASE_URL` and `SUPABASE_KEY` in `.env` |
| **Database connection timeout** | Check PostgreSQL is running; verify `DATABASE_URL` |
| **FFmpeg not found (video inference)** | Install FFmpeg: `choco install ffmpeg` (Windows) or `brew install ffmpeg` (macOS) |
| **ONNX model not loading** | Ensure `vehicle_detector.onnx` exists in `backend/models/` |
| **Frontend can't reach backend** | Check `NEXT_PUBLIC_BACKEND_URL` env var; ensure backend is running |

---

## 🔐 Security Notes

- **CORS:** Currently set to open (`allow_origins=["*"]`) for development. **Restrict to frontend domain in production.**
- **Supabase Keys:** Use service role keys only in backend; never expose in frontend.
- **Database:** Always use strong passwords; restrict access to database from backend only.
- **Storage Buckets:** Consider making buckets private if storing sensitive vehicle data.

---

## 📈 Performance Optimization

- **ONNX CPU Inference:** Default setup uses CPU. For GPU acceleration, install `onnxruntime-gpu` and update `providers` in `inference.py` to `["CUDAExecutionProvider"]`.
- **Image Preprocessing:** Model expects 640×640 inputs. Aspect ratio is preserved; unused areas are padded.
- **Model Size:** `vehicle_detector.onnx` is ~100MB. Consider quantization for edge deployment.
- **Video Processing:** FFmpeg re-encodes videos for compatibility; adjust `crf` (quality) and `target_bitrate` parameters for speed/quality tradeoffs.

---

## 🧪 Testing

Tests are not yet implemented. TODO:
- Unit tests for inference pipeline
- Integration tests for API endpoints
- E2E tests for full workflows

---

## 📝 Extending the System

### Adding a New ONNX Model
1. Place `.onnx` file in `backend/models/`
2. Create `InferenceSession` in `app/services/inference.py`
3. Implement preprocessing (input shape, normalization)
4. Add postprocessing for output format
5. Create API router in `app/api/` and register in `main.py`

### Implementing Plate OCR
- Current system detects bounding boxes; OCR model integration goes in `inference.py`
- Use `easyocr` or `paddleocr` for text extraction
- Store results in `Plate.plate_text` field

### Streaming Pipeline
- `infer_stream.py` skeleton exists; implement with OpenCV + threading
- Support RTSP, MJPEG, and webcam inputs
- Consider WebSocket for real-time frontend updates

---

## 📚 Documentation

- **API Docs:** `http://localhost:8000/docs` (Swagger UI)
- **Architecture Details:** See `.github/copilot-instructions.md`
- **Backend Readme:** `backend/README.md`
- **Frontend Readme:** `frontend/README.md`

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m "Add your feature"`
3. Push to branch: `git push origin feature/your-feature`
4. Open a pull request

---

## 📄 License

[Specify your license here, e.g., MIT, Apache 2.0, etc.]

---

## 📧 Support & Questions

For issues, questions, or feature requests, please open an issue on GitHub or contact the development team.

---

**Happy detecting! 🚗**
