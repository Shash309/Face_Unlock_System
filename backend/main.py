from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from face_recognizer import FaceRecognizer
import os
import shutil
import cv2
import subprocess
import mediapipe as mp
import numpy as np


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
        score = float(score_raw)

        # Only succeed if a face is detected and matched
        if match_status == "No Match" or name == "Unknown" or score <= 0.5:
            return JSONResponse(content={
                "success": False,
                "identity": name,
                "score": score,
                "processed_image": processed_image,
                "error": "No face detected or face not recognized. Please try again or add your face."
            })

        return JSONResponse(content={
            "success": True,
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

@app.post("/upload_video")
async def upload_video(video: UploadFile = File(...), name: str = None):
    try:
        print(f"Received file: {video.filename}, Content-Type: {video.content_type}")
        # Create videos directory if it doesn't exist
        videos_dir = "videos"
        if not os.path.exists(videos_dir):
            os.makedirs(videos_dir)
        
        # Save the uploaded video
        video_path = os.path.join(videos_dir, "face_video.webm")
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(video.file, buffer)
        
        # --- Frame Extraction ---
        frames_dir = os.path.join(videos_dir, "frames")
        if not os.path.exists(frames_dir):
            os.makedirs(frames_dir)
        # Remove old frames
        for f in os.listdir(frames_dir):
            os.remove(os.path.join(frames_dir, f))
        
        cap = cv2.VideoCapture(video_path)
        print("OpenCV opened video:", cap.isOpened())
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        print("Total frames in video:", total_frames)
        # If OpenCV can't open .webm or frame count is invalid, convert to .mp4 and try again
        if (not cap.isOpened()) or (total_frames is None) or (total_frames <= 0) or (total_frames > 10000):
            print("Trying to convert .webm to .mp4 for OpenCV compatibility...")
            mp4_path = os.path.join(videos_dir, "face_video.mp4")
            subprocess.run([
                "ffmpeg", "-y", "-i", video_path, mp4_path
            ], check=True)
            cap.release()
            cap = cv2.VideoCapture(mp4_path)
            print("OpenCV opened mp4 video:", cap.isOpened())
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            print("Total frames in mp4 video:", total_frames)
        if (not cap.isOpened()) or (total_frames is None) or (total_frames <= 0) or (total_frames > 10000):
            print("ERROR: Could not extract frames from video. Skipping frame extraction.")
            cap.release()
            return JSONResponse(content={
                "success": False,
                "message": "Video uploaded, but frame extraction failed (invalid video or codec)",
                "video_path": video_path,
                "frames_dir": frames_dir,
                "name": name
            })
        num_extract = 10
        if total_frames < num_extract:
            num_extract = total_frames
        frame_indices = [int(i * total_frames / num_extract) for i in range(num_extract)]
        extracted = 0
        idx = 0
        while cap.isOpened() and extracted < num_extract:
            ret, frame = cap.read()
            if not ret:
                break
            if idx in frame_indices:
                frame_path = os.path.join(frames_dir, f"frame_{extracted+1:02d}.jpg")
                cv2.imwrite(frame_path, frame)
                extracted += 1
            idx += 1
        cap.release()
        
        # --- Liveness Detection ---
        mp_face_mesh = mp.solutions.face_mesh
        liveness_report = {
            'blink': False,
            'mouth_movement': False,
            'head_movement': False,
            'details': {}
        }
        EAR_THRESH = 0.21
        MAR_THRESH = 0.6
        min_head_movement = 10  # pixels
        left_eye_idx = [33, 160, 158, 133, 153, 144]
        right_eye_idx = [362, 385, 387, 263, 373, 380]
        mouth_idx = [61, 291, 81, 178, 13, 14, 17, 402, 318, 324, 308, 415]
        nose_idx = 1
        all_ear = []
        all_mar = []
        all_nose_x = []
        all_nose_y = []
        with mp_face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True) as face_mesh:
            for i in range(1, extracted+1):
                frame_path = os.path.join(frames_dir, f"frame_{i:02d}.jpg")
                image = cv2.imread(frame_path)
                if image is None:
                    continue
                rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                results = face_mesh.process(rgb)
                if not results.multi_face_landmarks:
                    continue
                landmarks = results.multi_face_landmarks[0].landmark
                h, w, _ = image.shape
                # Eye aspect ratio (EAR)
                def get_ear(indices):
                    p = [landmarks[idx] for idx in indices]
                    p = [(int(pt.x * w), int(pt.y * h)) for pt in p]
                    A = np.linalg.norm(np.array(p[1]) - np.array(p[5]))
                    B = np.linalg.norm(np.array(p[2]) - np.array(p[4]))
                    C = np.linalg.norm(np.array(p[0]) - np.array(p[3]))
                    ear = (A + B) / (2.0 * C)
                    return ear
                left_ear = get_ear(left_eye_idx)
                right_ear = get_ear(right_eye_idx)
                avg_ear = (left_ear + right_ear) / 2.0
                all_ear.append(avg_ear)
                # Mouth aspect ratio (MAR)
                def get_mar(indices):
                    p = [landmarks[idx] for idx in indices]
                    p = [(int(pt.x * w), int(pt.y * h)) for pt in p]
                    A = np.linalg.norm(np.array(p[2]) - np.array(p[10]))
                    B = np.linalg.norm(np.array(p[4]) - np.array(p[8]))
                    C = np.linalg.norm(np.array(p[0]) - np.array(p[6]))
                    mar = (A + B) / (2.0 * C)
                    return mar
                mar = get_mar(mouth_idx)
                all_mar.append(mar)
                # Nose position for head movement
                nose = landmarks[nose_idx]
                all_nose_x.append(nose.x * w)
                all_nose_y.append(nose.y * h)
        # Blink detection: EAR drops below threshold in any frame
        if len(all_ear) > 1 and min(all_ear) < EAR_THRESH and max(all_ear) > EAR_THRESH:
            liveness_report['blink'] = True
        liveness_report['details']['ear'] = all_ear
        # Mouth movement: MAR changes significantly
        if len(all_mar) > 1 and (max(all_mar) - min(all_mar)) > MAR_THRESH:
            liveness_report['mouth_movement'] = True
        # Head movement: nose x/y changes significantly
        if len(all_nose_x) > 1 and (max(all_nose_x) - min(all_nose_x) > min_head_movement or max(all_nose_y) - min(all_nose_y) > min_head_movement):
            liveness_report['head_movement'] = True
        liveness_report['details']['nose_x'] = all_nose_x
        liveness_report['details']['nose_y'] = all_nose_y
        # Final liveness decision: at least 2 of 3
        liveness_score = sum([liveness_report['blink'], liveness_report['mouth_movement'], liveness_report['head_movement']])
        liveness_report['liveness'] = liveness_score >= 2
        liveness_report['score'] = liveness_score
        
        return JSONResponse(content={
            "success": True,
            "message": f"Video uploaded and {extracted} frames extracted",
            "video_path": video_path,
            "frames_dir": frames_dir,
            "name": name,
            "liveness_report": liveness_report
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to upload video: {str(e)}"}
        )

@app.post("/unlock_video")
async def unlock_video(video: UploadFile = File(...), challenge: str = None):
    try:
        print(f"Received unlock video: {video.filename}, Content-Type: {video.content_type}, Challenge: {challenge}")
        videos_dir = "videos"
        if not os.path.exists(videos_dir):
            os.makedirs(videos_dir)
        video_path = os.path.join(videos_dir, "unlock_face_video.webm")
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(video.file, buffer)
        # Frame extraction (reuse logic)
        frames_dir = os.path.join(videos_dir, "unlock_frames")
        if not os.path.exists(frames_dir):
            os.makedirs(frames_dir)
        for f in os.listdir(frames_dir):
            os.remove(os.path.join(frames_dir, f))
        cap = cv2.VideoCapture(video_path)
        print("OpenCV opened video:", cap.isOpened())
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        print("Total frames in video:", total_frames)
        if (not cap.isOpened()) or (total_frames is None) or (total_frames <= 0) or (total_frames > 10000):
            print("Trying to convert .webm to .mp4 for OpenCV compatibility...")
            mp4_path = os.path.join(videos_dir, "unlock_face_video.mp4")
            subprocess.run([
                "ffmpeg", "-y", "-i", video_path, mp4_path
            ], check=True)
            cap.release()
            cap = cv2.VideoCapture(mp4_path)
            print("OpenCV opened mp4 video:", cap.isOpened())
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            print("Total frames in mp4 video:", total_frames)
        if (not cap.isOpened()) or (total_frames is None) or (total_frames <= 0) or (total_frames > 10000):
            print("ERROR: Could not extract frames from video. Skipping frame extraction.")
            cap.release()
            return JSONResponse(content={
                "success": False,
                "message": "Video uploaded, but frame extraction failed (invalid video or codec)",
                "video_path": video_path,
                "frames_dir": frames_dir
            })
        num_extract = 10
        if total_frames < num_extract:
            num_extract = total_frames
        frame_indices = [int(i * total_frames / num_extract) for i in range(num_extract)]
        extracted = 0
        idx = 0
        frame_paths = []
        while cap.isOpened() and extracted < num_extract:
            ret, frame = cap.read()
            if not ret:
                break
            if idx in frame_indices:
                frame_path = os.path.join(frames_dir, f"frame_{extracted+1:02d}.jpg")
                cv2.imwrite(frame_path, frame)
                frame_paths.append(frame_path)
                extracted += 1
            idx += 1
        cap.release()
        # --- Liveness Detection (challenge-specific) ---
        mp_face_mesh = mp.solutions.face_mesh
        liveness_report = {
            'challenge': challenge,
            'challenge_passed': False,
            'blink': False,
            'turn_left': False,
            'turn_right': False,
            'open_mouth': False,
            'smile': False,
            'mouth_movement': False,
            'head_movement': False,
            'details': {}
        }
        EAR_THRESH = 0.21
        MAR_THRESH = 0.6
        min_head_movement = 10  # pixels
        left_eye_idx = [33, 160, 158, 133, 153, 144]
        right_eye_idx = [362, 385, 387, 263, 373, 380]
        mouth_idx = [61, 291, 81, 178, 13, 14, 17, 402, 318, 324, 308, 415]
        smile_idx = [61, 291, 78, 308, 13, 14, 17, 402, 318, 324, 308, 415]
        nose_idx = 1
        all_ear = []
        all_mar = []
        all_nose_x = []
        all_nose_y = []
        all_smile = []
        with mp_face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True) as face_mesh:
            for frame_path in frame_paths:
                image = cv2.imread(frame_path)
                if image is None:
                    continue
                rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                results = face_mesh.process(rgb)
                if not results.multi_face_landmarks:
                    continue
                landmarks = results.multi_face_landmarks[0].landmark
                h, w, _ = image.shape
                def get_ear(indices):
                    p = [landmarks[idx] for idx in indices]
                    p = [(int(pt.x * w), int(pt.y * h)) for pt in p]
                    A = np.linalg.norm(np.array(p[1]) - np.array(p[5]))
                    B = np.linalg.norm(np.array(p[2]) - np.array(p[4]))
                    C = np.linalg.norm(np.array(p[0]) - np.array(p[3]))
                    ear = (A + B) / (2.0 * C)
                    return ear
                left_ear = get_ear(left_eye_idx)
                right_ear = get_ear(right_eye_idx)
                avg_ear = (left_ear + right_ear) / 2.0
                all_ear.append(avg_ear)
                def get_mar(indices):
                    p = [landmarks[idx] for idx in indices]
                    p = [(int(pt.x * w), int(pt.y * h)) for pt in p]
                    A = np.linalg.norm(np.array(p[2]) - np.array(p[10]))
                    B = np.linalg.norm(np.array(p[4]) - np.array(p[8]))
                    C = np.linalg.norm(np.array(p[0]) - np.array(p[6]))
                    mar = (A + B) / (2.0 * C)
                    return mar
                mar = get_mar(mouth_idx)
                all_mar.append(mar)
                # Smile: difference between mouth corners and top/bottom
                smile_val = abs(landmarks[61].y - landmarks[291].y) / (abs(landmarks[13].y - landmarks[14].y) + 1e-6)
                all_smile.append(smile_val)
                # Nose position for head movement
                nose = landmarks[nose_idx]
                all_nose_x.append(nose.x * w)
                all_nose_y.append(nose.y * h)
        # Blink detection: EAR drops below threshold in any frame
        if len(all_ear) > 1 and min(all_ear) < EAR_THRESH and max(all_ear) > EAR_THRESH:
            liveness_report['blink'] = True
        # Mouth movement: MAR changes significantly
        if len(all_mar) > 1 and (max(all_mar) - min(all_mar)) > MAR_THRESH:
            liveness_report['mouth_movement'] = True
        # Head movement: nose x/y changes significantly
        if len(all_nose_x) > 1 and (max(all_nose_x) - min(all_nose_x) > min_head_movement or max(all_nose_y) - min(all_nose_y) > min_head_movement):
            liveness_report['head_movement'] = True
        # Turn left: nose x decreases significantly
        if len(all_nose_x) > 1 and (all_nose_x[0] - min(all_nose_x) > min_head_movement):
            liveness_report['turn_left'] = True
        # Turn right: nose x increases significantly
        if len(all_nose_x) > 1 and (max(all_nose_x) - all_nose_x[0] > min_head_movement):
            liveness_report['turn_right'] = True
        # Open mouth: MAR exceeds threshold in any frame
        if len(all_mar) > 1 and max(all_mar) > 0.8:
            liveness_report['open_mouth'] = True
        # Smile: smile_val increases significantly
        if len(all_smile) > 1 and (max(all_smile) - min(all_smile)) > 0.15:
            liveness_report['smile'] = True
        liveness_report['details']['ear'] = all_ear
        liveness_report['details']['mar'] = all_mar
        liveness_report['details']['nose_x'] = all_nose_x
        liveness_report['details']['nose_y'] = all_nose_y
        liveness_report['details']['smile'] = all_smile
        # Challenge-specific pass
        if challenge == 'blink' and liveness_report['blink']:
            liveness_report['challenge_passed'] = True
        elif challenge == 'turn_left' and liveness_report['turn_left']:
            liveness_report['challenge_passed'] = True
        elif challenge == 'turn_right' and liveness_report['turn_right']:
            liveness_report['challenge_passed'] = True
        elif challenge == 'open_mouth' and liveness_report['open_mouth']:
            liveness_report['challenge_passed'] = True
        elif challenge == 'smile' and liveness_report['smile']:
            liveness_report['challenge_passed'] = True
        # Only pass liveness if challenge is met
        liveness_report['liveness'] = liveness_report['challenge_passed']
        liveness_report['score'] = liveness_report['challenge_passed'] # Changed to challenge_passed
        # --- Face Recognition if liveness passed ---
        recognition_result = None
        if liveness_report['liveness']:
            best_score = -1
            best_identity = None
            best_processed_image = None
            best_match_status = False
            for frame_path in frame_paths:
                _, buffer = cv2.imencode('.jpg', cv2.imread(frame_path))
                import base64
                img_base64 = base64.b64encode(buffer).decode('utf-8')
                match_status, score_raw, processed_image, name = recognizer.recognize(f"data:image/jpeg;base64,{img_base64}")
                score = float(score_raw)
                if score > best_score:
                    best_score = score
                    best_identity = name
                    best_processed_image = processed_image
                    best_match_status = bool(match_status)
            recognition_result = {
                "success": best_match_status,
                "identity": best_identity,
                "score": best_score,
                "processed_image": best_processed_image
            }
        return JSONResponse(content={
            "success": True,
            "liveness_report": liveness_report,
            "recognition_result": recognition_result
        })
    except Exception as e:
        import traceback
        print(f"ERROR: Exception in /unlock_video endpoint: {e}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to process unlock video: {str(e)}"}
        )

@app.post("/unlock_face")
async def unlock_face_api(video: UploadFile = File(None), image: str = Form(None)):
    try:
        # Accept either a video or a base64 image
        if video is not None:
            videos_dir = "videos"
            if not os.path.exists(videos_dir):
                os.makedirs(videos_dir)
            video_path = os.path.join(videos_dir, "unlock_face_video_step1.webm")
            with open(video_path, "wb") as buffer:
                shutil.copyfileobj(video.file, buffer)
            # Extract middle frame for recognition
            cap = cv2.VideoCapture(video_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            if not cap.isOpened() or total_frames <= 0 or total_frames > 10000:
                mp4_path = os.path.join(videos_dir, "unlock_face_video_step1.mp4")
                subprocess.run([
                    "ffmpeg", "-y", "-i", video_path, mp4_path
                ], check=True)
                cap.release()
                cap = cv2.VideoCapture(mp4_path)
                total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            if not cap.isOpened() or total_frames <= 0 or total_frames > 10000:
                return JSONResponse(content={"success": False, "message": "Could not process video for recognition."})
            mid_idx = total_frames // 2
            idx = 0
            frame = None
            while cap.isOpened():
                ret, f = cap.read()
                if not ret:
                    break
                if idx == mid_idx:
                    frame = f
                    break
                idx += 1
            cap.release()
            if frame is None:
                return JSONResponse(content={"success": False, "message": "Could not extract frame for recognition."})
            _, buffer = cv2.imencode('.jpg', frame)
            import base64
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            img_data = f"data:image/jpeg;base64,{img_base64}"
        elif image is not None:
            img_data = image
        else:
            return JSONResponse(content={"success": False, "message": "No video or image provided."})
        # Run recognition only
        match_status, score_raw, processed_image, name = recognizer.recognize(img_data)
        # Only succeed if a face is detected and matched
        if match_status != "Match" or name == "Unknown" or float(score_raw) <= 0.5:
            return JSONResponse(content={
                "success": False,
                "identity": name,
                "score": float(score_raw),
                "processed_image": processed_image,
                "error": "No face detected or face not recognized. Please try again with your face clearly visible."
            })
        return JSONResponse(content={
            "success": True,
            "identity": name,
            "score": float(score_raw),
            "processed_image": processed_image
        })
    except Exception as e:
        import traceback
        print(f"ERROR: Exception in /unlock_face endpoint: {e}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to process unlock face: {str(e)}"}
        )

@app.post("/challenge_liveness")
async def challenge_liveness(video: UploadFile = File(...), challenge: str = Form(...)):
    try:
        print(f"Received challenge video: {video.filename}, Challenge: {challenge}")
        videos_dir = "videos"
        if not os.path.exists(videos_dir):
            os.makedirs(videos_dir)
        video_path = os.path.join(videos_dir, "challenge_liveness_video.webm")
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(video.file, buffer)
        # Frame extraction (reuse logic)
        frames_dir = os.path.join(videos_dir, "challenge_frames")
        if not os.path.exists(frames_dir):
            os.makedirs(frames_dir)
        for f in os.listdir(frames_dir):
            os.remove(os.path.join(frames_dir, f))
        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        print(f"Total frames in video: {total_frames}")
        if (not cap.isOpened()) or (total_frames is None) or (total_frames <= 0) or (total_frames > 10000):
            mp4_path = os.path.join(videos_dir, "challenge_liveness_video.mp4")
            subprocess.run([
                "ffmpeg", "-y", "-i", video_path, mp4_path
            ], check=True)
            cap.release()
            cap = cv2.VideoCapture(mp4_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            print(f"Total frames in mp4 video: {total_frames}")
        if (not cap.isOpened()) or (total_frames is None) or (total_frames <= 0) or (total_frames > 10000):
            cap.release()
            print("ERROR: Could not process video for liveness.")
            return JSONResponse(content={"success": False, "message": "Could not process video for liveness."})
        num_extract = 10
        if total_frames < num_extract:
            num_extract = total_frames
        frame_indices = [int(i * total_frames / num_extract) for i in range(num_extract)]
        extracted = 0
        idx = 0
        frame_paths = []
        while cap.isOpened() and extracted < num_extract:
            ret, frame = cap.read()
            if not ret:
                break
            if idx in frame_indices:
                frame_path = os.path.join(frames_dir, f"frame_{extracted+1:02d}.jpg")
                cv2.imwrite(frame_path, frame)
                frame_paths.append(frame_path)
                extracted += 1
            idx += 1
        cap.release()
        print(f"Extracted {len(frame_paths)} frames for liveness analysis.")
        # --- Challenge-specific liveness detection (reuse logic from unlock_video) ---
        mp_face_mesh = mp.solutions.face_mesh
        mp_hands = mp.solutions.hands
        liveness_report = {
            'challenge': challenge,
            'challenge_passed': False,
            'blink': False,
            'turn_left': False,
            'turn_right': False,
            'open_mouth': False,
            'show_two_fingers': False,
            'show_one_hand': False,
            'thumbs_up': False,
            'mouth_movement': False,
            'head_movement': False,
            'details': {}
        }
        # Restore previous thresholds for gestures
        EAR_THRESH = 0.21
        MAR_THRESH = 0.4  # Previous value for open mouth
        min_head_movement = 8  # Previous value for head movement
        FINGER_CONFIDENCE = 0.05  # Allow tip to be just above pip
        left_eye_idx = [33, 160, 158, 133, 153, 144]
        right_eye_idx = [362, 385, 387, 263, 373, 380]
        mouth_idx = [61, 291, 81, 178, 13, 14, 17, 402, 318, 324, 308, 415]
        smile_idx = [61, 291, 78, 308, 13, 14, 17, 402, 318, 324, 308, 415]
        nose_idx = 1
        all_ear = []
        all_mar = []
        all_nose_x = []
        all_nose_y = []
        all_smile = []
        faces_detected = 0
        two_fingers_detected = False
        hand_detected = False
        smile_detected = False
        open_mouth_detected = False
        blink_detected = False
        thumbs_up_detected = False
        with mp_face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True) as face_mesh, \
             mp_hands.Hands(static_image_mode=True, max_num_hands=2, min_detection_confidence=0.7) as hands:
            for frame_path in frame_paths:
                image = cv2.imread(frame_path)
                if image is None:
                    print(f"Could not read frame: {frame_path}")
                    continue
                rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                # Face mesh processing (existing)
                results = face_mesh.process(rgb)
                if results.multi_face_landmarks:
                    landmarks = results.multi_face_landmarks[0].landmark
                    h, w, _ = image.shape
                    def get_ear(indices):
                        p = [landmarks[idx] for idx in indices]
                        p = [(int(pt.x * w), int(pt.y * h)) for pt in p]
                        A = np.linalg.norm(np.array(p[1]) - np.array(p[5]))
                        B = np.linalg.norm(np.array(p[2]) - np.array(p[4]))
                        C = np.linalg.norm(np.array(p[0]) - np.array(p[3]))
                        ear = (A + B) / (2.0 * C)
                        return ear
                    left_ear = get_ear(left_eye_idx)
                    right_ear = get_ear(right_eye_idx)
                    avg_ear = (left_ear + right_ear) / 2.0
                    all_ear.append(avg_ear)
                    def get_mar(indices):
                        p = [landmarks[idx] for idx in indices]
                        p = [(int(pt.x * w), int(pt.y * h)) for pt in p]
                        A = np.linalg.norm(np.array(p[2]) - np.array(p[10]))
                        B = np.linalg.norm(np.array(p[4]) - np.array(p[8]))
                        C = np.linalg.norm(np.array(p[0]) - np.array(p[6]))
                        mar = (A + B) / (2.0 * C)
                        return mar
                    mar = get_mar(mouth_idx)
                    all_mar.append(mar)
                    nose = landmarks[nose_idx]
                    all_nose_x.append(nose.x * w)
                    all_nose_y.append(nose.y * h)
                    # Blink detection: EAR drops below threshold in any frame
                    if avg_ear < EAR_THRESH:
                        blink_detected = True
                    # Open mouth detection
                    if mar > MAR_THRESH:
                        open_mouth_detected = True
                # Hand detection for new gestures
                hand_results = hands.process(rgb)
                if hand_results.multi_hand_landmarks:
                    hand_detected = True
                    for hand_landmarks in hand_results.multi_hand_landmarks:
                        finger_tips = [4, 8, 12, 16, 20]
                        finger_pips = [2, 6, 10, 14, 18]
                        fingers_up = []
                        for tip, pip in zip(finger_tips, finger_pips):
                            if hand_landmarks.landmark[tip].y < hand_landmarks.landmark[pip].y - FINGER_CONFIDENCE:
                                fingers_up.append(1)
                            else:
                                fingers_up.append(0)
                        num_fingers = sum(fingers_up)
                        if num_fingers == 2:
                            two_fingers_detected = True
                        # Thumbs up: only thumb is up
                        if fingers_up[0] == 1 and sum(fingers_up[1:]) == 0:
                            thumbs_up_detected = True
        # Debug print after all frames
        print(f"[DEBUG FINAL] blink_detected: {blink_detected}, open_mouth_detected: {open_mouth_detected}, two_fingers_detected: {two_fingers_detected}, hand_detected: {hand_detected}, thumbs_up_detected: {thumbs_up_detected}")
        liveness_report['show_two_fingers'] = two_fingers_detected
        liveness_report['show_one_hand'] = hand_detected
        liveness_report['thumbs_up'] = thumbs_up_detected
        # Only pass the requested gesture
        liveness_report['challenge_passed'] = False
        if challenge == 'blink' and blink_detected:
            liveness_report['challenge_passed'] = True
        elif challenge == 'open_mouth' and open_mouth_detected:
            liveness_report['challenge_passed'] = True
        elif challenge == 'show_two_fingers' and two_fingers_detected:
            liveness_report['challenge_passed'] = True
        elif challenge == 'show_one_hand' and hand_detected and not thumbs_up_detected:
            liveness_report['challenge_passed'] = True
        elif challenge == 'thumbs_up' and thumbs_up_detected:
            liveness_report['challenge_passed'] = True
        liveness_report['liveness'] = liveness_report['challenge_passed']
        liveness_report['score'] = sum([
            liveness_report['blink'],
            liveness_report['mouth_movement'],
            liveness_report['head_movement'],
            liveness_report['turn_left'],
            liveness_report['turn_right'],
            liveness_report['open_mouth']
        ])
        print(f"Final liveness_report: {liveness_report}")
        return JSONResponse(content={
            "success": liveness_report['liveness'],
            "liveness_report": liveness_report
        })
    except Exception as e:
        import traceback
        print(f"ERROR: Exception in /challenge_liveness endpoint: {e}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to process challenge liveness: {str(e)}"}
        )
