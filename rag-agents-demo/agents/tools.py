import boto3
import json
from datetime import datetime
from typing import Dict, List, Any


class ToolRegistry:
    """
    Registry of tools that agents can use.
    Each tool has a name, description, and implementation.
    """
    
    def __init__(self, region_name: str = "us-east-1"):
        self.s3_client = boto3.client('s3', region_name=region_name)
        self.dynamodb = boto3.resource('dynamodb', region_name=region_name)
        self.tools = self._register_tools()
    
    def _register_tools(self) -> Dict[str, Dict]:
        """
        Register all available tools with their schemas.
        This follows the Claude function calling format.
        """
        return {
            "get_current_time": {
                "description": "Get the current date and time",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "timezone": {
                            "type": "string",
                            "description": "Timezone (e.g., 'UTC', 'US/Eastern')",
                            "default": "UTC"
                        }
                    }
                },
                "function": self.get_current_time
            },
            "calculate": {
                "description": "Perform mathematical calculations. Supports basic arithmetic and common functions.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "expression": {
                            "type": "string",
                            "description": "Mathematical expression to evaluate (e.g., '2 + 2', 'sqrt(16)')"
                        }
                    },
                    "required": ["expression"]
                },
                "function": self.calculate
            },
            "search_documents": {
                "description": "Search through a collection of documents for relevant information",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query"
                        },
                        "max_results": {
                            "type": "integer",
                            "description": "Maximum number of results to return",
                            "default": 5
                        }
                    },
                    "required": ["query"]
                },
                "function": self.search_documents
            },
            "list_s3_objects": {
                "description": "List objects in an S3 bucket",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "bucket_name": {
                            "type": "string",
                            "description": "Name of the S3 bucket"
                        },
                        "prefix": {
                            "type": "string",
                            "description": "Prefix to filter objects (optional)",
                            "default": ""
                        }
                    },
                    "required": ["bucket_name"]
                },
                "function": self.list_s3_objects
            },
            "get_weather": {
                "description": "Get weather information for a location (simulated)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "City name or location"
                        }
                    },
                    "required": ["location"]
                },
                "function": self.get_weather
            }
        }
    
    def get_tool_definitions(self) -> List[Dict]:
        """
        Get tool definitions in Claude's function calling format.
        """
        definitions = []
        for name, tool in self.tools.items():
            definitions.append({
                "name": name,
                "description": tool["description"],
                "input_schema": tool["parameters"]
            })
        return definitions
    
    def execute_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Dict:
        """
        Execute a tool with given parameters.
        """
        if tool_name not in self.tools:
            return {
                "success": False,
                "error": f"Tool '{tool_name}' not found"
            }
        
        try:
            result = self.tools[tool_name]["function"](**parameters)
            return {
                "success": True,
                "result": result
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_current_time(self, timezone: str = "UTC") -> str:
        """Get current time in specified timezone."""
        now = datetime.utcnow()
        return f"Current time in {timezone}: {now.strftime('%Y-%m-%d %H:%M:%S')}"
    
    def calculate(self, expression: str) -> str:
        """Safely evaluate mathematical expressions."""
        try:
            import math
            allowed_names = {
                'sqrt': math.sqrt,
                'pow': math.pow,
                'sin': math.sin,
                'cos': math.cos,
                'tan': math.tan,
                'log': math.log,
                'exp': math.exp,
                'pi': math.pi,
                'e': math.e
            }
            
            code = compile(expression, "<string>", "eval")
            for name in code.co_names:
                if name not in allowed_names:
                    raise NameError(f"Use of '{name}' not allowed")
            
            result = eval(code, {"__builtins__": {}}, allowed_names)
            return f"Result: {result}"
        except Exception as e:
            return f"Error calculating: {str(e)}"
    
    def search_documents(self, query: str, max_results: int = 5) -> str:
        """
        Simulated document search.
        In production, this would connect to a real search system or RAG pipeline.
        """
        mock_documents = [
            {"title": "AWS Lambda Guide", "content": "Lambda is a serverless compute service..."},
            {"title": "S3 Best Practices", "content": "S3 provides object storage with high durability..."},
            {"title": "Bedrock Overview", "content": "Amazon Bedrock offers foundation models..."},
            {"title": "RAG Implementation", "content": "RAG combines retrieval with generation..."},
            {"title": "Agent Design Patterns", "content": "Agents can use tools to accomplish tasks..."}
        ]
        
        results = [doc for doc in mock_documents if query.lower() in doc["title"].lower() or query.lower() in doc["content"].lower()]
        results = results[:max_results]
        
        if not results:
            return f"No documents found matching '{query}'"
        
        output = f"Found {len(results)} documents:\n"
        for i, doc in enumerate(results, 1):
            output += f"{i}. {doc['title']}: {doc['content'][:100]}...\n"
        
        return output
    
    def list_s3_objects(self, bucket_name: str, prefix: str = "") -> str:
        """
        List objects in an S3 bucket.
        Note: This requires appropriate IAM permissions.
        """
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=bucket_name,
                Prefix=prefix,
                MaxKeys=10
            )
            
            if 'Contents' not in response:
                return f"No objects found in bucket '{bucket_name}' with prefix '{prefix}'"
            
            objects = response['Contents']
            output = f"Found {len(objects)} objects in '{bucket_name}':\n"
            for obj in objects:
                output += f"- {obj['Key']} ({obj['Size']} bytes)\n"
            
            return output
        except Exception as e:
            return f"Error accessing S3: {str(e)}\nNote: Ensure bucket exists and you have permissions."
    
    def get_weather(self, location: str) -> str:
        """
        Simulated weather API.
        In production, this would call a real weather API.
        """
        import random
        
        conditions = ["Sunny", "Cloudy", "Rainy", "Partly Cloudy"]
        temp = random.randint(15, 30)
        condition = random.choice(conditions)
        
        return f"Weather in {location}: {condition}, {temp}°C"


def format_tool_result_for_claude(tool_name: str, result: Dict) -> str:
    """
    Format tool execution result for Claude.
    """
    if result["success"]:
        return f"Tool '{tool_name}' executed successfully:\n{result['result']}"
    else:
        return f"Tool '{tool_name}' failed:\n{result['error']}"
