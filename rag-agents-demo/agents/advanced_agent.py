import boto3
import json
from typing import List, Dict, Any, Optional
from tools import ToolRegistry, format_tool_result_for_claude


class AdvancedAgent:
    """
    Advanced AI Agent with planning, reflection, and multi-step reasoning.
    Demonstrates more sophisticated agent patterns.
    """
    
    def __init__(self, region_name: str = "us-east-1"):
        self.bedrock_runtime = boto3.client('bedrock-runtime', region_name=region_name)
        self.model_id = "anthropic.claude-3-sonnet-20240229-v1:0"
        self.tool_registry = ToolRegistry(region_name=region_name)
        self.max_iterations = 15
    
    def _call_claude(self, messages: List[Dict], tools: Optional[List[Dict]] = None) -> Dict:
        """Call Claude with or without tools."""
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096,
            "messages": messages
        }
        
        if tools:
            body["tools"] = tools
        
        response = self.bedrock_runtime.invoke_model(
            modelId=self.model_id,
            body=json.dumps(body),
            contentType="application/json",
            accept="application/json"
        )
        
        return json.loads(response['body'].read())
    
    def create_plan(self, task: str) -> Dict:
        """
        Create a plan for accomplishing the task.
        This is the "thinking" phase.
        """
        planning_prompt = f"""You are a planning agent. Given a task, create a detailed step-by-step plan.

Task: {task}

Available tools:
{json.dumps(self.tool_registry.get_tool_definitions(), indent=2)}

Create a plan with numbered steps. For each step, specify:
1. What needs to be done
2. Which tool(s) might be needed (if any)
3. Expected outcome

Format your response as a clear, numbered list."""

        messages = [{"role": "user", "content": planning_prompt}]
        response = self._call_claude(messages)
        
        plan_text = ""
        for block in response.get('content', []):
            if block.get('type') == 'text':
                plan_text += block.get('text', '')
        
        return {
            "plan": plan_text,
            "steps": self._parse_plan(plan_text)
        }
    
    def _parse_plan(self, plan_text: str) -> List[str]:
        """Parse plan text into individual steps."""
        lines = plan_text.split('\n')
        steps = []
        for line in lines:
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith('-')):
                steps.append(line)
        return steps
    
    def execute_with_planning(self, task: str, verbose: bool = True) -> Dict:
        """
        Execute task with explicit planning phase.
        """
        if verbose:
            print("=" * 60)
            print(f"🤖 Advanced Agent Task: {task}")
            print("=" * 60)
        
        if verbose:
            print("\n📋 Phase 1: Planning")
            print("-" * 60)
        
        plan_result = self.create_plan(task)
        
        if verbose:
            print(f"\n{plan_result['plan']}")
            print(f"\n✓ Created plan with {len(plan_result['steps'])} steps")
        
        if verbose:
            print("\n⚙️  Phase 2: Execution")
            print("-" * 60)
        
        execution_prompt = f"""Execute the following task using the plan provided.

Task: {task}

Plan:
{plan_result['plan']}

Execute the plan step by step. Use the available tools as needed. Provide a final summary when complete."""

        messages = [{
            "role": "user",
            "content": execution_prompt
        }]
        
        tools = self.tool_registry.get_tool_definitions()
        iteration = 0
        tool_uses = []
        
        while iteration < self.max_iterations:
            iteration += 1
            
            if verbose:
                print(f"\n--- Iteration {iteration} ---")
            
            response = self._call_claude(messages, tools=tools)
            
            stop_reason = response.get('stop_reason')
            content = response.get('content', [])
            
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
                    print(f"\n✓ Execution completed in {iteration} iterations")
                
                return {
                    "success": True,
                    "plan": plan_result['plan'],
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
                            status = "✓" if result['success'] else "✗"
                            print(f"   {status} Result: {result}")
                        
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
            "plan": plan_result['plan'],
            "iterations": iteration,
            "tools_used": tool_uses
        }
    
    def reflect_on_result(self, task: str, result: str) -> str:
        """
        Reflect on the result and provide insights.
        This is the "reflection" phase.
        """
        reflection_prompt = f"""Reflect on the following task execution:

Task: {task}

Result: {result}

Provide a brief reflection covering:
1. Was the task completed successfully?
2. What worked well?
3. What could be improved?
4. Any lessons learned?"""

        messages = [{"role": "user", "content": reflection_prompt}]
        response = self._call_claude(messages)
        
        reflection = ""
        for block in response.get('content', []):
            if block.get('type') == 'text':
                reflection += block.get('text', '')
        
        return reflection


class MultiAgentSystem:
    """
    System with multiple specialized agents working together.
    """
    
    def __init__(self, region_name: str = "us-east-1"):
        self.region_name = region_name
        self.researcher = AdvancedAgent(region_name)
        self.analyst = AdvancedAgent(region_name)
        self.summarizer = AdvancedAgent(region_name)
    
    def collaborative_task(self, task: str, verbose: bool = True) -> Dict:
        """
        Execute a task using multiple agents collaboratively.
        """
        if verbose:
            print("=" * 60)
            print("🤝 Multi-Agent Collaborative Task")
            print("=" * 60)
            print(f"\nTask: {task}\n")
        
        if verbose:
            print("\n👤 Agent 1: Researcher")
            print("-" * 60)
        
        research_result = self.researcher.execute_with_planning(
            f"Research and gather information about: {task}",
            verbose=verbose
        )
        
        if verbose:
            print("\n👤 Agent 2: Analyst")
            print("-" * 60)
        
        analysis_result = self.analyst.execute_with_planning(
            f"Analyze the following research findings: {research_result.get('response', '')}",
            verbose=verbose
        )
        
        if verbose:
            print("\n👤 Agent 3: Summarizer")
            print("-" * 60)
        
        summary_result = self.summarizer.execute_with_planning(
            f"Create a comprehensive summary combining research and analysis: {analysis_result.get('response', '')}",
            verbose=verbose
        )
        
        return {
            "research": research_result,
            "analysis": analysis_result,
            "summary": summary_result
        }


def main():
    """
    Demo: Advanced agent with planning and reflection.
    """
    print("=" * 60)
    print("Advanced Agent Demo - Planning & Reflection")
    print("=" * 60)
    
    agent = AdvancedAgent(region_name="us-east-1")
    
    task = "Find information about AWS Lambda, calculate how much it would cost to run 1 million requests per month at 512MB memory and 1 second duration, and tell me what the weather is like in the AWS us-east-1 region (Virginia)."
    
    result = agent.execute_with_planning(task, verbose=True)
    
    if result['success']:
        print("\n" + "=" * 60)
        print("📊 Final Result")
        print("=" * 60)
        print(f"\n{result['response']}")
        
        print("\n" + "=" * 60)
        print("🔍 Reflection Phase")
        print("=" * 60)
        
        reflection = agent.reflect_on_result(task, result['response'])
        print(f"\n{reflection}")
        
        print("\n" + "=" * 60)
        print("📈 Statistics")
        print("=" * 60)
        print(f"Iterations: {result['iterations']}")
        print(f"Tools used: {len(result['tools_used'])}")
        if result['tools_used']:
            print(f"Tool list: {', '.join([t['tool'] for t in result['tools_used']])}")
    else:
        print(f"\n❌ Error: {result.get('error')}")
    
    print("\n" + "=" * 60)
    print("Multi-Agent Demo")
    print("=" * 60)
    
    multi_agent = MultiAgentSystem(region_name="us-east-1")
    
    collaborative_task = "AWS Bedrock and its use cases"
    
    multi_result = multi_agent.collaborative_task(collaborative_task, verbose=True)
    
    print("\n" + "=" * 60)
    print("🎯 Multi-Agent Final Summary")
    print("=" * 60)
    print(f"\n{multi_result['summary'].get('response', 'No summary available')}")


if __name__ == "__main__":
    main()
