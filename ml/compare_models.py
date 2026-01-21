"""
Compare Multiple ML Algorithms with MLflow
Demonstrates how to compare different models on the same dataset
"""

import mlflow
import mlflow.sklearn
from sklearn.datasets import load_wine
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, classification_report
import numpy as np

def evaluate_model(model, model_name, X_train, X_test, y_train, y_test):
    """
    Train and evaluate a model with MLflow tracking
    """
    with mlflow.start_run(run_name=model_name):
        
        # Log model type
        mlflow.log_param("model_type", model_name)
        mlflow.log_param("model_params", str(model.get_params()))
        
        # Train model
        print(f"\nTraining {model_name}...")
        model.fit(X_train, y_train)
        
        # Cross-validation score
        cv_scores = cross_val_score(model, X_train, y_train, cv=5)
        cv_mean = cv_scores.mean()
        cv_std = cv_scores.std()
        
        mlflow.log_metric("cv_mean", cv_mean)
        mlflow.log_metric("cv_std", cv_std)
        
        # Test predictions
        y_pred = model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        mlflow.log_metric("test_accuracy", accuracy)
        
        # Log classification report
        report = classification_report(y_test, y_pred, output_dict=True)
        for label, metrics in report.items():
            if isinstance(metrics, dict):
                for metric_name, value in metrics.items():
                    mlflow.log_metric(f"{label}_{metric_name}", value)
        
        # Log model
        mlflow.sklearn.log_model(model, "model")
        
        print(f"  CV Score: {cv_mean:.4f} (+/- {cv_std:.4f})")
        print(f"  Test Accuracy: {accuracy:.4f}")
        
        return accuracy

def main():
    print("=" * 70)
    print("MLflow Model Comparison - Wine Classification")
    print("=" * 70)
    
    # Set experiment
    mlflow.set_experiment("wine-model-comparison")
    
    # Load data
    print("\nLoading dataset...")
    wine = load_wine()
    X = wine.data
    y = wine.target
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    print(f"Training samples: {len(X_train)}")
    print(f"Test samples: {len(X_test)}")
    
    # Define models to compare
    models = {
        "Random Forest": RandomForestClassifier(n_estimators=100, random_state=42),
        "Gradient Boosting": GradientBoostingClassifier(n_estimators=100, random_state=42),
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
        "SVM": SVC(kernel='rbf', random_state=42)
    }
    
    # Train and evaluate each model
    results = {}
    for name, model in models.items():
        accuracy = evaluate_model(model, name, X_train, X_test, y_train, y_test)
        results[name] = accuracy
    
    # Print summary
    print("\n" + "=" * 70)
    print("Results Summary")
    print("=" * 70)
    for name, accuracy in sorted(results.items(), key=lambda x: x[1], reverse=True):
        print(f"{name:25s}: {accuracy:.4f}")
    
    print("\n" + "=" * 70)
    print("View detailed comparison in MLflow UI: mlflow ui")
    print("=" * 70)

if __name__ == "__main__":
    main()
