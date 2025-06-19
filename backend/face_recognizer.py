import cv2
import numpy as np
import base64
import os
import json
from colorama import Fore, Style, init
init(autoreset=True)

class FaceRecognizer:
    def __init__(self, reference_dir):
        print(Fore.CYAN + "FaceRecognizer: Initializing..." + Style.RESET_ALL)
        # Load the face detection cascade
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        if self.face_cascade.empty():
            print(Fore.RED + "FaceRecognizer: ERROR: Could not load face cascade. Check OpenCV installation." + Style.RESET_ALL)
        else:
            print(Fore.GREEN + "FaceRecognizer: Face cascade loaded successfully." + Style.RESET_ALL)
        
        # Initialize reference faces dictionary
        self.reference_faces = {}
        self.reference_dir = reference_dir
        self.metadata_file = os.path.join(reference_dir, 'face_metadata.json')
        
        # Create directory if it doesn't exist
        os.makedirs(reference_dir, exist_ok=True)
        
        # Load existing reference faces
        self._load_all_reference_faces()
        
        # Define colors for visualization
        self.colors = {
            'Match': (0, 255, 0),    # Green
            'No Match': (0, 0, 255)  # Red
        }
        print(Fore.CYAN + "FaceRecognizer: Initialization complete." + Style.RESET_ALL)

    def _load_all_reference_faces(self):
        """Load all reference faces from the directory"""
        # Load metadata if exists
        if os.path.exists(self.metadata_file):
            with open(self.metadata_file, 'r') as f:
                metadata = json.load(f)
        else:
            metadata = {}

        # Load each reference face
        for filename in os.listdir(self.reference_dir):
            if filename.endswith('.jpg') and filename != 'face_metadata.json':
                img_path = os.path.join(self.reference_dir, filename)
                try:
                    face_data = self._load_reference_face(img_path)
                    print(Fore.CYAN + f"DEBUG: _load_all_reference_faces: Loaded face_data for {filename}. Type: {type(face_data)}, Shape: {face_data.shape if isinstance(face_data, np.ndarray) else 'N/A'}" + Style.RESET_ALL)
                    if face_data is not None:
                        face_id = filename.replace('.jpg', '')
                        self.reference_faces[face_id] = {
                            'face': face_data,
                            'name': metadata.get(face_id, 'Unknown')
                        }
                except Exception as e:
                    print(Fore.RED + f"FaceRecognizer: ERROR loading {filename}: Type: {type(e)}, Repr: {repr(e)}, Error: {e}" + Style.RESET_ALL)

    def _load_reference_face(self, img_path):
        """Load a single reference face"""
        print(Fore.CYAN + f"FaceRecognizer: Attempting to load reference face from {img_path}" + Style.RESET_ALL)
        if not os.path.exists(img_path):
            raise FileNotFoundError(f"Reference image not found at {img_path}")
        
        img = cv2.imread(img_path)
        if img is None:
            raise Exception("Could not read reference image file. Check if it's a valid image.")
        
        # Convert to grayscale for face detection
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(faces) == 0:
            raise Exception("No face found in reference image. Try a different image or adjust detection parameters.")
        
        # Store the face region
        x, y, w, h = faces[0]
        face_roi = img[y:y+h, x:x+w]
        print(Fore.GREEN + "FaceRecognizer: Successfully loaded and detected reference face." + Style.RESET_ALL)
        return face_roi

    def add_reference_face(self, base64_image, name):
        """Add a new reference face"""
        # Decode base64 image
        img_data = base64.b64decode(base64_image.split(',')[-1])
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img is None:
            print(Fore.RED + "FaceRecognizer: ERROR: Could not decode image from base64" + Style.RESET_ALL)
            raise Exception("Could not decode image from base64")

        # Convert to grayscale for face detection
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(faces) == 0:
            print(Fore.RED + "FaceRecognizer: ERROR: No face found in the image" + Style.RESET_ALL)
            raise Exception("No face found in the image")
        
        # Get the face region
        x, y, w, h = faces[0]
        face_roi = img[y:y+h, x:x+w]
        
        # Generate new face ID
        face_id = f"reference{len(self.reference_faces) + 1}"
        
        # Save the face image
        face_path = os.path.join(self.reference_dir, f"{face_id}.jpg")
        cv2.imwrite(face_path, face_roi)
        
        # Update metadata
        metadata = {}
        if os.path.exists(self.metadata_file):
            with open(self.metadata_file, 'r') as f:
                metadata = json.load(f)
        
        metadata[face_id] = name
        with open(self.metadata_file, 'w') as f:
            json.dump(metadata, f)
        
        # Add to reference faces
        self.reference_faces[face_id] = {
            'face': face_roi,
            'name': name
        }
        
        print(Fore.GREEN + f"FaceRecognizer: Added face for label: {face_id}" + Style.RESET_ALL)
        return face_id

    def _compare_faces(self, face1, face2):
        # Resize both faces to the same size
        size = (100, 100)
        face1 = cv2.resize(face1, size)
        face2 = cv2.resize(face2, size)
        
        # Convert to grayscale
        face1_gray = cv2.cvtColor(face1, cv2.COLOR_BGR2GRAY)
        face2_gray = cv2.cvtColor(face2, cv2.COLOR_BGR2GRAY)
        
        # Calculate similarity using template matching
        result = cv2.matchTemplate(face1_gray, face2_gray, cv2.TM_CCOEFF_NORMED)
        similarity = np.max(result)
        return similarity

    def recognize(self, base64_image):
        print(Fore.CYAN + "FaceRecognizer: Starting recognition process..." + Style.RESET_ALL)
        if not self.reference_faces:
            print(Fore.RED + "FaceRecognizer: ERROR: No reference faces loaded." + Style.RESET_ALL)
            return "No Match", 0.0, None, "Unknown"

        # Decode base64 image
        img_data = base64.b64decode(base64_image.split(',')[-1])
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img is None:
            print(Fore.RED + "FaceRecognizer: ERROR: Could not decode image from base64." + Style.RESET_ALL)
            return "No Match", 0.0, None, "Unknown"

        # Convert to grayscale for face detection
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(faces) == 0:
            print(Fore.YELLOW + "FaceRecognizer: WARNING: No faces detected in the input image." + Style.RESET_ALL)
            return "No Match", 0.0, None, "Unknown"
        else:
            print(Fore.CYAN + f"FaceRecognizer: {len(faces)} face(s) detected in the input image." + Style.RESET_ALL)

        # Process each face
        best_similarity = -1
        best_face = None
        best_location = None
        best_name = "Unknown"

        for (x, y, w, h) in faces:
            face_roi = img[y:y+h, x:x+w]
            
            # Compare with all reference faces
            for face_id, face_data in self.reference_faces.items():
                similarity = self._compare_faces(face_roi, face_data['face'])
                print(Fore.CYAN + f"FaceRecognizer: Face similarity score with {face_id}: {similarity:.2f}" + Style.RESET_ALL)
                
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_face = face_roi
                    best_location = (x, y, w, h)
                    best_name = face_data['name']

        # Draw results on the image
        if best_location:
            x, y, w, h = best_location
            match_status = "Match" if best_similarity > 0.3 else "No Match"
            color = self.colors[match_status]
            cv2.rectangle(img, (x, y), (x+w, y+h), color, 2)
            label = f"{match_status} ({best_similarity:.2f})"
            cv2.putText(img, label, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

            if match_status == "Match":
                print(Fore.GREEN + f"FaceRecognizer: Face recognized successfully as {best_name} (score: {best_similarity:.2f})" + Style.RESET_ALL)
            else:
                print(Fore.YELLOW + "FaceRecognizer: WARNING: No matching face found" + Style.RESET_ALL)

        # Convert processed image back to base64
        _, buffer = cv2.imencode('.jpg', img)
        processed_image = base64.b64encode(buffer).decode('utf-8')
        
        return match_status, best_similarity, processed_image, best_name
