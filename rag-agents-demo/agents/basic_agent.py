import boto3
import json
from typing import List, Dict, Any, Optional
from tools import ToolRegistry, format_tool_result_for_claude


class BasicAgent:
    """
    Basic AI Agent that can use tools to accomplish tasks.
    Uses Claude's function calling capabilities via AWS Bedrock.
    """
    
    def __init__(self, region_name: str = "us-east-1"):
        self.bedrock_runtime = boto3.client('bedrock-runtime', region_name=region_name)
        self.model_id = "anthropic.claude-3-sonnet-20240229-v1:0"
        self.tool_registry = ToolRegistry(region_name=region_name)
        self.conversation_history: List[Dict] = []
        self.max_iterations = 10
    
    def _call_claude_with_tools(self, messages: List[Dict]) -> Dict:
        """
        Call Claude with tool definitions.
        """
        tools = self.tool_registry.get_tool_definitions()
        
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096,
            "messages": messages,
            "tools": tools
        }
        
        response = self.bedrock_runtime.invoke_model(
            modelId=self.model_id,
            body=json.dumps(body),
            contentType="application/json",
            accept="application/json"
        )
        
        return json.loads(response['body'].read())
    
    def run(self, task: str, verbose: bool = True) -> Dict:
        """
        Run the agent on a task.
        The agent will use tools as needed to accomplish the task.
        """
        if verbose:
            print("=" * 60)
            print(f"🤖 Agent Task: {task}")
            print("=" * 60)
        
        messages = [{
            "role": "user",
            "content": task
        }]
        
        iteration = 0
        tool_uses = []
        
        while iteration < self.max_iterations:
            iteration += 1
            
            if verbose:
                print(f"\n--- Iteration {iteration} ---")
            
            response = self._call_claude_with_tools(messages)
            
            stop_reason = response.get('stop_reason')
            content = response.get('content', [])
            
            if verbose:
                print(f"Stop reason: {stop_reason}")
            
            assistant_message = {
                "role": "assistant",
                "content": content
            }
            messages.append(assistant_message)
            
            if stop_reason == 'end_turn':
                final_response = ""
                for block in content:
                    if block.get('type') == 'text':
                        final_response += block.get('text', '')
                
                if verbose:
                    print(f"\n✓ Task completed in {iteration} iterations")
                    print(f"✓ Used {len(tool_uses)} tools")
                
                return {
                    "success": True,
                    "response": final_response,
                    "iterations": iteration,
                    "tools_used": tool_uses
                }
            
            elif stop_reason == 'tool_use':
                tool_results = []
                
                for block in content:
                    if block.get('type') == 'tool_use':
                        tool_name = block.get('name')
                        tool_input = block.get('input', {})
                        tool_use_id = block.get('id')
                        
                        if verbose:
                            print(f"\n🔧 Using tool: {tool_name}")
                            print(f"   Input: {json.dumps(tool_input, indent=2)}")
                        
                        result = self.tool_registry.execute_tool(tool_name, tool_input)
                        
                        if verbose:
                            print(f"   Result: {result}")
                        
                        tool_uses.append({
                            "tool": tool_name,
                            "input": tool_input,
                            "result": result
                        })
                        
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tool_use_id,
                            "content": format_tool_result_for_claude(tool_name, result)
                        })
                
                messages.append({
                    "role": "user",
                    "content": tool_results
                })
            
            else:
                if verbose:
                    print(f"\n⚠️  Unexpected stop reason: {stop_reason}")
                break
        
        return {
            "success": False,
            "error": "Max iterations reached",
            "iterations": iteration,
            "tools_used": tool_uses
        }
    
    def chat(self, message: str, verbose: bool = True) -> str:
        """
        Simple chat interface with tool use.
        """
        result = self.run(message, verbose=verbose)
        return result.get('response', 'Error: No response generated')


def main():
    """
    Demo: Basic agent with tool calling.
    """
    print("=" * 60)
    print("Basic Agent Demo - AWS Bedrock with Tool Calling")
    print("=" * 60)
    
    agent = BasicAgent(region_name="us-east-1")
    
    tasks = [
        "What is the current time?",
        "Calculate the square root of 144 plus 10",
        "Search for documents about AWS Lambda and tell me what you find",
        "What's the weather like in Seattle? Then calculate how many days until the temperature reaches 25 degrees if it increases by 2 degrees per day."
    ]
    
    for i, task in enumerate(tasks, 1):
        print(f"\n{'='*60}")
        print(f"Task {i}/{len(tasks)}")
        print(f"{'='*60}")
        
        result = agent.run(task, verbose=True)
        
        if result['success']:
            print(f"\n💬 Final Response:\n{result['response']}")
            print(f"\n📊 Summary:")
            print(f"   - Iterations: {result['iterations']}")
            print(f"   - Tools used: {len(result['tools_used'])}")
            if result['tools_used']:
                print(f"   - Tool list: {', '.join([t['tool'] for t in result['tools_used']])}")
        else:
            print(f"\n❌ Error: {result.get('error')}")
        
        print("\n" + "-" * 60)


if __name__ == "__main__":
    main()
