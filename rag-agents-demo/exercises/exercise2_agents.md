# Exercise 2: Build Your Own AI Agent

## Objective
Build an AI agent that can use tools to accomplish complex tasks, demonstrating planning, reasoning, and tool execution capabilities.

## Prerequisites
- Completed Exercise 1 (RAG)
- Understanding of function calling concepts
- AWS Bedrock access with Claude 3

## Part 1: Understanding Agents (20 minutes)

### Questions to Answer:
1. What is the difference between a chatbot and an agent?
2. How does tool calling work in Claude?
3. What is the ReAct pattern (Reasoning + Acting)?
4. Why do agents need planning capabilities?

### Tasks:
1. Read through `agents/basic_agent.py`
2. Understand the agent loop: Query → Reason → Tool Use → Observe → Repeat
3. Review the tool definitions in `agents/tools.py`

## Part 2: Create Custom Tools (45 minutes)

### Task:
Add 3 new tools to the `ToolRegistry` class in `agents/tools.py`:

### Tool Ideas:

**1. Database Query Tool:**
```python
def query_database(self, table_name: str, filter_key: str = None, filter_value: str = None) -> str:
    """
    Query a DynamoDB table (or simulate it).
    
    Parameters:
    - table_name: Name of the table
    - filter_key: Optional filter attribute
    - filter_value: Optional filter value
    """
    # TODO: Implement database query
    pass
```

**2. Text Analysis Tool:**
```python
def analyze_sentiment(self, text: str) -> str:
    """
    Analyze sentiment of text using AWS Comprehend or simple rules.
    
    Parameters:
    - text: Text to analyze
    
    Returns: Sentiment (positive/negative/neutral) with confidence
    """
    # TODO: Implement sentiment analysis
    pass
```

**3. Data Transformation Tool:**
```python
def transform_data(self, data: str, operation: str) -> str:
    """
    Transform data (uppercase, lowercase, reverse, etc.)
    
    Parameters:
    - data: Input data
    - operation: Transformation to apply
    """
    # TODO: Implement data transformation
    pass
```

### Requirements:
- Each tool must have a clear description
- Define proper parameter schemas
- Include error handling
- Return informative results

### Hints:
- Follow the existing tool pattern in `tools.py`
- Add tools to the `_register_tools()` method
- Test each tool independently first

## Part 3: Build a Task-Specific Agent (60 minutes)

### Task:
Create a specialized agent for one of these domains:

#### Option A: Research Assistant Agent
- Search documents (use your RAG system from Exercise 1)
- Summarize findings
- Compare multiple sources
- Generate reports

#### Option B: Data Analysis Agent
- Load data from files
- Perform calculations
- Generate statistics
- Create visualizations (describe them)

#### Option C: DevOps Agent
- Check system status (simulated)
- Manage resources
- Deploy applications (simulated)
- Monitor and alert

### Code Template:

```python
from agents.basic_agent import BasicAgent
from agents.tools import ToolRegistry

class MySpecializedAgent(BasicAgent):
    """
    Specialized agent for [your domain].
    """
    
    def __init__(self, region_name: str = "us-east-1"):
        super().__init__(region_name)
        # Add custom initialization
        self._add_custom_tools()
    
    def _add_custom_tools(self):
        """Add domain-specific tools."""
        # TODO: Add your custom tools
        pass
    
    def execute_task(self, task: str) -> dict:
        """Execute a domain-specific task."""
        # TODO: Implement task execution
        pass

def main():
    agent = MySpecializedAgent()
    
    # Test with domain-specific tasks
    tasks = [
        # TODO: Add test tasks
    ]
    
    for task in tasks:
        result = agent.run(task)
        print(f"Result: {result}")

if __name__ == "__main__":
    main()
```

## Part 4: Implement Planning (45 minutes)

### Task:
Enhance your agent with explicit planning capabilities:

1. **Pre-execution Planning:**
   - Analyze the task
   - Break it into steps
   - Identify required tools
   - Estimate complexity

2. **Dynamic Replanning:**
   - Monitor progress
   - Adjust plan based on results
   - Handle unexpected situations

### Implementation Steps:

```python
def create_plan(self, task: str) -> dict:
    """
    Create a plan for executing the task.
    
    Returns:
    {
        'steps': [...],
        'tools_needed': [...],
        'estimated_iterations': int
    }
    """
    # TODO: Implement planning logic
    pass

def execute_with_planning(self, task: str) -> dict:
    """Execute task with explicit planning phase."""
    # 1. Create plan
    plan = self.create_plan(task)
    
    # 2. Execute plan
    results = []
    for step in plan['steps']:
        result = self._execute_step(step)
        results.append(result)
        
        # 3. Check if replanning needed
        if self._should_replan(result):
            plan = self.create_plan(remaining_task)
    
    return {'plan': plan, 'results': results}
```

## Part 5: Add Memory and Context (45 minutes)

### Task:
Implement memory capabilities for your agent:

1. **Short-term Memory:**
   - Track conversation history
   - Remember recent tool results
   - Maintain context across turns

2. **Long-term Memory:**
   - Store successful task patterns
   - Learn from failures
   - Build knowledge base

### Implementation:

```python
class AgentMemory:
    """Memory system for agents."""
    
    def __init__(self):
        self.short_term = []  # Recent interactions
        self.long_term = {}   # Persistent knowledge
        self.working = {}     # Current task state
    
    def add_to_short_term(self, item: dict):
        """Add item to short-term memory."""
        self.short_term.append(item)
        if len(self.short_term) > 10:  # Keep last 10
            self.short_term.pop(0)
    
    def store_long_term(self, key: str, value: any):
        """Store in long-term memory."""
        self.long_term[key] = value
    
    def retrieve(self, query: str) -> list:
        """Retrieve relevant memories."""
        # TODO: Implement memory retrieval
        pass
```

## Part 6: Error Handling and Recovery (30 minutes)

### Task:
Implement robust error handling:

1. **Tool Failure Handling:**
   - Retry with different parameters
   - Use alternative tools
   - Graceful degradation

2. **Validation:**
   - Validate tool inputs
   - Check tool outputs
   - Verify task completion

3. **Recovery Strategies:**
   - Automatic retry logic
   - Fallback mechanisms
   - User notification

### Code Example:

```python
def execute_tool_with_retry(self, tool_name: str, parameters: dict, max_retries: int = 3) -> dict:
    """Execute tool with retry logic."""
    for attempt in range(max_retries):
        try:
            result = self.tool_registry.execute_tool(tool_name, parameters)
            
            if result['success']:
                return result
            
            # Handle failure
            if attempt < max_retries - 1:
                # Modify parameters or try alternative
                parameters = self._adjust_parameters(parameters, result)
            
        except Exception as e:
            if attempt == max_retries - 1:
                return {'success': False, 'error': str(e)}
    
    return {'success': False, 'error': 'Max retries exceeded'}
```

## Part 7: Testing and Evaluation (45 minutes)

### Task:
Create comprehensive tests for your agent:

1. **Unit Tests:**
   - Test individual tools
   - Test planning logic
   - Test memory operations

2. **Integration Tests:**
   - Test complete task execution
   - Test multi-tool scenarios
   - Test error recovery

3. **Performance Tests:**
   - Measure execution time
   - Count LLM calls
   - Track token usage

### Test Template:

```python
import unittest

class TestMyAgent(unittest.TestCase):
    
    def setUp(self):
        self.agent = MySpecializedAgent()
    
    def test_simple_task(self):
        """Test agent can complete simple task."""
        result = self.agent.run("Simple task description")
        self.assertTrue(result['success'])
    
    def test_multi_step_task(self):
        """Test agent can complete multi-step task."""
        # TODO: Implement test
        pass
    
    def test_error_recovery(self):
        """Test agent recovers from errors."""
        # TODO: Implement test
        pass

if __name__ == '__main__':
    unittest.main()
```

## Bonus Challenges

### Challenge 1: Multi-Agent Collaboration
- Create multiple specialized agents
- Implement agent-to-agent communication
- Coordinate on complex tasks

### Challenge 2: Learning Agent
- Track successful strategies
- Improve tool selection over time
- Adapt to user preferences

### Challenge 3: Autonomous Agent
- Set long-term goals
- Self-initiate tasks
- Monitor and maintain systems

### Challenge 4: Human-in-the-Loop
- Request approval for sensitive operations
- Ask clarifying questions
- Provide progress updates

## Submission

Submit the following:
1. Your specialized agent implementation
2. Custom tools (at least 3)
3. Test suite with results
4. Documentation explaining:
   - Agent capabilities
   - Tool descriptions
   - Example tasks
   - Design decisions

## Evaluation Criteria

- **Functionality (35%)**: Agent completes tasks correctly
- **Tool Design (25%)**: Well-designed, useful tools
- **Planning (20%)**: Effective planning and reasoning
- **Code Quality (20%)**: Clean, maintainable code

## Common Issues and Solutions

**Issue**: Agent loops infinitely
- **Solution**: Add iteration limits, improve stop conditions

**Issue**: Poor tool selection
- **Solution**: Improve tool descriptions, add examples

**Issue**: Context loss
- **Solution**: Implement proper memory management

**Issue**: High latency
- **Solution**: Optimize tool calls, use caching

## Real-World Applications

After this exercise, you can build:
- Customer service automation
- Data analysis pipelines
- DevOps automation
- Research assistants
- Personal productivity tools

## Resources

- [Claude Function Calling Guide](https://docs.anthropic.com/claude/docs/tool-use)
- [Agent Design Patterns](https://www.anthropic.com/index/building-effective-agents)
- [LangChain Agents](https://python.langchain.com/docs/modules/agents/)

## Next Steps

1. Deploy your agent to AWS Lambda
2. Add monitoring and observability
3. Integrate with your RAG system from Exercise 1
4. Build a web interface for your agent
