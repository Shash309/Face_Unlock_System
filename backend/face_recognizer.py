import cv2
import numpy as np
import base64
import os
import json
from colorama import Fore, Style, init
import re
import face_recognition

init(autoreset=True)

class FaceRecognizer:
    def __init__(self, reference_dir):
        print(Fore.CYAN + "FaceRecognizer: Initializing..." + Style.RESET_ALL)
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        if self.face_cascade.empty():
            print(Fore.RED + "FaceRecognizer: ERROR: Could not load face cascade." + Style.RESET_ALL)
        else:
            print(Fore.GREEN + "FaceRecognizer: Face cascade loaded." + Style.RESET_ALL)
        
        self.reference_faces = {}
        self.reference_dir = reference_dir
        self.metadata_file = os.path.join(reference_dir, 'face_metadata.json')
        os.makedirs(reference_dir, exist_ok=True)
        self._load_all_reference_faces()

        self.colors = {
            'Match': (0, 255, 0),
            'No Match': (0, 0, 255)
        }
        print(Fore.CYAN + "FaceRecognizer: Initialization complete." + Style.RESET_ALL)

    def _load_all_reference_faces(self):
        if os.path.exists(self.metadata_file):
            with open(self.metadata_file, 'r') as f:
                metadata = json.load(f)
        else:
            metadata = {}

        for filename in os.listdir(self.reference_dir):
            if filename.endswith('.jpg') and filename != 'face_metadata.json':
                img_path = os.path.join(self.reference_dir, filename)
                try:
                    face_data = self._load_reference_face(img_path)
                    if face_data is not None:
                        self.reference_faces[filename] = {
                            'face': face_data,
                            'name': metadata.get(filename, 'Unknown')
                        }
                except Exception as e:
                    print(Fore.RED + f"Error loading {filename}: {e}" + Style.RESET_ALL)

    def _load_reference_face(self, img_path):
        img = face_recognition.load_image_file(img_path)
        encodings = face_recognition.face_encodings(img)

        if not encodings:
            raise Exception("No face found in reference image.")

        return encodings[0]

    def add_reference_face(self, base64_image, name):
        img_data = base64.b64decode(base64_image.split(',')[-1])
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            raise Exception("Could not decode image from base64")

        # The face_recognition library uses RGB images, but OpenCV uses BGR.
        # So, we need to convert from BGR to RGB.
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        face_locations = face_recognition.face_locations(rgb_img)
        if not face_locations:
            raise Exception("No face found in the image")

        # For adding a new face, we still save the cropped face image for reference,
        # but we'll use encodings for comparison.
        top, right, bottom, left = face_locations[0]
        face_roi = img[top:bottom, left:right]

        # Find the lowest available reference number
        existing_numbers = set()
        for fname in os.listdir(self.reference_dir):
            match = re.match(r'reference(\\d*)\\.jpg', fname)
            if match:
                num = match.group(1)
                if num == '':
                    existing_numbers.add(0)
                else:
                    existing_numbers.add(int(num))
        i = 1
        while i in existing_numbers:
            i += 1
        face_id = f"reference{i}"
        face_filename = f"{face_id}.jpg"
        face_path = os.path.join(self.reference_dir, face_filename)
        cv2.imwrite(face_path, face_roi)

        metadata = {}
        if os.path.exists(self.metadata_file):
            with open(self.metadata_file, 'r') as f:
                metadata = json.load(f)

        metadata[face_filename] = name
        with open(self.metadata_file, 'w') as f:
            json.dump(metadata, f)

        # Reload all faces to update the encodings in memory
        self._load_all_reference_faces()

        print(Fore.GREEN + f"Added face for {name} with ID: {face_filename}" + Style.RESET_ALL)
        return face_id

    def _compare_faces(self, known_encoding, unknown_encoding):
        """
        Compare a list of face encodings against a candidate encoding to see if they match.
        """
        # Returns a list of True/False values.
        matches = face_recognition.compare_faces([known_encoding], unknown_encoding)
        
        # face_distance returns a score for each face, the lower the score the more similar.
        # A typical cutoff for strict systems is 0.6.
        face_dist = face_recognition.face_distance([known_encoding], unknown_encoding)[0]
        
        # We'll convert distance to similarity: 1 - distance
        similarity = 1 - face_dist
        
        return matches[0], similarity

    def recognize(self, base64_image):
        print(Fore.CYAN + "Starting recognition..." + Style.RESET_ALL)
        if not self.reference_faces:
            return "No Match", 0.0, None, "Unknown"

        img_data = base64.b64decode(base64_image.split(',')[-1])
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            return "No Match", 0.0, None, "Unknown"

        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        face_locations = face_recognition.face_locations(rgb_img)
        unknown_encodings = face_recognition.face_encodings(rgb_img, face_locations)

        if not unknown_encodings:
            return "No Match", 0.0, None, "Unknown"

        best_similarity = -1
        best_match_name = "Unknown"
        best_location = None
        match_status = "No Match"

        # Loop through all the faces found in the unknown image
        for i, unknown_encoding in enumerate(unknown_encodings):
            top, right, bottom, left = face_locations[i]
            
            # See if the face is a match for the known face(s)
            for face_id, face_data in self.reference_faces.items():
                known_encoding = face_data['face'] # This is now an encoding
                
                is_match, similarity = self._compare_faces(known_encoding, unknown_encoding)
                
                print(Fore.CYAN + f"Similarity with {face_data['name']}: {similarity:.2f}" + Style.RESET_ALL)

                if is_match and similarity > best_similarity:
                    best_similarity = similarity
                    best_match_name = face_data['name']
                    best_location = (top, right, bottom, left)
        
        # A typical threshold for face_recognition library is around 0.6 for distance.
        # Since we converted it to similarity (1 - distance), our threshold will be 0.4.
        # Let's be a bit stricter, let's use 0.5
        if best_similarity > 0.5:
            match_status = "Match"
        else:
            match_status = "No Match"
            best_match_name = "Unknown"

        if best_location:
            top, right, bottom, left = best_location
            x, y, w, h = left, top, right - left, bottom - top # Convert to x,y,w,h for cv2.rectangle
            
            color = self.colors[match_status]
            label = f"{best_match_name} ({best_similarity:.2f})"
            cv2.rectangle(img, (x, y), (x+w, y+h), color, 2)
            cv2.putText(img, label, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

        _, buffer = cv2.imencode('.jpg', img)
        processed_image = base64.b64encode(buffer).decode('utf-8')

        return match_status, best_similarity, processed_image, best_match_name
