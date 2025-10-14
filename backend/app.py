import re
import torch
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from langdetect import detect, LangDetectException

app = Flask(__name__)
CORS(app)

#limiter untuk mengatasi spam
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "10 per minute"]
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

MODEL_PATH = "hasil_model_latest"

try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
    app.logger.info(f"Model loaded successfully from {MODEL_PATH}")
except Exception as e:
    app.logger.error(f"Error loading model: {e}")
    exit()

#mapping label
label_map = {0: "Valid", 1: "Hoaks"}

def preprocess_text(text: str) -> str:
    """clean input teks agar sama dengan format teks pada model"""
    text = text.lower()
    text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)
    text = re.sub(r'[^\w\s]', '', text)
    text = ' '.join(text.split())
    return text

def run_model_prediction(clean_text: str) -> tuple[str, float]:
    """menjalankan inferensi pada teks yang sudah bersih"""
    inputs = tokenizer(clean_text, return_tensors="pt", truncation=True, padding=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
    probs = torch.softmax(outputs.logits, dim=-1)[0]
    predicted_class_id = torch.argmax(probs).item()
    predicted_label = label_map[predicted_class_id]
    confidence_score = probs[predicted_class_id].item()
    return predicted_label, confidence_score


@app.route("/predict", methods=["POST"])
@limiter.limit("5 per minute")
def predict_route():
    app.logger.info("Received a new prediction request.")
    try:
        data = request.get_json()
        
        #validasi input JSON
        title = data.get("title")
        content = data.get("content")

        if not title or not content:
            app.logger.warning("Invalid input: 'title' or 'content' field is missing or empty.")
            return jsonify({
                "status code": 400,
                "error": "Input tidak valid, field 'title' dan 'content' wajib diisi."
                }), 400

        combined_text = f"{title}. {content}"
        cleaned_text = preprocess_text(combined_text)
        
        #validasi minimum teks
        MINIMUM_WORDS = 5
        if len(cleaned_text.split()) < MINIMUM_WORDS:
            app.logger.warning(f"Input is too short after preprocessing. Word count: {len(cleaned_text.split())}")
            return jsonify({
                "status code": 400,
                "error": f"Input teks terlalu pendek. Harap masukkan setidaknya {MINIMUM_WORDS} kata yang valid."
                }), 400

        #validasi text cleaning
        if not cleaned_text:
            app.logger.warning("Input text becomes empty after preprocessing.")
            return jsonify({
                "status code": 400,
                "error": "Input teks tidak mengandung kata yang bisa diproses."
                }), 400

        #validasi bahasa indonesia
        try:
            #deteksi bahasa dari teks yang sudah bersih
            if detect(cleaned_text) != 'id':
                app.logger.warning("Detected language is not Indonesian.")
                return jsonify({
                    "status code": 400,
                    "error": "Bahasa tidak didukung. Harap masukkan teks dalam Bahasa Indonesia."
                    }), 400
        except LangDetectException:
            app.logger.info("Language detection failed (likely due to short text), skipping check.")
            pass

        #validasi panjang teks
        MAX_LENGTH = 10000
        if len(combined_text) > MAX_LENGTH:
            app.logger.warning(f"Input exceeds maximum length of {MAX_LENGTH} characters.")
            return jsonify({
                "status code": 400,
                "error": f"Teks terlalu panjang. Maksimal {MAX_LENGTH} karakter."
                }), 400

        label, confidence = run_model_prediction(cleaned_text)
        
        response = {
            "label": label,
            "confidence": round(confidence * 100, 2)
        }
        app.logger.info(f"Prediction successful: {response}")
        return jsonify(response), 200

    except Exception as e:
        app.logger.error(f"An error occurred on the server: {str(e)}", exc_info=True)
        return jsonify({
            "status code": 500,
            "error": f"Terjadi kesalahan di server: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=False, host='0.0.0.0', port=5000)