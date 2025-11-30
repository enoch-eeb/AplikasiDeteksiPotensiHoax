import re
import json 
import os
import torch
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from langdetect import detect, LangDetectException
from newspaper import Article

app = Flask(__name__)
CORS(app)

app.config["JSON_SORT_KEYS"] = False

#fungsi untuk memuat stopwords
def load_stopwords(file_path):
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        json_path = os.path.join(base_dir, file_path)
        
        with open(json_path, 'r', encoding='utf-8') as f:
            stopwords_list = json.load(f)
            app.logger.info(f"Stopwords berhasil dimuat dari {file_path}")
            return set(stopwords_list)

    except FileNotFoundError:
        app.logger.error(f"File stopwords {file_path} tidak ditemukan.")
        return set()

    except Exception as e:
        app.logger.error(f"Error saat memuat stopwords: {e}")
        return set()

#limiter untuk mengatasi spam
limiter = Limiter(
    get_remote_address,
    default_limits=["200 per day", "10 per minute"]
)
@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({
        "status code": 429,
        "error": "Terlalu banyak permintaan. Silakan coba lagi nanti."
    }), 429
limiter.init_app(app)
limiter.on_breach = ratelimit_handleron_breach=ratelimit_handler
  
#konfigurasi logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

#load stopwords
STOPWORDS_FILE_PATH = "stopwords-id.json"
STOP_WORDS_ID_SET = load_stopwords(STOPWORDS_FILE_PATH)

#load model hasil fine tune
MODEL_PATH = "model_fineTuned_final"
try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
    app.logger.info(f"Model loaded successfully from {MODEL_PATH}")
except Exception as e:
    app.logger.error(f"Error loading model: {e}")
    exit()

#mapping label
label_map = {0: "Valid", 1: "Hoaks"}

#fungsi untuk preprocessing input teks agar sama dengan format teks pada model
def preprocess_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)
    text = re.sub(r'[^\w\s]', '', text)
    text = ' '.join(text.split())
    return text

#fungsi untuk menjalankan inferensi pada model
def run_model_prediction(clean_text: str) -> tuple[str, float]:
    inputs = tokenizer(clean_text, return_tensors="pt", truncation=True, padding=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
    probs = torch.softmax(outputs.logits, dim=-1)[0]
    predicted_class_id = torch.argmax(probs).item()
    predicted_label = label_map[predicted_class_id]
    confidence_score = probs[predicted_class_id].item()
    return predicted_label, confidence_score

def detect_language(text: str) -> str | None:
    try:
        if len(text.split()) > 2:
            return detect(text)
    except LangDetectException:
        app.logger.info(f"Language detection failed for text: '{text[:50]}...'")
    return None


#fungsi untuk mengecek keselarasasan judul dan isi
def cek_relevansi_judul_isi(clean_title: str, clean_content: str, min_overlap=1) -> bool:
    title_words = set(word for word in clean_title.split() if word not in STOP_WORDS_ID_SET)
    content_words = set(word for word in clean_content.split() if word not in STOP_WORDS_ID_SET)

    if not title_words or not content_words:
        return True

    overlap = len(title_words.intersection(content_words))

    return overlap >= min_overlap

#fungsi untuk validasi input
def validate_input(data: dict) -> tuple[str | None, tuple[dict, int] | None]:

    #validasi isi input
    title = data.get("title")
    content = data.get("content")
    if not title or not content:
        message = "Input tidak valid, field 'title' dan 'content' wajib diisi."
        app.logger.warning(message)
        return None, (jsonify({
            "status code": 400,
            "error": message
            }), 400)

    #text preprocessing
    clean_title = preprocess_text(title)
    clean_content = preprocess_text(content)

    #validasi relevansi judul dan isi
    if not cek_relevansi_judul_isi(clean_title, clean_content):
        message = "Judul dan isi berita terdeteksi tidak relevan."
        app.logger.warning(message)
        return None, (jsonify({"status code": 400, "error": message}), 400)
    
    #validasi penjagaan bahasa
    try:
        if (clean_title and detect(clean_title) != 'id') or \
           (clean_content and detect(clean_content) != 'id'):
            message = "Bahasa tidak didukung. Harap pastikan judul dan isi dalam Bahasa Indonesia."
            app.logger.warning(message)
            return None, (jsonify({
                "status code": 422,
                "error": message
                }), 422)
    except LangDetectException:
        app.logger.info("Language detection failed (likely due to short text), skipping check.")
        pass

    combined_text = f"{title}. {content}"
    cleaned_text = f"{clean_title} {clean_content}"

    #validasi teks tidak clean
    if not cleaned_text:
        message = "Input teks tidak mengandung kata yang bisa diproses."
        app.logger.warning(message)
        return None, (jsonify({
            "status code": 400,
            "error": message
            }), 400)

    #validasi penjagaan minimum kata
    MINIMUM_WORDS = 10
    if len(cleaned_text.split()) < MINIMUM_WORDS:
        message = f"Input kata terlalu pendek. Harap masukkan setidaknya {MINIMUM_WORDS} kata yang valid."
        app.logger.warning(message)
        return None, (jsonify({
            "status code": 400,
            "error": message
            }), 400)
            
    #validasi jika user memasukkan angka terlalu banyak
    words = cleaned_text.split()
    numeric_word_count = 0
    for word in words:
        if word.isdigit():
            numeric_word_count += 1
    total_word_count = len(words)
    MAX_NUMERIC_WORD_RATIO = 0.7 

    if total_word_count > 0 and (numeric_word_count / total_word_count) > MAX_NUMERIC_WORD_RATIO:
        message = "Input teks terdeteksi mengandung terlalu banyak angka dan kemungkinan bukan berita."
        app.logger.warning(message)
        return None, (jsonify({
            "status code": 400,
            "error": message
            }), 400)

    #validasi maksimum panjang input karakter
    MAX_LENGTH = 10000
    if len(combined_text) > MAX_LENGTH:
        message = f"Teks terlalu panjang. Maksimal {MAX_LENGTH} karakter."
        app.logger.warning(message)
        return None, (jsonify({
            "status code": 400,
            "error": message
            }), 400)

    return cleaned_text, None

@app.route("/predict", methods=["POST"])
@limiter.limit("5 per minute")
def predict_route():
    app.logger.info("Received a new prediction request.")
    try:
        data = request.get_json()

        #declare fungsi validasi text
        cleaned_text, error_response = validate_input(data)

        if error_response:
            return error_response

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

@app.route('/scrape', methods=['POST'])
def scrape_news():
    data = request.get_json()
    url = data.get('url')

    if not url:
        return jsonify({'error': 'URL tidak boleh kosong'}), 400

    try:
        article = Article(url)
        article.download()
        article.parse()

        return jsonify({
            'title': article.title,
            'content': article.text
        })

    except Exception as e:
        print(f"Error scraping: {e}")
        return jsonify({'error': 'Gagal mengambil berita. Pastikan link valid.'}), 500

if __name__ == "__main__":
    app.run(debug=False, host='0.0.0.0', port=5000)