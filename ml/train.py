"""
Basic MLflow Example - Training a Simple Model
This script demonstrates MLflow tracking with a simple machine learning workflow
"""

import mlflow
import mlflow.sklearn
from sklearn.datasets import load_wine
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import numpy as np

def train_model(n_estimators=100, max_depth=5, random_state=42):
    """
    Train a Random Forest classifier on the Wine dataset
    
    Args:
        n_estimators: Number of trees in the forest
        max_depth: Maximum depth of the trees
        random_state: Random seed for reproducibility
    """
    
    # Set MLflow experiment
    mlflow.set_experiment("wine-classification")
    
    # Start MLflow run
    with mlflow.start_run():
        
        # Log parameters
        mlflow.log_param("n_estimators", n_estimators)
        mlflow.log_param("max_depth", max_depth)
        mlflow.log_param("random_state", random_state)
        
        # Load dataset
        print("Loading Wine dataset...")
        wine = load_wine()
        X = wine.data
        y = wine.target
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=random_state
        )
        
        print(f"Training set size: {len(X_train)}")
        print(f"Test set size: {len(X_test)}")
        
        # Train model
        print(f"\nTraining Random Forest with n_estimators={n_estimators}, max_depth={max_depth}...")
        model = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=random_state
        )
        model.fit(X_train, y_train)
        
        # Make predictions
        y_pred = model.predict(X_test)
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, average='weighted')
        recall = recall_score(y_test, y_pred, average='weighted')
        f1 = f1_score(y_test, y_pred, average='weighted')
        
        # Log metrics
        mlflow.log_metric("accuracy", accuracy)
        mlflow.log_metric("precision", precision)
        mlflow.log_metric("recall", recall)
        mlflow.log_metric("f1_score", f1)
        
        print(f"\nModel Performance:")
        print(f"  Accuracy:  {accuracy:.4f}")
        print(f"  Precision: {precision:.4f}")
        print(f"  Recall:    {recall:.4f}")
        print(f"  F1 Score:  {f1:.4f}")
        
        # Log feature importance
        feature_importance = dict(zip(wine.feature_names, model.feature_importances_))
        mlflow.log_dict(feature_importance, "feature_importance.json")
        
        # Log model
        mlflow.sklearn.log_model(model, "model")
        
        print(f"\n✓ Model logged to MLflow")
        print(f"✓ Run ID: {mlflow.active_run().info.run_id}")
        
        return model, accuracy

if __name__ == "__main__":
    print("=" * 60)
    print("MLflow Basic Example - Wine Classification")
    print("=" * 60)
    
    # Train with different hyperparameters
    print("\n--- Experiment 1: Default parameters ---")
    train_model(n_estimators=100, max_depth=5)
    
    print("\n--- Experiment 2: More trees ---")
    train_model(n_estimators=200, max_depth=5)
    
    print("\n--- Experiment 3: Deeper trees ---")
    train_model(n_estimators=100, max_depth=10)
    
    print("\n" + "=" * 60)
    print("All experiments completed!")
    print("View results with: mlflow ui")
    print("=" * 60)
