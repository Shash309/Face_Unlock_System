# Face Unlock System

A modern, robust web-based face unlock and liveness verification system using React (frontend) and FastAPI (backend). The system uses face recognition and gesture-based liveness detection for secure access control.

---

## Features

- **Face Recognition**: Unlock access by matching your face to registered faces.
- **Liveness Detection**: Prove you are a real person by performing random gestures (blink, open mouth, show two fingers, show one hand, thumbs up).
- **Modern UI/UX**: Clean, responsive, and visually appealing interface with clear feedback and animations.
- **Add New Faces**: Register new users by recording a video or uploading an image.
- **Security**: Only real, recognized faces and correct gestures are accepted.
- **Feedback**: Success/failure messages, confetti animation, and countdown on unlock.
- **Logs & Status**: View logs and system status for transparency.

---

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS (Vite build)
- **Backend**: FastAPI (Python) with OpenCV, face_recognition, and MediaPipe
- **Data Storage**: Reference faces and metadata stored in `backend/static/known_faces/`

---

## Project Structure

```
task_2/
  backend/
    main.py                # FastAPI backend, API endpoints
    face_recognizer.py     # Face recognition logic
    requirements.txt       # Backend dependencies
    static/
      known_faces/         # Reference face images & metadata
      assets/              # Frontend build assets
      index.html           # Frontend entry (served by backend)
  frontend/
    src/
      App.tsx, components/ # Main React app and UI components
    package.json           # Frontend dependencies/scripts
  README.md                # Project documentation
```

---

## Setup Instructions

### Prerequisites
- **Python 3.8+** (for backend)
- **Node.js (LTS)** and **npm** (for frontend)
- **A webcam** (for face scan and liveness)

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
```
- Place at least one reference image (e.g. `reference.jpg`) in `backend/static/known_faces/`.
- (Optional) Edit `face_metadata.json` to map image files to user names.

Start the backend server:
```bash
uvicorn main:app --host 127.0.0.1 --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
- The app will open at `http://localhost:5173`.

---

## Usage Guide

### Unlock Flow
1. **Start Face Scan**: Click "Start Face Scan" and allow camera access.
2. **Face Recognition**: Look at the camera. Only a real, recognized face will pass. If your face is covered or not recognized, you must retry.
3. **Liveness Challenge**: Perform the prompted gesture (randomly chosen: blink, open mouth, show two fingers, show one hand, thumbs up). Only the correct gesture will pass.
4. **Success**: If both steps pass, you see a celebratory unlock screen and are redirected home after a countdown.
5. **Failure**: If any step fails, you get a clear error and can retry.

### Adding a New Face
- Go to "Add Face".
- Enter a name and record a short video (or upload an image).
- The backend extracts frames, detects the face, and adds it to the database.
- The new face can now unlock the system.

### Gesture/Liveness Detection
- Supported gestures: **blink**, **open mouth**, **show two fingers (✌️)**, **show one hand (🖐️)**, **thumbs up (👍)**
- Only the requested gesture will pass. For example, "show one hand" will not pass if you only show a thumbs up.
- Liveness is checked using MediaPipe and OpenCV on the backend.

---

## API Endpoints (Backend)
- `POST /unlock_face` — Face recognition from video/image (step 1)
- `POST /challenge_liveness` — Liveness/gesture verification (step 2)
- `POST /add_face` — Add a new face (image + name)
- `POST /upload_video` — Add face via video (frames extracted automatically)

---

## Troubleshooting & Tips
- **Face not recognized?**
  - Make sure your face is clearly visible and matches a registered face.
  - Add your face via the "Add Face" section if needed.
- **Gesture not detected?**
  - Perform the exact gesture shown. Only the correct gesture will pass.
- **Camera not working?**
  - Check browser permissions and ensure no other app is using the webcam.
- **Backend errors?**
  - Check the backend terminal for error logs.

---

## Dependencies

### Backend
- fastapi, uvicorn, python-multipart, opencv-python, colorama, numpy, face_recognition

### Frontend
- react, react-dom, lucide-react, tailwindcss, vite, typescript, eslint, postcss

---

## Credits & Acknowledgements
- [face_recognition](https://github.com/ageitgey/face_recognition)
- [OpenCV](https://opencv.org/)
- [MediaPipe](https://mediapipe.dev/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [colorama](https://pypi.org/project/colorama/)
- [numpy](https://numpy.org/)

---

## License
This project is for educational and demonstration purposes. For production use, review and enhance security, privacy, and deployment practices. 
