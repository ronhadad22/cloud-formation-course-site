# MLflow Basic Example

A simple demonstration of MLflow for tracking machine learning experiments.

## What is MLflow?

MLflow is an open-source platform for managing the ML lifecycle, including:
- **Tracking**: Log parameters, metrics, and artifacts
- **Projects**: Package ML code for reproducibility
- **Models**: Deploy models to various platforms
- **Registry**: Store and version models

## Project Structure

```
ml/
├── train.py           # Main training script with MLflow tracking
├── requirements.txt   # Python dependencies
├── README.md         # This file
└── mlruns/           # MLflow tracking data (created after first run)
```

## Setup

### 1. Create Virtual Environment

```bash
cd /Users/rwnhdd/Downloads/cloudformation/eks-v1.34/ml

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate     # On Windows
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

## Running the Example

### Train Models

Run the training script to create multiple experiments:

```bash
python train.py
```

This will:
1. Train 3 Random Forest models with different hyperparameters
2. Log parameters (n_estimators, max_depth)
3. Log metrics (accuracy, precision, recall, F1)
4. Log the trained models
5. Save feature importance

### View Results in MLflow UI

Start the MLflow tracking UI:

```bash
mlflow ui
```

Then open your browser to: **http://localhost:5000**

You'll see:
- All experiment runs
- Parameters and metrics for each run
- Model artifacts
- Comparison charts

## What the Script Does

### 1. Dataset
- Uses the Wine dataset from scikit-learn
- 178 samples, 13 features, 3 classes
- Classification task: predict wine type

### 2. Model
- Random Forest Classifier
- Trains with different hyperparameters:
  - Experiment 1: 100 trees, depth 5
  - Experiment 2: 200 trees, depth 5
  - Experiment 3: 100 trees, depth 10

### 3. MLflow Tracking

```python
# Start a run
with mlflow.start_run():
    # Log parameters
    mlflow.log_param("n_estimators", 100)
    
    # Log metrics
    mlflow.log_metric("accuracy", 0.95)
    
    # Log model
    mlflow.sklearn.log_model(model, "model")
```

## Key MLflow Concepts

### Experiments
- Organize related runs
- Set with: `mlflow.set_experiment("experiment-name")`

### Runs
- Single execution of ML code
- Tracks parameters, metrics, and artifacts
- Created with: `mlflow.start_run()`

### Parameters
- Input values (hyperparameters)
- Examples: learning_rate, n_estimators
- Log with: `mlflow.log_param(key, value)`

### Metrics
- Output measurements
- Examples: accuracy, loss, F1 score
- Log with: `mlflow.log_metric(key, value)`

### Artifacts
- Output files (models, plots, data)
- Log with: `mlflow.log_artifact(path)`

## Exercises for Students

### Exercise 1: Modify Hyperparameters
Try different values:
```python
train_model(n_estimators=50, max_depth=3)
train_model(n_estimators=300, max_depth=15)
```

### Exercise 2: Add More Metrics
Add confusion matrix or ROC-AUC:
```python
from sklearn.metrics import confusion_matrix, roc_auc_score

cm = confusion_matrix(y_test, y_pred)
mlflow.log_dict(cm.tolist(), "confusion_matrix.json")
```

### Exercise 3: Log Plots
Save and log a feature importance plot:
```python
import matplotlib.pyplot as plt

plt.figure(figsize=(10, 6))
plt.barh(wine.feature_names, model.feature_importances_)
plt.xlabel('Importance')
plt.title('Feature Importance')
plt.tight_layout()
plt.savefig('feature_importance.png')
mlflow.log_artifact('feature_importance.png')
```

### Exercise 4: Compare Models
Try different algorithms:
- Logistic Regression
- Support Vector Machine
- Gradient Boosting

### Exercise 5: Load and Use a Model
```python
# Load a logged model
model_uri = "runs:/<RUN_ID>/model"
loaded_model = mlflow.sklearn.load_model(model_uri)

# Make predictions
predictions = loaded_model.predict(X_test)
```

## MLflow UI Features

### Runs Table
- Compare parameters and metrics across runs
- Sort by any column
- Filter runs

### Run Details
- View all logged information
- Download artifacts
- Compare with other runs

### Charts
- Parallel coordinates plot
- Scatter plots
- Contour plots

### Model Registry
- Register best models
- Version models
- Stage models (Staging, Production)

## Best Practices

1. **Consistent Naming**: Use clear experiment and run names
2. **Log Everything**: Parameters, metrics, code version, data version
3. **Tag Runs**: Add tags for easy filtering
4. **Document**: Add descriptions to experiments and runs
5. **Version Data**: Track dataset versions
6. **Reproducibility**: Log random seeds and environment

## Common Commands

```bash
# Start UI
mlflow ui

# Start UI on different port
mlflow ui --port 5001

# View specific experiment
mlflow ui --backend-store-uri ./mlruns

# Delete an experiment
mlflow experiments delete --experiment-id <ID>

# Search runs
mlflow runs list --experiment-id <ID>
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Or use different port
mlflow ui --port 5001
```

### Cannot Find mlruns Directory
Make sure you're in the correct directory where you ran `train.py`

### Module Not Found
Activate virtual environment and reinstall:
```bash
source venv/bin/activate
pip install -r requirements.txt
```

## Next Steps

1. **MLflow Projects**: Package code for reproducibility
2. **MLflow Models**: Deploy models to production
3. **MLflow Registry**: Manage model lifecycle
4. **Remote Tracking**: Use remote MLflow server
5. **Integration**: Connect with AWS, Azure, or GCP

## Resources

- [MLflow Documentation](https://mlflow.org/docs/latest/index.html)
- [MLflow GitHub](https://github.com/mlflow/mlflow)
- [MLflow Tutorials](https://mlflow.org/docs/latest/tutorials-and-examples/index.html)

## Assignment Ideas

1. **Experiment Tracking**: Train 5 models with different hyperparameters and find the best one
2. **Model Comparison**: Compare 3 different algorithms on the same dataset
3. **Hyperparameter Tuning**: Use grid search and log all combinations
4. **Production Pipeline**: Create a script that loads the best model and makes predictions
5. **Custom Metrics**: Implement and log custom evaluation metrics
