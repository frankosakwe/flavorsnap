

# Load once on startup
ML_MODEL, FOOD_LABELS = load_ml_components()

# Initialize XAI explainer after model is loaded
initialize_explainer(ML_MODEL, FOOD_LABELS)

# Image Preprocessing Transform
preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

# --- UTILS & MIDDLEWARE ---
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
)

def get_request_id() -> str:
    return request.headers.get("X-Request-ID", uuid.uuid4().hex)

def make_success_response(data: Dict[str, Any], status_code: int = 200):
    body = dict(data)
    body["request_id"] = get_request_id()
    return jsonify(body), status_code

# In-memory store (placeholder for DB)
_predictions_store = []

# --- ROUTES ---
@app.route('/predict', methods=['POST'])
@limiter.limit("10 per minute")
@track_inference
def predict():
    start_time = time.time()
    
    # 1. Validation
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    file = request.files['image']
    
    try:
        # 2. Inference Logic
        img_bytes = file.read()
        image = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        
        # Preprocess -> Tensor -> Model
        input_tensor = preprocess(image).unsqueeze(0)
        with torch.no_grad():
            outputs = ML_MODEL(input_tensor)
            probabilities = torch.nn.functional.softmax(outputs[0], dim=0)
            
            # Get Top 3 Predictions
            top3_prob, top3_idx = torch.topk(probabilities, 3)
        
        # 3. Format Response
        main_label = FOOD_LABELS[top3_idx[0].item()]
        main_conf = float(top3_prob[0].item())
        
        all_predictions = [
            {"label": FOOD_LABELS[idx.item()], "confidence": float(prob.item())}
            for prob, idx in zip(top3_prob, top3_idx)
        ]

        processing_time = round(time.time() - start_time, 4)
        pred_id = str(uuid.uuid4())
        
        response_data = {
            "id": pred_id,
            "label": main_label,
            "confidence": main_conf,
            "all_predictions": all_predictions,
            "processing_time": processing_time,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        # 4. Save to History
        _predictions_store.append(response_data)
        
        return make_success_response(response_data)

    except Exception as e:
        logger.error(f"Inference error: {str(e)}")
        return jsonify({'error': 'Inference failed', 'details': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'model_loaded': ML_MODEL is not None,
        'classes_count': len(FOOD_LABELS),
        'timestamp': time.time()
    })

@app.route('/analytics/usage', methods=['GET'])
def get_usage_stats():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    data = analytics.get_usage_stats(start_date, end_date)
    return jsonify(data)

@app.route('/analytics/performance', methods=['GET'])
def get_model_performance():
    data = analytics.get_model_performance()
    return jsonify(data)

@app.route('/analytics/engagement', methods=['GET'])
def get_user_engagement():
    data = analytics.get_user_engagement()
    return jsonify(data)

@app.route('/analytics/activity', methods=['GET'])
def get_real_time_activity():
    data = analytics.get_real_time_activity()
    return jsonify(data)

@app.route('/analytics/stats', methods=['GET'])
def get_stats_cards():
    data = analytics.get_stats_cards()
    return jsonify(data)

@app.route('/analytics/export', methods=['GET'])
def export_analytics():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    data = analytics.export_data(start_date, end_date)
    return jsonify(data)

@app.route('/analytics', methods=['GET'])
def get_all_analytics():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    data = {
        'usageStats': analytics.get_usage_stats(start_date, end_date),
        'modelPerformance': analytics.get_model_performance(),
        'userEngagement': analytics.get_user_engagement(),
        'statsCards': analytics.get_stats_cards(),
        'realTimeActivity': analytics.get_real_time_activity()
    }
    return jsonify(data)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'model_loaded': True,
        'version': '1.0.0',
        'analytics_enabled': True
    })

if __name__ == '__main__':
