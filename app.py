from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd

app = Flask(__name__)
CORS(app)

# Load the entire bundle
bundle = joblib.load("modelo_logistico_tiendas.pkl")

# If it's a dictionary, extract the model (commonly under 'model' or similar)
if isinstance(bundle, dict):
    model = bundle.get("model") or bundle.get("clf") or next(iter(bundle.values()))
    print("✅ Model extracted from dictionary.")
else:
    model = bundle
    print("✅ Model loaded directly.")

# Try to print feature names
try:
    print("📊 Model expects features:", model.feature_names_in_)
except AttributeError:
    print("⚠️ Model doesn't have 'feature_names_in_' attribute. Please confirm feature names manually.")

@app.route("/evaluate-site", methods=["POST"])
def evaluate_site():
    data = request.json
    print("🔍 Received data:", data)

    try:
        df = pd.DataFrame([data])
        print("🧠 DataFrame columns:", df.columns.tolist())

        prediction = model.predict(df)[0]
        probas = model.predict_proba(df)[0]
        score = round(float(probas[1]) * 100, 1)

        return jsonify({
            "recommendation": "Sí, buen lugar" if prediction else "No, mal lugar",
            "score": score,
            "reasons": [f"Predicción modelo: {score}% probabilidad de éxito"]
        })

    except Exception as e:
        print("❌ Server error:", str(e))  # This will help you debug
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)

