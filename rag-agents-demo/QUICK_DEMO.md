# 20-Minute RAG & Agents Demo for Students

## 🎯 Demo Objective
Show students how AI can answer questions about custom documents and use tools autonomously using AWS Bedrock.

**Duration**: 20-30 minutes  
**Format**: Live coding demonstration

---

## 📋 Demo Outline

### Part 1: RAG Demo (10 minutes)
**Show**: How AI answers questions from your documents

### Part 2: Agent Demo (10 minutes)
**Show**: How AI uses tools to solve complex tasks

### Part 3: Q&A (5-10 minutes)
**Discuss**: Real-world applications

---

## 🚀 Part 1: RAG Demo (10 min)

### Setup (1 min)
```bash
cd /Users/rwnhdd/Downloads/cloudformation/rag-agents-demo
python rag/basic_rag.py
```

### What to Show & Explain:

**1. The Problem (1 min)**
- "LLMs are trained on old data and don't know your private documents"
- "RAG solves this by retrieving relevant docs before generating answers"

**2. Run the Demo (3 min)**
Show the output as it runs:

```
Processing 4 documents...
Created 8 chunks. Generating embeddings...
✓ Added 8 chunks to vector store

🔍 Query: What is AWS Lambda and how does it work?
📚 Retrieving top 2 relevant documents...
✓ Found 2 relevant documents
  Doc 1 - Score: 0.8234
  Doc 2 - Score: 0.7891
🤖 Generating response...

💬 Answer:
AWS Lambda is a serverless compute service that lets you run code 
without provisioning or managing servers...
```

**3. Key Concepts to Highlight (3 min)**

Point to the code on screen:

```python
# 1. Documents are converted to vectors (embeddings)
embedding = self.get_embedding(text)

# 2. User query is also converted to vector
query_embedding = self.get_embedding(query)

# 3. Find similar documents using vector math
results = self.vector_store.search(query_embedding, top_k=3)

# 4. Retrieved docs become context for the LLM
answer = self.generate_response(query, context)
```

**Explain**: "It's like Google search, but for semantic meaning, not just keywords"

**4. Show the Magic (2 min)**

Ask different questions to show it works:
- "What is Amazon Bedrock?" → Retrieves Bedrock doc
- "Tell me about storage options" → Retrieves S3 doc
- "What is serverless computing?" → Retrieves Lambda doc

**Key Point**: "The AI doesn't hallucinate because it's reading from YOUR documents"

---

## 🤖 Part 2: Agent Demo (10 min)

### Setup (1 min)
```bash
python agents/basic_agent.py
```

### What to Show & Explain:

**1. The Problem (1 min)**
- "ChatGPT can only generate text"
- "Agents can DO things - use tools, APIs, databases"

**2. Run the Demo (4 min)**

Show the agent solving: "Calculate the square root of 144 plus 10"

```
🤖 Agent Task: Calculate the square root of 144 plus 10
--- Iteration 1 ---
Stop reason: tool_use

🔧 Using tool: calculate
   Input: {"expression": "sqrt(144) + 10"}
   ✓ Result: {'success': True, 'result': 'Result: 22.0'}

--- Iteration 2 ---
Stop reason: end_turn

✓ Task completed in 2 iterations
✓ Used 1 tools

💬 Final Response:
The square root of 144 is 12, and when we add 10 to that, 
we get 22.
```

**3. The Agent Loop (2 min)**

Draw this on whiteboard or show diagram:

```
┌─────────────────────────────────────┐
│  1. Think: "I need to calculate"    │
│  2. Act: Use calculator tool        │
│  3. Observe: Got result "22.0"      │
│  4. Think: "Task complete"          │
│  5. Respond: Give final answer      │
└─────────────────────────────────────┘
```

**Explain**: "This is called the ReAct pattern - Reasoning + Acting"

**4. Show Complex Task (3 min)**

Run: "What's the weather in Seattle? Then calculate how many days until 25°C if it increases by 2° per day"

Show how the agent:
1. Uses weather tool → Gets current temp (e.g., 15°C)
2. Uses calculator → (25-15)/2 = 5 days
3. Combines results → "5 days"

**Key Point**: "The agent PLANS, USES TOOLS, and REASONS - just like a human assistant"

---

## 💡 Part 3: Real-World Applications (5-10 min)

### Ask Students:

**"Where could you use RAG?"**
- Customer support chatbots
- Internal company knowledge base
- Legal document analysis
- Medical records search
- Code documentation assistant

**"Where could you use Agents?"**
- Automated customer service
- Data analysis pipelines
- DevOps automation
- Personal assistants
- Research assistants

### Show the Tools Available

Open `agents/tools.py` and scroll through:
```python
"get_current_time"    # Time/date queries
"calculate"           # Math operations
"search_documents"    # Document search
"list_s3_objects"     # AWS S3 access
"get_weather"         # External APIs
```

**Explain**: "You can add ANY tool - database queries, API calls, file operations, etc."

---

## 🎓 What Students Will Build

### Exercise 1: RAG System
- Load their own documents (company docs, course notes, etc.)
- Experiment with parameters
- Build evaluation metrics

### Exercise 2: AI Agent
- Create custom tools
- Build specialized agents (research, data analysis, DevOps)
- Implement planning and memory

**Time estimate**: 2-3 hours per exercise

---

## 📊 Demo Script (Exact Timing)

| Time | Activity | What to Say |
|------|----------|-------------|
| 0:00 | Intro | "Today you'll see how AI can read your documents and use tools" |
| 0:01 | RAG Setup | "Let me show you RAG - Retrieval Augmented Generation" |
| 0:02 | Run RAG | *Run basic_rag.py* "Watch how it processes documents..." |
| 0:05 | Explain RAG | "Documents → Vectors → Search → Generate. No hallucinations!" |
| 0:07 | RAG Q&A | Ask 2-3 questions to show it works |
| 0:10 | Agent Setup | "Now let's see agents - AI that can DO things" |
| 0:11 | Run Agent | *Run basic_agent.py* "Watch it use tools..." |
| 0:15 | Explain Agent | "Think → Act → Observe → Repeat. Like a human assistant" |
| 0:18 | Complex Task | Show multi-step reasoning with weather + calculator |
| 0:20 | Applications | "Where would YOU use this?" |
| 0:25 | Exercises | "You'll build both systems in the exercises" |
| 0:30 | Q&A | Answer questions |

---

## 🎤 Key Talking Points

### For RAG:
- ✅ "Solves the hallucination problem"
- ✅ "Works with YOUR private data"
- ✅ "No retraining needed - just add documents"
- ✅ "Like giving the AI a textbook to reference"

### For Agents:
- ✅ "Goes beyond text generation"
- ✅ "Can interact with real systems"
- ✅ "Plans and reasons like a human"
- ✅ "Autonomous task execution"

### For AWS Bedrock:
- ✅ "Fully managed - no infrastructure"
- ✅ "Multiple models available (Claude, Titan, etc.)"
- ✅ "Pay per use - no upfront costs"
- ✅ "Enterprise-ready with security"

---

## 🔧 Troubleshooting During Demo

### If RAG demo fails:
- **Error: Model not found** → "You need to enable models in Bedrock console first"
- **Slow embeddings** → "This is normal - generating vectors takes time"
- **Poor answers** → "This shows why parameter tuning matters - you'll learn this in exercises"

### If Agent demo fails:
- **Infinite loop** → "This is why we have iteration limits"
- **Wrong tool** → "This shows why clear tool descriptions matter"
- **Tool error** → "Real-world systems need error handling - you'll implement this"

**Pro tip**: Run both demos once before presenting to ensure they work!

---

## 📝 Handout for Students

After the demo, share:

1. **GitHub repo link** (or file location)
2. **SETUP.md** - Installation instructions
3. **Exercise 1 & 2** - What they'll build
4. **AWS Bedrock setup guide** - How to enable models

---

## 🎯 Success Metrics

Students should leave understanding:
- ✅ What RAG is and why it's useful
- ✅ What agents can do beyond chatbots
- ✅ How to use AWS Bedrock
- ✅ What they'll build in exercises

**The "wow" moment**: When the agent uses multiple tools to solve a complex task autonomously!

---

## 💬 Sample Q&A Responses

**Q: "Is this expensive?"**
A: "For learning, $5-10/day. Production depends on usage. We'll cover cost optimization."

**Q: "Can I use my own documents?"**
A: "Yes! That's Exercise 1 - you'll load your own docs."

**Q: "What if the agent makes mistakes?"**
A: "Great question! That's why we add human-in-the-loop approval for sensitive operations."

**Q: "Can I use OpenAI instead of Bedrock?"**
A: "Yes, but Bedrock is AWS-native, enterprise-ready, and easier for AWS environments."

**Q: "How accurate is RAG?"**
A: "Much better than pure LLM, but depends on document quality and parameter tuning - you'll experiment with this."

---

## 🚀 Next Steps for Students

1. **Today**: Watch demo, ask questions
2. **This week**: Complete SETUP.md, run demos locally
3. **Next week**: Complete Exercise 1 (RAG)
4. **Following week**: Complete Exercise 2 (Agents)
5. **Final project**: Build real-world application

---

**Good luck with your presentation! 🎉**
