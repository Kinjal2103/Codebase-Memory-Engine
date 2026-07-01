import asyncio
import httpx
import google.generativeai as genai
from app.config import settings

async def ask_llm(prompt: str) -> str:
    """
    Unified LLM call function that queries either Ollama or Gemini 
    depending on the configured LLM_PROVIDER in settings.
    Handles exceptions, rate-limits, and timeouts gracefully.
    """
    provider = settings.LLM_PROVIDER.lower() if settings.LLM_PROVIDER else "ollama"
    
    if provider == "gemini":
        if not settings.GEMINI_API_KEY:
            return "Error: GEMINI_API_KEY is not configured in .env."
        
        try:
            # Configure and instantiate Gemini model
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")
            
            # Use asyncio.to_thread to execute the blocking SDK call in a separate thread
            # to keep the async loop unblocked.
            response = await asyncio.to_thread(model.generate_content, prompt)
            return response.text
        except Exception as e:
            print(f"Gemini API call failed: {e}")
            return f"Error calling Gemini: {str(e)}"
            
    else:
        # Default/Fallback to Ollama
        url = "http://localhost:11434/api/generate"
        payload = {
            "model": settings.OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False
        }
        
        try:
            # Call Ollama asynchronously via httpx with a 60 second timeout
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, timeout=60.0)
                if response.status_code == 200:
                    data = response.json()
                    return data.get("response", "Error: No response text received from Ollama.")
                else:
                    return f"Error: Ollama returned status code {response.status_code}. Response: {response.text}"
        except httpx.TimeoutException:
            return "Error: Ollama request timed out (60s limit reached)."
        except Exception as e:
            return f"Error calling Ollama: {str(e)}"
