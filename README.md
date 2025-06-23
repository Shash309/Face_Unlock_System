# Face Unlock System

This project implements a web-based face unlock system with a React frontend and a FastAPI backend. The system allows users to initiate a face scan, capture an image, and compare it against a pre-defined reference face for access control.

## Features

- Web-based face recognition for access control
- React frontend with live webcam capture and user-friendly interface
- FastAPI backend for image processing and face comparison
- Add new reference faces dynamically (with name metadata)
- Real-time feedback: Access Granted/Denied with visual cues
- Confetti animation on successful unlock
- Logs and status sections for transparency
- Modular codebase for easy extension

## Scope of Work

**Included:**
- Single-user face unlock system (compares against one or more reference faces)
- Local image processing (no cloud upload)
- Basic UI for scanning, feedback, and adding faces
- Simple logging and status reporting

**Not Included:**
- Multi-user authentication or user management
- Advanced anti-spoofing or liveness detection
- Mobile app or deployment scripts
- Production-grade security hardening

## Citations & Acknowledgements

- [face_recognition](https://github.com/ageitgey/face_recognition): Python library for face detection and recognition
- [OpenCV](https://opencv.org/): Computer vision library for image processing
- [FastAPI](https://fastapi.tiangolo.com/): Web framework for the backend API
- [React](https://react.dev/): Frontend library for building user interfaces
- [Vite](https://vitejs.dev/): Frontend build tool
- [Tailwind CSS](https://tailwindcss.com/): Utility-first CSS framework
- [colorama](https://pypi.org/project/colorama/): For colored terminal output
- [numpy](https://numpy.org/): Numerical operations in Python

## Project Structure

```
task_2/
  - backend/
    - face_recognizer.py          # Core face recognition logic
    - main.py                     # FastAPI backend application
    - requirements.txt            # Python dependencies
    - static/
      - assets/                   # Frontend build assets
      - known_faces/              # Stores reference images (e.g., reference.jpg)
      - index.html                # Frontend entry point (served by backend)
  - frontend/
    - src/
      - App.tsx                   # Main React application component
      - components/               # React components (HomePage, StatusSection, etc.)
      - ... (other frontend files)
    - package.json                # Frontend dependencies and scripts
```

## Getting Started

Follow these steps to set up and run the Face Unlock System locally.

### Prerequisites

*   **Python 3.8+**: For the backend.
*   **pip**: Python package installer (usually comes with Python).
*   **Node.js (LTS recommended)**: For the frontend.
*   **npm** (Node Package Manager, usually comes with Node.js).
*   **A webcam**: Required for face scanning.

### 1. Backend Setup

Navigate to the `backend` directory and install the Python dependencies:

```bash
cd backend
pip install -r requirements.txt
```

**Important**: Ensure you have a reference image named `reference.jpg` placed in the `backend/static/known_faces/` directory. This image will be used to compare against scanned faces.

Run the FastAPI backend server:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000
```

The backend server will start on `http://127.0.0.1:8000`. Keep this terminal running.

### 2. Frontend Setup

Open a **new terminal** and navigate to the `frontend` directory:

```bash
cd frontend
```

Install the frontend dependencies:

```bash
npm install
```

Start the React development server:

```bash
npm run dev
```

The frontend application will typically open in your browser at `http://localhost:5173`.

### 3. Using the Application

1.  **Access the Frontend**: Open your web browser and navigate to `http://localhost:5173`.
2.  **Start Face Scan**: On the homepage, click the "Start Face Scan" button.
3.  **Camera Access**: Your browser will likely prompt you to grant camera access. Allow it.
4.  **Capture Photo**: Once the camera feed is visible, click the "Capture Photo" button. This will send your captured image to the backend for analysis.
5.  **View Results**:
    *   If your face matches the `reference.jpg` image, you will see an "Access Granted" message, along with a confetti animation.
    *   If your face does not match, you will see an "Access Denied" message.
6.  **Scan Again**: Click the "Scan Again" button to return to the homepage and initiate a new scan.

Enjoy your Face Unlock System! 
