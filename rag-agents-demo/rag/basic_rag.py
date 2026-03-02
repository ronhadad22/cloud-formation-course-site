import boto3
import json
import numpy as np
from typing import List, Dict
from vector_store import SimpleVectorStore


class BasicRAG:
    """
    Basic RAG implementation using AWS Bedrock.
    This demonstrates the core concepts of Retrieval-Augmented Generation.
    """
    
    def __init__(self, region_name: str = "us-east-1"):
        self.bedrock_runtime = boto3.client('bedrock-runtime', region_name=region_name)
        self.vector_store = SimpleVectorStore()
        self.embedding_model = "amazon.titan-embed-text-v1"
        self.llm_model = "anthropic.claude-3-sonnet-20240229-v1:0"
    
    def get_embedding(self, text: str) -> np.ndarray:
        """
        Get embedding vector for text using AWS Bedrock Titan Embeddings.
        """
        body = json.dumps({"inputText": text})
        
        response = self.bedrock_runtime.invoke_model(
            modelId=self.embedding_model,
            body=body,
            contentType="application/json",
            accept="application/json"
        )
        
        response_body = json.loads(response['body'].read())
        embedding = np.array(response_body['embedding'])
        return embedding
    
    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """
        Split text into overlapping chunks.
        This is important for handling long documents.
        """
        words = text.split()
        chunks = []
        
        for i in range(0, len(words), chunk_size - overlap):
            chunk = ' '.join(words[i:i + chunk_size])
            chunks.append(chunk)
        
        return chunks
    
    def add_documents(self, documents: List[str], metadata: List[Dict] = None):
        """
        Add documents to the vector store.
        Documents are chunked and embedded.
        """
        print(f"Processing {len(documents)} documents...")
        
        all_chunks = []
        all_metadata = []
        
        for idx, doc in enumerate(documents):
            chunks = self.chunk_text(doc)
            all_chunks.extend(chunks)
            
            doc_metadata = metadata[idx] if metadata else {}
            for chunk_idx, _ in enumerate(chunks):
                chunk_metadata = {
                    **doc_metadata,
                    'doc_index': idx,
                    'chunk_index': chunk_idx
                }
                all_metadata.append(chunk_metadata)
        
        print(f"Created {len(all_chunks)} chunks. Generating embeddings...")
        
        embeddings = []
        for i, chunk in enumerate(all_chunks):
            if i % 10 == 0:
                print(f"  Embedding chunk {i+1}/{len(all_chunks)}")
            embedding = self.get_embedding(chunk)
            embeddings.append(embedding)
        
        self.vector_store.add_documents(all_chunks, embeddings, all_metadata)
        print(f"✓ Added {len(all_chunks)} chunks to vector store")
    
    def retrieve(self, query: str, top_k: int = 3) -> List[Dict]:
        """
        Retrieve most relevant documents for a query.
        """
        query_embedding = self.get_embedding(query)
        results = self.vector_store.search(query_embedding, top_k=top_k)
        
        retrieved_docs = []
        for doc, score, metadata in results:
            retrieved_docs.append({
                'content': doc,
                'score': score,
                'metadata': metadata
            })
        
        return retrieved_docs
    
    def generate_response(self, query: str, context: List[str]) -> str:
        """
        Generate response using retrieved context and Claude.
        """
        context_text = "\n\n".join([f"Document {i+1}:\n{doc}" for i, doc in enumerate(context)])
        
        prompt = f"""You are a helpful assistant. Answer the question based on the provided context.

Context:
{context_text}

Question: {query}

Answer based on the context above. If the context doesn't contain relevant information, say so."""
        
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        })
        
        response = self.bedrock_runtime.invoke_model(
            modelId=self.llm_model,
            body=body,
            contentType="application/json",
            accept="application/json"
        )
        
        response_body = json.loads(response['body'].read())
        return response_body['content'][0]['text']
    
    def query(self, question: str, top_k: int = 3) -> Dict:
        """
        Complete RAG pipeline: retrieve relevant docs and generate answer.
        """
        print(f"\n🔍 Query: {question}")
        print(f"📚 Retrieving top {top_k} relevant documents...")
        
        retrieved_docs = self.retrieve(question, top_k=top_k)
        
        print(f"✓ Found {len(retrieved_docs)} relevant documents")
        for i, doc in enumerate(retrieved_docs):
            print(f"  Doc {i+1} - Score: {doc['score']:.4f}")
        
        context = [doc['content'] for doc in retrieved_docs]
        
        print(f"🤖 Generating response...")
        answer = self.generate_response(question, context)
        
        return {
            'question': question,
            'answer': answer,
            'retrieved_documents': retrieved_docs
        }


def main():
    """
    Demo: Build a simple RAG system with sample documents.
    """
    print("=" * 60)
    print("Basic RAG Demo - AWS Bedrock")
    print("=" * 60)
    
    sample_documents = [
        """
        Amazon Web Services (AWS) is a comprehensive cloud computing platform provided by Amazon.
        It offers over 200 services including computing power, storage, databases, machine learning,
        analytics, and more. AWS was launched in 2006 and has become the leading cloud provider globally.
        """,
        """
        AWS Lambda is a serverless compute service that lets you run code without provisioning or
        managing servers. You pay only for the compute time you consume. Lambda automatically scales
        your application by running code in response to triggers such as HTTP requests, database changes,
        or file uploads to S3.
        """,
        """
        Amazon S3 (Simple Storage Service) is an object storage service offering industry-leading
        scalability, data availability, security, and performance. S3 is designed for 99.999999999%
        durability and stores data for millions of applications. It can be used for backup, archiving,
        big data analytics, and static website hosting.
        """,
        """
        Amazon Bedrock is a fully managed service that makes foundation models (FMs) from leading
        AI companies available through an API. With Bedrock, you can experiment with and evaluate
        top FMs, customize them with your data using techniques like fine-tuning and RAG, and build
        agents that execute tasks using your enterprise systems and data sources.
        """
    ]
    
    metadata = [
        {'source': 'aws_overview', 'category': 'general'},
        {'source': 'aws_lambda_docs', 'category': 'compute'},
        {'source': 'aws_s3_docs', 'category': 'storage'},
        {'source': 'aws_bedrock_docs', 'category': 'ai'}
    ]
    
    rag = BasicRAG(region_name="us-east-1")
    
    rag.add_documents(sample_documents, metadata)
    
    questions = [
        "What is AWS Lambda and how does it work?",
        "Tell me about Amazon Bedrock",
        "What storage options does AWS provide?"
    ]
    
    for question in questions:
        result = rag.query(question, top_k=2)
        print(f"\n💬 Answer:\n{result['answer']}")
        print("\n" + "-" * 60)


if __name__ == "__main__":
    main()
