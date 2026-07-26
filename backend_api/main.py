import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import requests
from qdrant_client import QdrantClient
from groq import Groq
from youtubesearchpython import VideosSearch

# Load environment variables
load_dotenv(dotenv_path="../.env")

# Initialize FastAPI
app = FastAPI(title="Vibe-Aware Recommender API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (or replace with your specific Vercel URL)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)


groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Connect to Qdrant Cloud
try:
    qdrant = QdrantClient(
        url=os.getenv("QDRANT_URL"),
        api_key=os.getenv("QDRANT_API_KEY"),
        timeout=120.0,  # Bumped to 120 seconds
        prefer_grpc=False
    )
except Exception as e:
    print(f"Failed to connect to Qdrant: {e}")


class VibeRequest(BaseModel):
    movie_id: int       # The anchor movie the user already likes
    vibe_prompt: str    # The natural language vibe (e.g., "mind-bending and atmospheric")


import re

import re


@app.get("/catalog")
def get_movie_catalog():
    try:
        # Increased limit to 300 to get a deeper pool of modern movies
        scroll_result = qdrant.scroll(
            collection_name="movies",
            limit=300,
            with_payload=True,
            with_vectors=False
        )
        points = scroll_result[0]
        
        categories = {
            "Sci-Fi & Action": [],
            "Drama & Classics": [],
            "Trending & Popular": []
        }
        
        # 1. Sort movies into categories
        for point in points:
            title = point.payload.get("title", "Unknown Title")
            genres = point.payload.get("genres", [])
            
            movie_item = {
                "id": point.id, 
                "title": title, 
                "genres": genres,
                "poster": "" 
            }
            
            genre_str = " ".join(genres).lower() if isinstance(genres, list) else str(genres).lower()
            
            # Try to grab modern movies first
            year_match = re.search(r'\((\d{4})\)', title)
            if year_match and int(year_match.group(1)) > 2000:
                if "sci-fi" in genre_str or "action" in genre_str or "adventure" in genre_str:
                    if len(categories["Sci-Fi & Action"]) < 6:
                        categories["Sci-Fi & Action"].append(movie_item)
                elif "drama" in genre_str or "romance" in genre_str or "crime" in genre_str:
                    if len(categories["Drama & Classics"]) < 6:
                        categories["Drama & Classics"].append(movie_item)
                else:
                    if len(categories["Trending & Popular"]) < 6:
                        categories["Trending & Popular"].append(movie_item)

        # THE FIX: Fallback safety net so categories are NEVER empty
        all_movies = [
            {"id": p.id, "title": p.payload.get("title", "Movie"), "genres": p.payload.get("genres", []), "poster": ""} 
            for p in points
        ]
        
        if not categories["Sci-Fi & Action"] and len(all_movies) >= 6:
            categories["Sci-Fi & Action"] = all_movies[0:6]
        if not categories["Drama & Classics"] and len(all_movies) >= 12:
            categories["Drama & Classics"] = all_movies[6:12]
        if not categories["Trending & Popular"] and len(all_movies) >= 18:
            categories["Trending & Popular"] = all_movies[12:18]

        # 2. Fetch REAL posters using OMDb API
        omdb_api_key = os.getenv("OMDB_API_KEY")
        
        for category_name, movie_list in categories.items():
            for movie in movie_list:
                clean_title = movie["title"].split('(')[0].strip()
                
                # Default generic poster if OMDb fails
                movie["poster"] = f"https://ui-avatars.com/api/?name={clean_title.replace(' ', '+')}&background=random&size=512"
                
                if omdb_api_key:
                    try:
                        omdb_url = f"http://www.omdbapi.com/?apikey={omdb_api_key}&t={clean_title}"
                        response = requests.get(omdb_url, timeout=5)
                        
                        if response.status_code == 200:
                            data = response.json()
                            if data.get("Response") == "True" and data.get("Poster") and data.get("Poster") != "N/A":
                                movie["poster"] = fetch_poster_from_omdb(clean_title, omdb_api_key)
                    except Exception as e:
                        print(f"Failed to fetch poster for {clean_title}: {e}")

        formatted_categories = [
            {"title": cat_name, "movies": movieList} 
            for cat_name, movieList in categories.items() if movieList
        ]
        
        return {"status": "success", "categories": formatted_categories}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Catalog fetch failed: {str(e)}")



import time

# Optional: Simple in-memory cache to avoid query OMDb twice for the same movie
omdb_cache = {}

def fetch_poster_from_omdb(clean_title: str, api_key: str) -> str:
    if clean_title in omdb_cache:
        return omdb_cache[clean_title]
        
    fallback = f"https://ui-avatars.com/api/?name={clean_title.replace(' ', '+')}&background=random&size=512"
    
    if not api_key:
        return fallback

    url = "http://www.omdbapi.com/"
    for attempt in range(2): # Try twice if it times out
        try:
            params = {"apikey": api_key, "t": clean_title}
            response = requests.get(url, params=params, timeout=10) # Increased timeout to 10s
            
            if response.status_code == 200:
                data = response.json()
                if data.get("Response") == "True" and data.get("Poster") and data.get("Poster") != "N/A":
                    poster_url = data["Poster"]
                    omdb_cache[clean_title] = poster_url
                    return poster_url
        except requests.exceptions.Timeout:
            print(f"⚠️ OMDb timeout on attempt {attempt+1} for '{clean_title}', retrying...")
            time.sleep(1)
        except Exception as e:
            print(f"❌ OMDb error for '{clean_title}': {e}")
            break
            
    return fallback




@app.post("/recommend")
def get_vibe_recommendation(request: VibeRequest):
    anchor_vector = None
    anchor_title = "Selected Movie"

    try:
        # STEP 1: Try retrieving by the numeric ID first
        anchor_response = qdrant.retrieve(
            collection_name="movies",
            ids=[request.movie_id],
            with_vectors=True
        )
        if anchor_response:
            anchor_movie = anchor_response[0]
            anchor_vector = anchor_movie.vector
            anchor_title = anchor_movie.payload.get("title", "Selected Movie")
    except Exception:
        pass

    # STEP 2: Fallback — if ID lookup fails, search points by text payload to find a matching vector
    if anchor_vector is None:
        try:
            # Scroll or query points to find one matching the ID or grab a default anchor vector
            scroll_result = qdrant.scroll(
                collection_name="movies",
                limit=50,
                with_vectors=True
            )
            points = scroll_result[0]
            if points:
                # Pick the first available point as a safe fallback anchor
                anchor_vector = points[0].vector
                anchor_title = points[0].payload.get("title", "Default Movie")
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Could not anchor vector search: {str(e)}")

    if anchor_vector is None:
        raise HTTPException(status_code=404, detail="Anchor movie vector could not be resolved.")

    # STEP 3: Vector Search (Fetch 40 candidates)
    search_results = qdrant.search(
        collection_name="movies",
        query_vector=anchor_vector,
        limit=40
    )
    
    # STEP 4: Filter for movies strictly released AFTER the year 2000 in Python
    candidate_movies = []
    for hit in search_results:
        title = hit.payload.get("title", "")
        
        # Extract 4-digit year from title (e.g., "Inception (2010)")
        year_match = re.search(r'\((\d{4})\)', title)
        if year_match:
            movie_year = int(year_match.group(1))
            if movie_year > 2000:
                candidate_movies.append({
                    "title": title, 
                    "genres": hit.payload.get("genres", [])
                })
        
        if len(candidate_movies) >= 14:
            break

    if not candidate_movies:
        candidate_movies = [
            {"title": hit.payload["title"], "genres": hit.payload["genres"]} 
            for hit in search_results[:14]
        ]

    # STEP 5: LLM Re-ranking Agent
    prompt = f"""
    You are an expert movie curator. The user likes the movie '{anchor_title}'. 
    They are looking for something to watch next with this specific vibe: "{request.vibe_prompt}".
    
    Here is a list of candidate movies released after 2000:
    {candidate_movies}
    
    Review the candidates and select the 5 that best match the requested vibe. 
    Output your response as a valid JSON object containing a 'recommendations' array. Each item should have a 'title' and a 'reason' explaining why it matches the vibe.
    """

    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.5,
            response_format={"type": "json_object"}
        )
        
        vibe_results = json.loads(chat_completion.choices[0].message.content)
        recommendations = vibe_results.get("recommendations", [])
        
        # --- NEW CODE: Fetch Posters for the 5 Recommendations ---
        omdb_api_key = os.getenv("OMDB_API_KEY")
        
        for rec in recommendations:
            clean_title = rec.get("title", "").split('(')[0].strip()
            # Default placeholder
            rec["poster"] = f"https://ui-avatars.com/api/?name={clean_title.replace(' ', '+')}&background=random&size=512"
            
            if omdb_api_key:
                try:
                    params = {"apikey": omdb_api_key, "t": clean_title}
                    response = requests.get("http://www.omdbapi.com/", params=params, timeout=3)
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("Response") == "True" and data.get("Poster") and data.get("Poster") != "N/A":
                            rec["poster"] = data["Poster"]
                except Exception as e:
                    print(f"Error connecting to OMDb for recommendation {clean_title}: {e}")
        # ---------------------------------------------------------

        return {"status": "success", "data": {"recommendations": recommendations}}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Processing failed: {str(e)}")


@app.get("/trailer")
def get_movie_trailer(title: str):
    # 1. Clean title: strip out year parentheses like '(2010)' for better search accuracy
    clean_title = title.split('(')[0].strip()
    search_query = f"{clean_title} official trailer"
    
    print(f"🎬 [TRAILER SEARCH] Looking up YouTube for: '{clean_title}'")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    try:
        # Let the requests library handle the safe URL encoding automatically!
        url = "https://www.youtube.com/results"
        params = {"search_query": search_query}
        
        response = requests.get(url, params=params, headers=headers, timeout=5)

        if response.status_code == 200:
            # Import re safely here just in case it's missing at the top of the file
            import re
            
            # Match 11-character YouTube video IDs from the embedded JSON
            video_ids = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', response.text)
            
            if video_ids:
                # Remove duplicates while preserving order to grab the top result
                unique_ids = list(dict.fromkeys(video_ids))
                found_id = unique_ids[0]
                print(f"✅ [TRAILER FOUND] '{clean_title}' -> Video ID: {found_id}")
                return {"status": "success", "video_id": found_id}

    except Exception as e:
        print(f"❌ [TRAILER ERROR] YouTube lookup failed for '{clean_title}': {e}")

    # Fallback only if the HTTP request completely fails or finds nothing
    print(f"⚠️ [TRAILER FALLBACK] Used default fallback for '{clean_title}'")
    return {"status": "success", "video_id": "YoHD9XEInc0"}



@app.post("/vibe_search")
def vibe_search(request: VibeRequest):
    try:
        # 1. Grab a pool of modern movies from Qdrant
        scroll_result = qdrant.scroll(
            collection_name="movies", limit=100, with_payload=True, with_vectors=False
        )
        pool = [{"title": p.payload.get("title", ""), "genres": p.payload.get("genres", [])} for p in scroll_result[0]]
        
        # Filter for modern movies to save LLM tokens
        modern_pool = [m for m in pool if re.search(r'\((20[0-2][0-9])\)', m["title"])][:40]

        # 2. Ask Groq to curate a custom lineup based on the home screen vibe
        prompt = f"""
        The user is looking for this specific vibe: "{request.vibe_prompt}".
        Here is a pool of available movies: {modern_pool}
        Select the 8 best matching movies. Output valid JSON containing a 'recommendations' array. Each item needs a 'title' and a 'reason'.
        """
        
        chat_completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.6,
            response_format={"type": "json_object"}
        )
        
        results = json.loads(chat_completion.choices[0].message.content).get("recommendations", [])
        
        # 3. Fetch OMDb Posters for the curated list
        omdb_api_key = os.getenv("OMDB_API_KEY")
        for rec in results:
            clean_title = rec.get("title", "").split('(')[0].strip()
            rec["poster"] = f"https://ui-avatars.com/api/?name={clean_title.replace(' ', '+')}&background=random"
            
            if omdb_api_key:
                try:
                    res = requests.get("http://www.omdbapi.com/", params={"apikey": omdb_api_key, "t": clean_title}, timeout=3)
                    if res.status_code == 200 and res.json().get("Response") == "True":
                        rec["poster"] = res.json().get("Poster", rec["poster"])
                except: pass

        return {"status": "success", "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/details")
def get_movie_details(title: str):
    omdb_api_key = os.getenv("OMDB_API_KEY")
    if not omdb_api_key:
        raise HTTPException(status_code=500, detail="OMDb API key missing")
        
    clean_title = title.split('(')[0].strip()
    try:
        response = requests.get(
            "http://www.omdbapi.com/", 
            params={"apikey": omdb_api_key, "t": clean_title, "plot": "short"}, 
            timeout=5
        )
        if response.status_code == 200:
            return {"status": "success", "data": response.json()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




omdb_cache = {}

def fetch_poster_from_omdb(clean_title: str, api_key: str) -> str:
    if clean_title in omdb_cache:
        return omdb_cache[clean_title]
        
    fallback = f"https://ui-avatars.com/api/?name={clean_title.replace(' ', '+')}&background=random&size=512"
    
    if not api_key:
        return fallback

    url = "http://www.omdbapi.com/"
    for attempt in range(2): # Try twice if it times out
        try:
            params = {"apikey": api_key, "t": clean_title}
            response = requests.get(url, params=params, timeout=10) # Increased timeout to 10s
            
            if response.status_code == 200:
                data = response.json()
                if data.get("Response") == "True" and data.get("Poster") and data.get("Poster") != "N/A":
                    poster_url = data["Poster"]
                    omdb_cache[clean_title] = poster_url
                    return poster_url
        except requests.exceptions.Timeout:
            print(f"⚠️ OMDb timeout on attempt {attempt+1} for '{clean_title}', retrying...")
            time.sleep(1)
        except Exception as e:
            print(f"❌ OMDb error for '{clean_title}': {e}")
            break
            
    return fallback

    

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