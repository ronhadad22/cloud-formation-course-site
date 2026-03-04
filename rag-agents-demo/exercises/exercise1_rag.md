# Exercise 1: Build Your Own RAG System

## Objective
Build a simple RAG (Retrieval-Augmented Generation) system using AWS Bedrock that can answer questions about your own documents.

## Prerequisites
- AWS account with Bedrock access enabled
- Python 3.9+ installed
- AWS CLI configured
- Completed the basic RAG demo

## Part 1: Understanding the Components (15 minutes)

### Questions to Answer:
1. What is the purpose of vector embeddings in RAG?
2. Why do we chunk documents instead of using them whole?
3. What is the difference between semantic search and keyword search?

### Tasks:
1. Read through `rag/basic_rag.py` and identify the main components
2. Understand the flow: Document → Chunks → Embeddings → Vector Store → Retrieval → Generation

## Part 2: Create Your Own Document Collection (20 minutes)

### Task:
Create 3-5 text files in `data/sample_docs/` about a topic of your choice. Examples:
- Company documentation
- Product manuals
- Course materials
- Technical guides
- FAQ documents

### Requirements:
- Each document should be at least 200 words
- Documents should cover different aspects of your topic
- Use clear, informative content

### Example Topics:
- Your company's products and services
- A technical framework or library
- Historical events or figures
- Scientific concepts
- Travel destinations

## Part 3: Implement Document Loading (30 minutes)

### Task:
Create a new file `my_rag_system.py` that:

1. Loads your documents from the `data/sample_docs/` directory
2. Initializes the BasicRAG class
3. Adds your documents to the vector store
4. Saves the vector store to disk for reuse

### Code Template:

```python
import os
from rag.basic_rag import BasicRAG

def load_documents_from_directory(directory_path):
    """Load all .txt files from a directory."""
    documents = []
    metadata = []
    
    for filename in os.listdir(directory_path):
        if filename.endswith('.txt'):
            filepath = os.path.join(directory_path, filename)
            with open(filepath, 'r') as f:
                content = f.read()
                documents.append(content)
                metadata.append({
                    'filename': filename,
                    'source': filepath
                })
    
    return documents, metadata

def main():
    # TODO: Initialize RAG system
    # TODO: Load documents
    # TODO: Add documents to vector store
    # TODO: Save vector store
    pass

if __name__ == "__main__":
    main()
```

### Hints:
- Use `os.listdir()` to get all files in a directory
- Filter for `.txt` files
- Read file contents with `open()`
- Use the `add_documents()` method from BasicRAG

## Part 4: Query Your System (20 minutes)

### Task:
Add query functionality to your `my_rag_system.py`:

1. Load the saved vector store
2. Accept user questions via command line
3. Retrieve relevant documents
4. Generate and display answers

### Example Queries to Test:
- Ask specific factual questions about your documents
- Ask for comparisons between concepts
- Ask for summaries
- Ask questions that require information from multiple documents

### Success Criteria:
- System retrieves relevant documents
- Answers are based on your documents
- System acknowledges when it doesn't have information

## Part 5: Experiment with Parameters (30 minutes)

### Tasks:

1. **Chunk Size Experiment:**
   - Try different chunk sizes: 200, 500, 1000 words
   - Document which works best for your documents
   - Why does chunk size matter?

2. **Top-K Experiment:**
   - Try retrieving 1, 3, 5, 10 documents
   - How does this affect answer quality?
   - What's the trade-off?

3. **Overlap Experiment:**
   - Modify the `chunk_text()` function to use different overlap values
   - Test with 0, 50, 100 word overlaps
   - When is overlap helpful?

### Document Your Findings:
Create a file `experiment_results.md` with:
- Parameter values tested
- Sample queries used
- Quality of results
- Recommendations

## Part 6: Add Evaluation (30 minutes)

### Task:
Create an evaluation script that:

1. Defines 5-10 test questions with expected answers
2. Runs each question through your RAG system
3. Compares generated answers to expected answers
4. Calculates accuracy metrics

### Evaluation Metrics to Consider:
- Relevance: Does the answer address the question?
- Accuracy: Is the information correct?
- Completeness: Does it cover all aspects?
- Source attribution: Are sources cited?

### Code Template:

```python
test_cases = [
    {
        "question": "What is...?",
        "expected_keywords": ["keyword1", "keyword2"],
        "expected_source": "document_name.txt"
    },
    # Add more test cases
]

def evaluate_answer(answer, expected_keywords, retrieved_docs):
    """Evaluate answer quality."""
    score = 0
    # TODO: Implement evaluation logic
    return score
```

## Bonus Challenges

### Challenge 1: Multi-Modal RAG
- Add support for PDF documents
- Extract text from PDFs using PyPDF2 or pdfplumber
- Handle images and tables

### Challenge 2: Hybrid Search
- Implement keyword search alongside semantic search
- Combine results from both methods
- Compare performance

### Challenge 3: Query Expansion
- Expand user queries with synonyms
- Generate multiple query variations
- Retrieve using all variations

### Challenge 4: Conversation History
- Add conversation context to queries
- Maintain state across multiple questions
- Handle follow-up questions

## Submission

Submit the following:
1. Your `my_rag_system.py` file
2. Your custom documents (3-5 files)
3. `experiment_results.md` with your findings
4. Screenshots of successful queries
5. (Optional) Any bonus challenge implementations

## Evaluation Criteria

- **Functionality (40%)**: System works correctly
- **Code Quality (20%)**: Clean, well-documented code
- **Experimentation (20%)**: Thorough parameter testing
- **Documentation (20%)**: Clear explanation of findings

## Resources

- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Vector Embeddings Explained](https://www.pinecone.io/learn/vector-embeddings/)
- [RAG Best Practices](https://www.anthropic.com/index/retrieval-augmented-generation)

## Common Issues and Solutions

**Issue**: "Model not found" error
- **Solution**: Enable the model in AWS Bedrock console (Model access)

**Issue**: Slow embedding generation
- **Solution**: Batch embeddings or use caching

**Issue**: Poor retrieval quality
- **Solution**: Adjust chunk size, try different overlap values

**Issue**: Generic answers
- **Solution**: Increase top_k, improve document quality

## Next Steps

After completing this exercise:
1. Move to Exercise 2: Building AI Agents
2. Explore advanced RAG techniques (reranking, hybrid search)
3. Deploy your RAG system to AWS Lambda
