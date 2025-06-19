import cv2
import numpy as np
import base64
import os
import json
from colorama import Fore, Style, init
import re
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
        img = cv2.imread(img_path)
        if img is None:
            raise Exception("Could not read image.")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)

        if len(faces) == 0:
            raise Exception("No face found in reference image.")

        x, y, w, h = faces[0]
        return img[y:y+h, x:x+w]

    def add_reference_face(self, base64_image, name):
        img_data = base64.b64decode(base64_image.split(',')[-1])
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            raise Exception("Could not decode image from base64")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)

        if len(faces) == 0:
            raise Exception("No face found in the image")

        x, y, w, h = faces[0]
        face_roi = img[y:y+h, x:x+w]

        # Find the lowest available reference number
        existing_numbers = set()
        for fname in os.listdir(self.reference_dir):
            match = re.match(r'reference(\\d*)\.jpg', fname)
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

        self.reference_faces[face_filename] = {
            'face': face_roi,
            'name': name
        }

        print(Fore.GREEN + f"Added face for {name} with ID: {face_filename}" + Style.RESET_ALL)
        return face_id

    def _compare_faces(self, face1, face2):
        size = (100, 100)
        face1 = cv2.resize(face1, size)
        face2 = cv2.resize(face2, size)
        face1_gray = cv2.cvtColor(face1, cv2.COLOR_BGR2GRAY)
        face2_gray = cv2.cvtColor(face2, cv2.COLOR_BGR2GRAY)
        result = cv2.matchTemplate(face1_gray, face2_gray, cv2.TM_CCOEFF_NORMED)
        return np.max(result)

    def recognize(self, base64_image):
        print(Fore.CYAN + "Starting recognition..." + Style.RESET_ALL)
        if not self.reference_faces:
            return "No Match", 0.0, None, "Unknown"

        img_data = base64.b64decode(base64_image.split(',')[-1])
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            return "No Match", 0.0, None, "Unknown"

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)

        if len(faces) == 0:
            return "No Match", 0.0, None, "Unknown"

        best_similarity = -1
        best_location = None
        best_name = "Unknown"
        best_face_id = None
        match_status = "No Match"

        for (x, y, w, h) in faces:
            face_roi = img[y:y+h, x:x+w]

            for face_id, face_data in self.reference_faces.items():
                similarity = self._compare_faces(face_roi, face_data['face'])
                print(Fore.CYAN + f"Similarity with {face_id}: {similarity:.2f}" + Style.RESET_ALL)

                if similarity > best_similarity:
                    best_similarity = similarity
                    best_location = (x, y, w, h)
                    best_name = face_data['name']
                    best_face_id = face_id
                    match_status = "Match" if similarity > 0.3 else "No Match"

        # Always return 'Shashwat' if the best match is reference.jpg
        if best_face_id == 'reference.jpg':
            best_name = 'Shashwat'

        if best_location:
            x, y, w, h = best_location
            color = self.colors[match_status]
            label = f"{match_status} ({best_similarity:.2f})"
            cv2.rectangle(img, (x, y), (x+w, y+h), color, 2)
            cv2.putText(img, label, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

        _, buffer = cv2.imencode('.jpg', img)
        processed_image = base64.b64encode(buffer).decode('utf-8')

        return match_status, best_similarity, processed_image, best_name
