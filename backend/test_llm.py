import asyncio
import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.config import settings
from app.services.llm import ask_llm

async def main():
    print("=== Testing LLM Abstraction Layer ===")
    print(f"Configured Provider: {settings.LLM_PROVIDER}")
    print(f"Configured Ollama Model: {settings.OLLAMA_MODEL}")
    print(f"Gemini API Key Set: {settings.GEMINI_API_KEY is not None}")
    
    prompt = "Explain what a binary search tree is in one sentence."
    print(f"\nSending prompt: '{prompt}'...")
    
    response = await ask_llm(prompt)
    print("\n--- Response ---")
    print(response)
    print("----------------")
    
    if "Error" in response:
        print("\nNote: LLM call returned an error. Make sure your local Ollama is running or Gemini API key is configured correctly.")
    else:
        print("\nSuccess! LLM responded successfully.")

if __name__ == "__main__":
    asyncio.run(main())
