import boto3
import json
import numpy as np
from typing import List, Dict, Optional
from vector_store import FAISSVectorStore


class AdvancedRAG:
    """
    Advanced RAG implementation with conversation history and better retrieval.
    Demonstrates production-ready patterns for RAG systems.
    """
    
    def __init__(self, region_name: str = "us-east-1"):
        self.bedrock_runtime = boto3.client('bedrock-runtime', region_name=region_name)
        self.vector_store = FAISSVectorStore(dimension=1536)
        self.embedding_model = "amazon.titan-embed-text-v1"
        self.llm_model = "anthropic.claude-3-sonnet-20240229-v1:0"
        self.conversation_history: List[Dict] = []
    
    def get_embedding(self, text: str) -> np.ndarray:
        """Get embedding vector for text using AWS Bedrock Titan Embeddings."""
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
    
    def chunk_text_with_overlap(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """
        Advanced chunking with character-based splitting and overlap.
        Preserves sentence boundaries when possible.
        """
        sentences = text.replace('\n', ' ').split('. ')
        chunks = []
        current_chunk = []
        current_length = 0
        
        for sentence in sentences:
            sentence_length = len(sentence)
            
            if current_length + sentence_length > chunk_size and current_chunk:
                chunks.append('. '.join(current_chunk) + '.')
                overlap_sentences = current_chunk[-2:] if len(current_chunk) > 2 else current_chunk
                current_chunk = overlap_sentences
                current_length = sum(len(s) for s in current_chunk)
            
            current_chunk.append(sentence)
            current_length += sentence_length
        
        if current_chunk:
            chunks.append('. '.join(current_chunk) + '.')
        
        return chunks
    
    def add_documents(self, documents: List[str], metadata: List[Dict] = None):
        """Add documents to the vector store with advanced chunking."""
        print(f"Processing {len(documents)} documents with advanced chunking...")
        
        all_chunks = []
        all_metadata = []
        
        for idx, doc in enumerate(documents):
            chunks = self.chunk_text_with_overlap(doc)
            all_chunks.extend(chunks)
            
            doc_metadata = metadata[idx] if metadata else {}
            for chunk_idx, _ in enumerate(chunks):
                chunk_metadata = {
                    **doc_metadata,
                    'doc_index': idx,
                    'chunk_index': chunk_idx,
                    'total_chunks': len(chunks)
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
        print(f"✓ Added {len(all_chunks)} chunks to FAISS vector store")
    
    def retrieve_with_reranking(self, query: str, top_k: int = 5, final_k: int = 3) -> List[Dict]:
        """
        Retrieve documents with a two-stage process:
        1. Initial retrieval (top_k)
        2. Reranking based on query relevance (final_k)
        """
        query_embedding = self.get_embedding(query)
        initial_results = self.vector_store.search(query_embedding, top_k=top_k)
        
        reranked_results = []
        for doc, distance, metadata in initial_results:
            relevance_score = 1.0 / (1.0 + distance)
            reranked_results.append({
                'content': doc,
                'score': relevance_score,
                'metadata': metadata
            })
        
        reranked_results.sort(key=lambda x: x['score'], reverse=True)
        return reranked_results[:final_k]
    
    def generate_response_with_history(self, query: str, context: List[str], 
                                      use_history: bool = True) -> str:
        """
        Generate response using retrieved context and conversation history.
        """
        context_text = "\n\n".join([f"Document {i+1}:\n{doc}" for i, doc in enumerate(context)])
        
        messages = []
        
        if use_history and self.conversation_history:
            messages.extend(self.conversation_history[-4:])
        
        user_message = f"""Based on the following context, please answer the question.

Context:
{context_text}

Question: {query}

Provide a clear and concise answer based on the context. If the context doesn't contain enough information, acknowledge this."""
        
        messages.append({
            "role": "user",
            "content": user_message
        })
        
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2000,
            "temperature": 0.7,
            "messages": messages
        })
        
        response = self.bedrock_runtime.invoke_model(
            modelId=self.llm_model,
            body=body,
            contentType="application/json",
            accept="application/json"
        )
        
        response_body = json.loads(response['body'].read())
        answer = response_body['content'][0]['text']
        
        if use_history:
            self.conversation_history.append({"role": "user", "content": query})
            self.conversation_history.append({"role": "assistant", "content": answer})
        
        return answer
    
    def query(self, question: str, top_k: int = 3, use_history: bool = True) -> Dict:
        """
        Complete advanced RAG pipeline with reranking and conversation history.
        """
        print(f"\n🔍 Query: {question}")
        print(f"📚 Retrieving and reranking documents...")
        
        retrieved_docs = self.retrieve_with_reranking(question, top_k=top_k*2, final_k=top_k)
        
        print(f"✓ Found {len(retrieved_docs)} relevant documents")
        for i, doc in enumerate(retrieved_docs):
            print(f"  Doc {i+1} - Relevance: {doc['score']:.4f}")
        
        context = [doc['content'] for doc in retrieved_docs]
        
        print(f"🤖 Generating response with {'conversation history' if use_history else 'no history'}...")
        answer = self.generate_response_with_history(question, context, use_history)
        
        return {
            'question': question,
            'answer': answer,
            'retrieved_documents': retrieved_docs,
            'conversation_turn': len(self.conversation_history) // 2
        }
    
    def reset_conversation(self):
        """Reset conversation history."""
        self.conversation_history = []
        print("✓ Conversation history reset")


def main():
    """
    Demo: Advanced RAG with conversation history.
    """
    print("=" * 60)
    print("Advanced RAG Demo - AWS Bedrock with Conversation History")
    print("=" * 60)
    
    sample_documents = [
        """
        Amazon Bedrock is a fully managed service that offers a choice of high-performing 
        foundation models (FMs) from leading AI companies like AI21 Labs, Anthropic, Cohere, 
        Meta, Stability AI, and Amazon via a single API. With Bedrock, you can easily experiment 
        with and evaluate top FMs for your use case, privately customize them with your data 
        using techniques such as fine-tuning and Retrieval Augmented Generation (RAG), and build 
        agents that execute tasks using your enterprise systems and data sources. Since Amazon 
        Bedrock is serverless, you don't have to manage any infrastructure, and you can securely 
        integrate and deploy generative AI capabilities into your applications using the AWS 
        services you are already familiar with.
        """,
        """
        Retrieval-Augmented Generation (RAG) is an AI framework that combines the power of 
        large language models with external knowledge retrieval. In a RAG system, when a user 
        asks a question, the system first retrieves relevant documents from a knowledge base, 
        then uses those documents as context for the language model to generate an accurate 
        response. This approach helps reduce hallucinations and allows the model to provide 
        answers based on up-to-date, domain-specific information. RAG is particularly useful 
        for enterprise applications where accuracy and factual grounding are critical.
        """,
        """
        AWS Lambda is a serverless, event-driven compute service that lets you run code for 
        virtually any type of application or backend service without provisioning or managing 
        servers. Lambda runs your code on high-availability compute infrastructure and performs 
        all the administration of the compute resources, including server and operating system 
        maintenance, capacity provisioning and automatic scaling, and logging. With Lambda, 
        all you need to do is supply your code in one of the language runtimes that Lambda 
        supports. You pay only for the compute time that you consume—there is no charge when 
        your code is not running.
        """
    ]
    
    metadata = [
        {'source': 'bedrock_docs', 'category': 'ai', 'date': '2024-01'},
        {'source': 'rag_guide', 'category': 'ai', 'date': '2024-01'},
        {'source': 'lambda_docs', 'category': 'compute', 'date': '2024-01'}
    ]
    
    rag = AdvancedRAG(region_name="us-east-1")
    
    rag.add_documents(sample_documents, metadata)
    
    print("\n" + "=" * 60)
    print("Conversation 1: Multi-turn dialogue")
    print("=" * 60)
    
    result1 = rag.query("What is Amazon Bedrock?", top_k=2)
    print(f"\n💬 Answer:\n{result1['answer']}")
    print("\n" + "-" * 60)
    
    result2 = rag.query("How does it relate to RAG?", top_k=2)
    print(f"\n💬 Answer:\n{result2['answer']}")
    print("\n" + "-" * 60)
    
    result3 = rag.query("Can I use it with Lambda?", top_k=2)
    print(f"\n💬 Answer:\n{result3['answer']}")
    print("\n" + "-" * 60)


if __name__ == "__main__":
    main()
