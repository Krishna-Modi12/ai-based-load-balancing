# Model artifacts and data discipline

Generated `joblib` model artifacts stay out of Git. The API creates them here only after at least 20 successful, persisted calibration decisions exist. Each artifact is accompanied in PostgreSQL by a model version, timestamp, feature schema, sample count, MAE, and RMSE.

Training must use controlled calibration traffic distributed across healthy workers. Do not train solely from traffic already routed by the AI policy: that would make the dataset selection-biased. The local workers have deliberate synthetic delay profiles; resulting model and experiment claims apply only to that labelled local setting.

The feature schema is defined in `backend/app/ml.py`. Any model with a changed feature order/schema is rejected at load time and traffic falls back to Least Connections.
