🚗 ANPR Backend (FastAPI + Supabase + ONNX)

Automated Number Plate Recognition backend with modular inference endpoints for image, video, and live stream processing.
Designed for scalability using FastAPI, ONNX Runtime, Supabase Storage, and PostgreSQL.

📁 Project Structure
backend/
│   .env
│   requirements.txt
│   run.md
│
├───app
│   │   main.py
│   │   __init__.py
│
│   ├───api
│   │       infer_image.py
│   │       infer_video.py
│   │       infer_stream.py
│
│   ├───core
│   │       config.py
│   │       supabase_client.py
│
│   └───services
│           db.py
│           inference.py
│           models.py
│           storage.py
│
├───models
│       car_detector.onnx
│
└───outputs

🧪 Features
Feature	Status
Image inference	✔️ Implemented
Video inference	🚧 Placeholder
Stream inference	🚧 Placeholder
Upload annotated image to Supabase	✔️ Done
Store metadata in PostgreSQL	✔️ Done
Modular API routers	✔️ Done
⚙️ Requirements

Python 3.9+

Virtual environment recommended

📦 Installation & Setup
1️⃣ Clone repository
git clone <your-repo-url>
cd backend

2️⃣ Create and activate virtual environment
Windows
python -m venv venv
venv\Scripts\activate

macOS/Linux
python3 -m venv venv
source venv/bin/activate

3️⃣ Install dependencies
pip install -r requirements.txt

4️⃣ Environment Configuration

Create a .env file in project root:

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=service_role_xxxxx
DATABASE_URL=postgresql+psycopg://username:password@host:5432/postgres


Ensure your Supabase Storage bucket exists (e.g., anpr-frames).

▶️ Run the Backend
uvicorn app.main:app --reload --port 8000


API will be live at:

Base URL: http://localhost:8000

API Docs: http://localhost:8000/docs

🔌 API Endpoints
Endpoint	Method	Description
/health	GET	Check server status
/infer/image	POST	Upload & infer single image
/infer/video	POST	Process full video (WIP)
/infer/stream	POST	Start live camera/RTSP stream pipeline (WIP)

Example call (image inference):

curl -X POST "http://localhost:8000/infer/image" \
-F "file=@sample.jpg"

🧠 Inference Pipeline (Planned Final Workflow)
Raw Image → Vehicle Detection ONNX → Plate Detection ONNX → OCR ONNX
       ↓
Draw bounding boxes + plate text
       ↓
Upload annotated image to Supabase Storage
       ↓
Store metadata + URL in PostgreSQL

🗃️ Output Data Model

Stored per inference:

annotated image URL

timestamp

vehicle count

detected plate list

bounding boxes (vehicle + plate)

🚀 Deployment Targets (Future)

Dockerized deployment

Render/Railway/Supabase Edge Functions

Streaming inference with GPU support (Jetson / CUDA optional)

📌 Roadmap
Task	Status
Supabase connection	✔️ Completed
Image inference endpoint	✔️ Completed
Video support	🚧 Pending
Stream processing	🚧 Pending
Authentication & UI integration	🕒 Later phase
License

MIT — Use it, break it, improve it.