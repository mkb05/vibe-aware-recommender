import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from groq import Groq

# Load environment variables
load_dotenv(dotenv_path="../.env")

# Initialize FastAPI
app = FastAPI(title="Vibe-Aware Recommender API")
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Connect to Qdrant Cloud
try:
    qdrant = QdrantClient(
        url=os.getenv("QDRANT_URL"),
        api_key=os.getenv("QDRANT_API_KEY"),
        timeout=60.0
    )
except Exception as e:
    print(f"Failed to connect to Qdrant: {e}")


class VibeRequest(BaseModel):
    movie_id: int       # The anchor movie the user already likes
    vibe_prompt: str    # The natural language vibe (e.g., "mind-bending and atmospheric")

@app.post("/recommend")
def get_vibe_recommendation(request: VibeRequest):
    # STEP 1: Fetch the anchor movie's vector from Qdrant
    anchor_response = qdrant.retrieve(
        collection_name="movies",
        ids=[request.movie_id],
        with_vectors=True
    )
    
    if not anchor_response:
        raise HTTPException(status_code=404, detail="Anchor movie not found")
        
    anchor_movie = anchor_response[0]
    anchor_vector = anchor_movie.vector

    # STEP 2: Vector Search (Find 15 mathematically similar movies)
    search_results = qdrant.search(
        collection_name="movies",
        query_vector=anchor_vector,
        limit=15
    )
    
    # Format the candidates for the LLM
    candidate_movies = [
        {"title": hit.payload["title"], "genres": hit.payload["genres"]} 
        for hit in search_results[1:] # Skip the first result (it will be the anchor movie itself)
    ]

    # STEP 3: LLM Re-ranking (The "Vibe" Agent)
    prompt = f"""
    You are an expert movie curator. The user likes the movie '{anchor_movie.payload['title']}'. 
    They are looking for something to watch next with this specific vibe: "{request.vibe_prompt}".
    
    Here is a list of 14 mathematically similar candidate movies:
    {candidate_movies}
    
    Review the candidates and select the 3 that best match the requested vibe. 
    Output your response as a valid JSON object containing a 'recommendations' array. Each item should have a 'title' and a 'reason' explaining why it matches the vibe.
    """

    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.5,
            response_format={"type": "json_object"}
        )
        
        # Parse the JSON string returned by Groq into a Python dictionary
        vibe_results = json.loads(chat_completion.choices[0].message.content)
        return {"status": "success", "data": vibe_results}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Processing failed: {str(e)}")

@app.get("/")
def read_root():
    return {"status": "healthy", "message": "Vibe API is running!"}

@app.get("/test-db")
def test_database():
    # Fetch 1 random movie from Qdrant to prove the connection works
    try:
        result = qdrant.scroll(
            collection_name="movies",
            limit=1,
            with_payload=True,
            with_vectors=False
        )
        return {"status": "success", "sample_movie": result[0][0].payload}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))