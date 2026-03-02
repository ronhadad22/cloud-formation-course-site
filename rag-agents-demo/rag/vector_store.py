import numpy as np
from typing import List, Dict, Tuple
import json


class SimpleVectorStore:
    """
    Simple in-memory vector store for educational purposes.
    Uses cosine similarity for retrieval.
    """
    
    def __init__(self):
        self.documents: List[str] = []
        self.embeddings: List[np.ndarray] = []
        self.metadata: List[Dict] = []
    
    def add_documents(self, documents: List[str], embeddings: List[np.ndarray], metadata: List[Dict] = None):
        """Add documents with their embeddings to the store."""
        self.documents.extend(documents)
        self.embeddings.extend(embeddings)
        
        if metadata:
            self.metadata.extend(metadata)
        else:
            self.metadata.extend([{}] * len(documents))
    
    def cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors."""
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        return dot_product / (norm1 * norm2)
    
    def search(self, query_embedding: np.ndarray, top_k: int = 3) -> List[Tuple[str, float, Dict]]:
        """
        Search for most similar documents.
        Returns list of (document, similarity_score, metadata) tuples.
        """
        if not self.embeddings:
            return []
        
        similarities = []
        for i, doc_embedding in enumerate(self.embeddings):
            similarity = self.cosine_similarity(query_embedding, doc_embedding)
            similarities.append((self.documents[i], similarity, self.metadata[i]))
        
        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:top_k]
    
    def save(self, filepath: str):
        """Save vector store to file."""
        data = {
            'documents': self.documents,
            'embeddings': [emb.tolist() for emb in self.embeddings],
            'metadata': self.metadata
        }
        with open(filepath, 'w') as f:
            json.dump(data, f)
    
    def load(self, filepath: str):
        """Load vector store from file."""
        with open(filepath, 'r') as f:
            data = json.load(f)
        
        self.documents = data['documents']
        self.embeddings = [np.array(emb) for emb in data['embeddings']]
        self.metadata = data['metadata']
    
    def __len__(self):
        return len(self.documents)


class FAISSVectorStore:
    """
    FAISS-based vector store for better performance with larger datasets.
    """
    
    def __init__(self, dimension: int = 1536):
        try:
            import faiss
            self.faiss = faiss
            self.dimension = dimension
            self.index = faiss.IndexFlatL2(dimension)
            self.documents: List[str] = []
            self.metadata: List[Dict] = []
        except ImportError:
            raise ImportError("Please install faiss-cpu: pip install faiss-cpu")
    
    def add_documents(self, documents: List[str], embeddings: List[np.ndarray], metadata: List[Dict] = None):
        """Add documents with their embeddings to the FAISS index."""
        embeddings_array = np.array(embeddings).astype('float32')
        self.index.add(embeddings_array)
        self.documents.extend(documents)
        
        if metadata:
            self.metadata.extend(metadata)
        else:
            self.metadata.extend([{}] * len(documents))
    
    def search(self, query_embedding: np.ndarray, top_k: int = 3) -> List[Tuple[str, float, Dict]]:
        """
        Search for most similar documents using FAISS.
        Returns list of (document, distance, metadata) tuples.
        """
        if len(self.documents) == 0:
            return []
        
        query_vector = np.array([query_embedding]).astype('float32')
        distances, indices = self.index.search(query_vector, min(top_k, len(self.documents)))
        
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < len(self.documents):
                results.append((self.documents[idx], float(dist), self.metadata[idx]))
        
        return results
    
    def __len__(self):
        return len(self.documents)
