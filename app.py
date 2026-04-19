from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import pandas as pd
from textblob import TextBlob
import os, re, math, uuid
from collections import Counter

app = Flask(__name__)
CORS(app)

# Global Data Storage
df_data = pd.DataFrame()

def analyze_sentiment(text):
    if not text or str(text).lower() == 'nan': return 0, 'Neutral'
    pol = TextBlob(str(text)).sentiment.polarity
    return (pol, 'Positive') if pol > 0.1 else (pol, 'Negative') if pol < -0.1 else (pol, 'Neutral')

def load_data():
    global df_data
    file_path = 'reviews.csv'
    if not os.path.exists(file_path):
        print("❌ ERROR: 'reviews.csv' not found in the project folder!")
        return
    
    try:
        raw_df = pd.read_csv(file_path)
        print(f"📂 CSV Found! Columns detected: {list(raw_df.columns)}")
        
        # Auto-detect column names (handling case sensitivity)
        text_col = next((c for c in raw_df.columns if 'review' in c.lower()), None)
        rate_col = next((c for c in raw_df.columns if 'rating' in c.lower()), None)

        if not text_col:
            print("❌ ERROR: No 'review_text' column found. Please rename your CSV column.")
            return

        processed = []
        for _, row in raw_df.iterrows():
            text = str(row[text_col])
            if len(text) < 2: continue
            
            pol, sent = analyze_sentiment(text)
            processed.append({
                'review_id': str(uuid.uuid4()),
                'review_text': text,
                'rating': float(row[rate_col]) if rate_col and not pd.isna(row[rate_col]) else 0,
                'sentiment': sent,
                'polarity': pol
            })
        
        df_data = pd.DataFrame(processed)
        print(f"✅ SUCCESS: {len(df_data)} reviews processed and ready!")
    except Exception as e:
        print(f"❌ CRITICAL ERROR during load: {e}")

load_data()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/stats')
def get_stats():
    if df_data.empty: return jsonify({"error": "No data"}), 404
    
    sent_counts = df_data['sentiment'].value_counts().to_dict()
    # Ensure all keys exist for the chart
    for s in ['Positive', 'Negative', 'Neutral']:
        if s not in sent_counts: sent_counts[s] = 0
        
    rating_dist = df_data['rating'].apply(math.floor).value_counts().to_dict()
    
    return jsonify({
        "total_reviews": len(df_data),
        "average_rating": round(df_data['rating'].mean(), 1),
        "sentiments": sent_counts,
        "ratings": rating_dist
    })

@app.route('/reviews')
def get_reviews():
    return jsonify(df_data.to_dict(orient='records'))

@app.route('/report')
def get_report():
    if df_data.empty: return jsonify({"error": "No data"}), 404
    words = " ".join(df_data['review_text']).lower().split()
    keywords = Counter([w for w in words if len(w) > 4]).most_common(10)
    
    total = len(df_data)
    counts = df_data['sentiment'].value_counts().to_dict()
    
    return jsonify({
        "summary": {"total_reviews": total},
        "sentiment_analysis": {
            "counts": counts,
            "distribution_percentage": {k: round((v/total)*100, 1) for k, v in counts.items() if total > 0}
        },
        "top_keywords": [{"keyword": k, "count": v} for k, v in keywords]
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)