# MLflow Exercises for Students

## Exercise 1: Basic Tracking (Beginner)

**Objective**: Get familiar with MLflow tracking basics

**Tasks**:
1. Run `train.py` and observe the output
2. Start MLflow UI with `mlflow ui`
3. Explore the UI:
   - Find the experiment runs
   - Compare parameters across runs
   - View metrics for each run
   - Download a model artifact

**Questions**:
- Which run had the highest accuracy?
- What parameters did that run use?
- How many runs are in the experiment?

---

## Exercise 2: Custom Experiments (Beginner)

**Objective**: Create your own experiments

**Tasks**:
1. Modify `train.py` to test these hyperparameters:
   - n_estimators: [50, 150, 250]
   - max_depth: [3, 7, 12]
2. Run all combinations (9 total runs)
3. Find the best combination

**Deliverable**: Screenshot of MLflow UI showing all runs

---

## Exercise 3: Model Comparison (Intermediate)

**Objective**: Compare different algorithms

**Tasks**:
1. Run `compare_models.py`
2. Analyze which model performs best
3. Add two more models:
   - Decision Tree
   - K-Nearest Neighbors
4. Compare all 6 models

**Questions**:
- Which model has the best accuracy?
- Which model has the most consistent CV scores?
- Which model trains fastest?

---

## Exercise 4: Advanced Metrics (Intermediate)

**Objective**: Log additional metrics and visualizations

**Tasks**:
1. Modify `train.py` to log:
   - Confusion matrix (as JSON)
   - ROC curve (as image)
   - Training time
   - Model size

**Code Template**:
```python
import time
import json
from sklearn.metrics import confusion_matrix
import matplotlib.pyplot as plt

# Time training
start_time = time.time()
model.fit(X_train, y_train)
training_time = time.time() - start_time
mlflow.log_metric("training_time", training_time)

# Confusion matrix
cm = confusion_matrix(y_test, y_pred)
mlflow.log_dict({"confusion_matrix": cm.tolist()}, "confusion_matrix.json")

# Plot and log
plt.figure()
# ... create your plot ...
plt.savefig("plot.png")
mlflow.log_artifact("plot.png")
```

---

## Exercise 5: Hyperparameter Tuning (Advanced)

**Objective**: Use grid search with MLflow tracking

**Tasks**:
1. Implement grid search for Random Forest
2. Log each combination as a separate run
3. Use MLflow to find the best hyperparameters

**Code Template**:
```python
from sklearn.model_selection import GridSearchCV

param_grid = {
    'n_estimators': [50, 100, 200],
    'max_depth': [3, 5, 10],
    'min_samples_split': [2, 5, 10]
}

mlflow.set_experiment("hyperparameter-tuning")

for n_est in param_grid['n_estimators']:
    for depth in param_grid['max_depth']:
        for split in param_grid['min_samples_split']:
            with mlflow.start_run():
                # Train and log
                pass
```

---

## Exercise 6: Model Registry (Advanced)

**Objective**: Use MLflow Model Registry

**Tasks**:
1. Train multiple models
2. Register the best model in the registry
3. Transition it through stages:
   - None → Staging → Production
4. Load the production model and make predictions

**Code Template**:
```python
# Register model
model_uri = f"runs:/{run_id}/model"
mlflow.register_model(model_uri, "wine-classifier")

# Transition to production
from mlflow.tracking import MlflowClient
client = MlflowClient()
client.transition_model_version_stage(
    name="wine-classifier",
    version=1,
    stage="Production"
)

# Load production model
model = mlflow.pyfunc.load_model("models:/wine-classifier/Production")
```

---

## Exercise 7: Custom Dataset (Advanced)

**Objective**: Apply MLflow to your own dataset

**Tasks**:
1. Choose a dataset from:
   - [UCI ML Repository](https://archive.ics.uci.edu/ml/index.php)
   - [Kaggle](https://www.kaggle.com/datasets)
   - Your own data
2. Create a new training script
3. Track experiments with MLflow
4. Compare at least 3 different models

**Requirements**:
- At least 10 experiment runs
- Log parameters, metrics, and models
- Create visualizations
- Document your findings in a report

---

## Exercise 8: Production Pipeline (Expert)

**Objective**: Create a complete ML pipeline

**Tasks**:
1. Create a data preprocessing script
2. Create a training script with MLflow
3. Create a prediction script that:
   - Loads the best model from MLflow
   - Makes predictions on new data
   - Logs prediction metrics
4. Create a script to monitor model performance over time

**Deliverable**: Complete pipeline with documentation

---

## Bonus Challenges

### Challenge 1: Remote Tracking
Set up a remote MLflow tracking server and connect to it

### Challenge 2: Docker Integration
Containerize your ML workflow with Docker

### Challenge 3: CI/CD Pipeline
Create a GitHub Actions workflow that:
- Runs training on push
- Logs results to MLflow
- Registers model if accuracy > threshold

### Challenge 4: Real-time Monitoring
Create a dashboard that shows:
- Recent experiment runs
- Model performance trends
- Best models by metric

---

## Grading Rubric

| Criteria | Points |
|----------|--------|
| Code Quality | 20 |
| MLflow Usage | 30 |
| Experimentation | 20 |
| Documentation | 15 |
| Insights/Analysis | 15 |
| **Total** | **100** |

---

## Submission Guidelines

1. Create a Git repository with your code
2. Include a README with:
   - Setup instructions
   - How to run your code
   - Summary of findings
3. Export MLflow runs (optional):
   ```bash
   mlflow experiments export --experiment-id <ID> --output runs.json
   ```
4. Submit:
   - GitHub repository link
   - Screenshots of MLflow UI
   - Written report (PDF)

---

## Tips for Success

1. **Start Simple**: Begin with basic tracking, then add complexity
2. **Be Consistent**: Use consistent naming for experiments and parameters
3. **Document Everything**: Add comments and descriptions
4. **Experiment Often**: Try many different approaches
5. **Compare Fairly**: Use the same data splits and random seeds
6. **Visualize Results**: Create plots to understand your models
7. **Ask Questions**: Don't hesitate to ask for help

---

## Common Mistakes to Avoid

❌ Not setting experiment names  
❌ Forgetting to log important parameters  
❌ Not using consistent random seeds  
❌ Logging too much or too little  
❌ Not organizing runs properly  
❌ Ignoring cross-validation  
❌ Not documenting findings  

---

## Additional Resources

- [MLflow Quickstart](https://mlflow.org/docs/latest/quickstart.html)
- [MLflow Tracking](https://mlflow.org/docs/latest/tracking.html)
- [Scikit-learn Documentation](https://scikit-learn.org/)
- [Python Data Science Handbook](https://jakevdp.github.io/PythonDataScienceHandbook/)
