import os
import redis
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

# 1. Load the secrets from the .env file at the project root
load_dotenv(dotenv_path="../.env")

def init_qdrant():
    print("Connecting to Qdrant Cloud...")
    client = QdrantClient(
        url=os.getenv("QDRANT_URL"),
        api_key=os.getenv("QDRANT_API_KEY")
    )
    
    collection_name = "movies"
    
    # FETCH ALL COLLECTIONS AND CHECK NAMES
    existing_collections = client.get_collections().collections
    collection_names = [col.name for col in existing_collections]
    
    # 2. Check if the collection is in the list
    if collection_name not in collection_names:
        print(f"Creating collection: '{collection_name}'...")
        # We configure it for 128 dimensions, which is what our PyTorch model will output
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=128, distance=Distance.COSINE),
        )
        print("✅ Qdrant Collection initialized successfully!")
    else:
        print(f"✅ Qdrant Collection '{collection_name}' already exists.")

def init_redis():
    print("\nConnecting to Upstash Redis...")
    try:
        # Upstash provides a REST URL, but for standard python redis client, 
        # you extract the host and password from the Upstash dashboard's TCP connection string.
        # Alternatively, we just verify the REST keys are loaded.
        if os.getenv("UPSTASH_REDIS_REST_URL") and os.getenv("UPSTASH_REDIS_REST_TOKEN"):
             print("✅ Upstash Redis keys loaded successfully!")
        else:
             print("❌ Upstash Redis keys missing.")
    except Exception as e:
        print(f"❌ Redis Connection Failed: {e}")

if __name__ == "__main__":
    init_qdrant()
    init_redis()
    print("\n🚀 Infrastructure is ready for the ML pipeline!")