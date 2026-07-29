# 🎬 Movie Magic: AI-Powered Movie Recommender

[![PyTorch](https://img.shields.io/badge/PyTorch-%23EE4C2C.svg?style=for-the-badge&logo=PyTorch&logoColor=white)](https://pytorch.org/)
[![Kaggle](https://img.shields.io/badge/Dataset-Kaggle-20BEFF?style=for-the-badge&logo=Kaggle&logoColor=white)](https://www.kaggle.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Qdrant](https://img.shields.io/badge/Vector_DB-Qdrant-orange?style=for-the-badge&logo=qdrant)](https://qdrant.tech/)
[![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)

**Movie Magic** is an end-to-end AI recommendation system that revolutionizes content discovery. By combining custom-trained Neural Collaborative Filtering (NCF) in PyTorch with vector database retrieval, the platform learns deep, non-linear relationships between users and movies to deliver highly personalized cinematic magic.

---

## 🧠 AI & Machine Learning Architecture

The core recommendation engine of Movie Magic was built from scratch using PyTorch. Instead of relying on pre-trained models, we trained a custom neural network that bridges the gap between raw relational tables, random weight matrices, and learned intelligence mapping out human tastes.

### 1. Data Pipeline & Ground Truth Generation (MovieLens via Kaggle)
  We utilized the MovieLens dataset (sourced via Kaggle) which contains historical logs of real human behaviors (`user_id`, `movie_id`, `rating`, `timestamp`). 
  
  To frame this as a deep learning classification problem, we generated our own ground truth labels by binarizing the human feedback:
  
  ```python
  # 1 means the user liked the movie, 0 means they didn't care for it
  ratings['label'] = (ratings['rating'] >= 4.0).astype(float)
  ```
  We then mapped raw, disjointed relational IDs into continuous integer rows so PyTorch’s embedding lookup tables (nn.Embedding) could process them efficiently:
  ```
  ratings['user_idx'] = ratings['user_id'].astype('category').cat.codes
  ratings['movie_idx'] = ratings['movie_id'].astype('category').cat.codes
  ```
2. PyTorch Two-Tower Model Architecture

   The system uses a Two-Tower (Dual-Encoder) design pattern to decouple user and movie representations before combining them for interaction scoring:
     * User Tower: Encapsulates user identities through dedicated embedding lookup tables to learn a dense latent vector representing user preference profiles.
     * Movie Tower: Encapsulates movie IDs into a parallel embedding table to learn latent cinematic features.
     * Interaction Layer: During the forward pass (model(u, m)), the network extracts the respective user and movie vectors from their separate towers, combines them, and passes them through fully connected layers (self.fc) to output a preference score.


3. The Training Loop (Learning Intelligence)

     By repeating the training loop across thousands of real user ratings, the model transformed from a table of random numbers into a highly structured mapping of human tastes.
      * Forward Pass: The model takes a batch of user indices (u) and movie indices (m), performs the embedding lookups, concatenates them, and outputs a prediction.
      * Loss Calculation: We utilized BCEWithLogitsLoss(preds, y) to compare the model's prediction score against the real human label y (whether they actually rated it $\ge 4.0$). Initially, this yields a high error.
      * Backpropagation (loss.backward()): PyTorch's autograd engine traces backward through the linear and embedding layers, calculating the exact gradient (blame) for every single parameter.
      * Weight Adjustment (optimizer.step()): The Adam optimizer, configured with a learning rate of 0.01, tweaks the numbers inside the embedding tables to minimize the loss in future passes.


🏗️ System Architecture

```
┌──────────────────────┐         HTTP / REST         ┌───────────────────────┐
 │                      │ ──────────────────────────> │                       │
 │  Next.js Frontend    │                             │  FastAPI (Python)     │
 │  (Next + Tailwind)  │ <────────────────────────── │  ML Inference API     │
 │                      │             JSON            │                       │
 └──────────────────────┘                             └──────┬─────────┬──────┘
                                                             │         │
                                      PyTorch Model Weights  │         │ Vector Retrieval
                                      (User/Movie Embeds)    │         │ (History/Similarity)
                                                             v         v
                                                      ┌───────────────────────┐
                                                      │                       │
                                                      │ Qdrant Vector Engine  │
                                                      │                       │
                                                      └───────────────────────┘
```

✨ Features
  * Custom Deep Learning Engine: Recommendations driven by a scratch-built PyTorch embedding architecture trained on real human interactions
  * Real-Time Profile Adaptation: Watch history triggers updates to the user's vector profile, dynamically shifting their "Recommended For You" carousels.
  * Peer-to-Peer Collaborative Filtering: Utilizes vector math to find users with high cosine similarity, recommending what similar cinematic tastes are watching.
  * Fluid, Animated UI: Designed with Tailwind CSS and Framer Motion for a premium, browsing experience.


🚀 Getting Started

Prerequisites
```
  Python 3.10+ & PyTorch
  Node.js (v18+)
  Qdrant Cloud API Key
  OMDb API Key
```

1. ML Environment & Backend Setup
  Clone the repository and setup the Python environment:
```
  git clone [https://github.com/yourusername/movie-magic.git](https://github.com/yourusername/movie-magic.git)
  cd movie-magic/backend_api
  python -m venv venv
  source venv/bin/activate  # Windows: venv\Scripts\activate
```
2. Install the ML and backend dependencies:
```
  pip install torch fastapi uvicorn qdrant-client pandas numpy python-dotenv
```
3. Set up your .env file:
```
  QDRANT_URL=your_qdrant_cluster_url
  QDRANT_API_KEY=your_qdrant_api_key
  OMDB_API_KEY=your_omdb_api_key
```
4. Start the inference API:
 ```
  uvicorn main:app --reload --port 8000
```


2. Frontend Setup

  Open a new terminal and navigate to the frontend:
   ```
    cd ../frontend
    npm install
```
  Run the Next.js server:
  ```
  npm run dev
  Open http://localhost:3000 to interact with Movie Magic.
```
🤝 Let's Connect

  I built Movie Magic to demonstrate my ability to engineer Machine Learning models from raw data sets and mathematics into fully functional, full-stack production environments. If you are hiring AI Engineers, Machine Learning Engineers, or Backend Engineers focused on AI infrastructure, let's talk!

  [LinkedIn](https://www.linkedin.com/in/manojkumar-b-34182727b/) | [Portfolio](https://manojkumarportfolio-01.vercel.app/) | mkbellerimath@gmail.com
  
