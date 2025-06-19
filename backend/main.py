from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from face_recognizer import FaceRecognizer
import os


app = FastAPI()

# Add CORS middleware
origins = [
    "*"  # Allow all origins for local development. IMPORTANT: Restrict this in production!
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Use relative path for static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize face recognizer with the known faces directory
known_faces_dir = "static/known_faces"
print(f"DEBUG: In main.py, known_faces_dir is: {known_faces_dir}")
recognizer = FaceRecognizer(known_faces_dir)

class ImageData(BaseModel):
    image: str
    name: str = None  # Optional name for adding new faces

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    with open("backend/static/index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.post("/unlock")
async def unlock_face(data: ImageData):
    try:
        match_status, score_raw, processed_image, name = recognizer.recognize(data.image)
        
        # Ensure score is a standard Python float
        score = float(score_raw)

        # Ensure success is a standard Python boolean
        # Adjusted threshold for testing
        success = True if score > 0.3 else False
        
        print(f"Debug: Type of success: {type(success)}")
        print(f"Debug: Type of score: {type(score)}")

        return JSONResponse(content={
            "success": success,
            "identity": name,
            "score": score,
            "processed_image": processed_image
        })
    except Exception as e:
        import traceback
        print(f"ERROR: Exception in /unlock endpoint: {e}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": "Internal Server Error", "detail": str(e)}
        )

@app.post("/add_face")
async def add_face(data: ImageData):
    if not data.name:
        return JSONResponse(
            status_code=400,
            content={"error": "Name is required for adding a new face"}
        )
    
    try:
        face_id = recognizer.add_reference_face(data.image, data.name)
        return JSONResponse(content={
            "success": True,
            "message": f"Face added successfully with ID: {face_id}",
            "face_id": face_id
        })
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": str(e)}
        )
