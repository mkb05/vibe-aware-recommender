"use client";

import { useState, useEffect, FormEvent } from "react";
import {
  Film,
  PlayCircle,
  ArrowLeft,
  Loader2,
  ExternalLink,
  Info,
  X,
  Star,
} from "lucide-react";
import { API_BASE_URL } from "../../config/api";
import Loader from "./Loader";

export default function Home() {
  // Simulate a logged-in user (User ID 1 from MovieLens)
  const currentUserId = 1;

  // Discovery State (Default Catalog)
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // NEW: Personalized Recommendations State
  const [historyMovies, setHistoryMovies] = useState<any[]>([]);
  const [forYouMovies, setForYouMovies] = useState<any[]>([]);
  const [peerMovies, setPeerMovies] = useState<any[]>([]);
  const [loadingPersonalized, setLoadingPersonalized] = useState(true);

  // Vibe Search State
  const [homeVibe, setHomeVibe] = useState("");
  const [vibeResults, setVibeResults] = useState<any[] | null>(null);
  const [isSearchingVibe, setIsSearchingVibe] = useState(false);

  // Player & Details State
  const [activeMovie, setActiveMovie] = useState<any>(null);
  const [trailerId, setTrailerId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any>(null);

  // Modal State
  const [modalMovie, setModalMovie] = useState<any>(null);
  const [movieDetails, setMovieDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Load default catalog AND personalized recommendations on mount
  useEffect(() => {
    // 1. Fetch Default Catalog
    fetch(`${API_BASE_URL}/catalog`)
      .then((res) => res.json())
      .then((data) => setCategories(data.categories || []))
      .finally(() => setLoadingCatalog(false));

    // 2. Fetch Personalized Data for the logged-in user
    const fetchPersonalizedData = async () => {
      try {
        const [historyRes, forYouRes, peerRes] = await Promise.all([
          fetch(`${API_BASE_URL}/user/${currentUserId}/history`),
          fetch(`${API_BASE_URL}/recommendations/for-you/${currentUserId}`),
          fetch(
            `${API_BASE_URL}/recommendations/similar-users/${currentUserId}`,
          ),
        ]);

        const historyData = await historyRes.json();
        const forYouData = await forYouRes.json();
        const peerData = await peerRes.json();

        // Depending on FastAPI, data might be direct array or wrapped in { data: [...] }
        setHistoryMovies(
          Array.isArray(historyData) ? historyData : historyData.data || [],
        );
        setForYouMovies(
          Array.isArray(forYouData) ? forYouData : forYouData.data || [],
        );
        setPeerMovies(Array.isArray(peerData) ? peerData : peerData.data || []);
      } catch (error) {
        console.error("Failed to load personalized recommendations", error);
      } finally {
        setLoadingPersonalized(false);
      }
    };

    fetchPersonalizedData();
  }, [currentUserId]);

  // 1. Homepage Vibe Search
  const handleHomeVibeSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!homeVibe.trim()) return;

    setIsSearchingVibe(true);
    setVibeResults(null);
    try {
      const res = await fetch(`${API_BASE_URL}/vibe_search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movie_id: 0, vibe_prompt: homeVibe }),
      });
      const data = await res.json();
      setVibeResults(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingVibe(false);
    }
  };

  if (loadingCatalog && loadingPersonalized) {
    return <Loader message="Waking up the recommendation engine..." />;
  }

  // 2. Play Trailer & Fetch Recs
  const handleMovieSelect = async (movie: any) => {
    setActiveMovie(movie);
    setTrailerId(null);
    setRecommendations(null);
    window.scrollTo(0, 0);

    // 1. Log this movie to the backend history store
    try {
      await fetch(`${API_BASE_URL}/user/watch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUserId, movie_id: movie.id }),
      });

      // 2. Refresh personalized home data immediately after logging
      const [historyRes, forYouRes] = await Promise.all([
        fetch(`${API_BASE_URL}/user/${currentUserId}/history`),
        fetch(`${API_BASE_URL}/recommendations/for-you/${currentUserId}`),
      ]);

      const historyData = await historyRes.json();
      const forYouData = await forYouRes.json();

      setHistoryMovies(
        Array.isArray(historyData) ? historyData : historyData.data || [],
      );
      setForYouMovies(
        Array.isArray(forYouData) ? forYouData : forYouData.data || [],
      );
    } catch (err) {
      console.error("Failed to update user watch history", err);
    }

    try {
      const trailerRes = await fetch(
        `${API_BASE_URL}/trailer?title=${encodeURIComponent(movie.title)}`,
      );
      const trailerData = await trailerRes.json();
      setTrailerId(trailerData.video_id || "zSWdZVtXT7E");
    } catch {
      setTrailerId("zSWdZVtXT7E");
    }

    fetchRecommendations(
      movie.id || 9999,
      "I want something visually stunning and gripping.",
    );
  };

  const fetchRecommendations = async (movieId: any, currentVibe: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movie_id: movieId, vibe_prompt: currentVibe }),
      });
      const data = await response.json();
      setRecommendations(data.data?.recommendations || []);
    } catch (error) {
      console.error(error);
    }
  };

  // 3. Info Modal Fetch
  const openDetailsModal = async (movie: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the trailer click
    setModalMovie(movie);
    setLoadingDetails(true);
    setMovieDetails(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/details?title=${encodeURIComponent(movie.title)}`,
      );
      const data = await res.json();
      if (data.data?.Response === "True") {
        setMovieDetails(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 font-sans pb-20 relative">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-xs">
        <div
          className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-2 cursor-pointer"
          onClick={() => {
            setActiveMovie(null);
            setVibeResults(null);
            setHomeVibe("");
          }}
        >
          <PlayCircle className="text-emerald-500 w-8 h-8" />
          <h1 className="text-xl font-bold tracking-tight">VibeCast</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        {!activeMovie ? (
          <div className="space-y-12">
            {/* HERO VIBE SEARCH */}
            <div className="bg-slate-900 rounded-2xl p-6 md:p-12 text-center shadow-xl">
              <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
                What's your vibe today?
              </h2>
              <p className="text-slate-400 mb-8 max-w-2xl mx-auto text-sm md:text-base">
                Describe the exact mood, setting, or feeling you want, and our
                AI curator will build a custom lineup just for you.
              </p>

              <form
                onSubmit={handleHomeVibeSearch}
                className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3"
              >
                <input
                  type="text"
                  placeholder="e.g., A rainy night mystery with a massive plot twist..."
                  value={homeVibe}
                  onChange={(e) => setHomeVibe(e.target.value)}
                  className="flex-1 rounded-xl p-4 text-base md:text-lg focus:outline-none focus:ring-4 focus:ring-emerald-500/50 shadow-inner bg-white text-gray-900 placeholder-gray-400"
                />
                <button
                  type="submit"
                  disabled={isSearchingVibe || !homeVibe.trim()}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white py-3 sm:py-0 px-8 rounded-xl font-bold text-lg transition-all disabled:opacity-70 flex items-center justify-center min-w-[140px]"
                >
                  {isSearchingVibe ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    "Curate"
                  )}
                </button>
              </form>
            </div>

            {/* DYNAMIC VIBE RESULTS */}
            {vibeResults && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-xl md:text-2xl font-bold flex items-center gap-2 border-l-4 border-emerald-500 pl-3">
                  Custom Curated for: "{homeVibe}"
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar">
                  {vibeResults.map((movie, idx) => (
                    <div
                      key={idx}
                      className="min-w-[160px] sm:min-w-[200px] md:min-w-[240px] flex-shrink-0 snap-start"
                    >
                      <MovieCard
                        movie={movie}
                        onSelect={handleMovieSelect}
                        onInfo={openDetailsModal}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DEFAULT CATALOG & PERSONALIZED SECTIONS */}
            {!vibeResults && (
              <div className="space-y-12">
                {/* Section 1: Based on your history */}
                {historyMovies.length > 0 && (
                  <section>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-l-4 border-emerald-500 pl-3">
                      History
                    </h2>
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                      {historyMovies.map((movie: any, idx: number) => (
                        <div
                          key={idx}
                          className="min-w-[160px] sm:min-w-[200px] md:min-w-[240px] snap-start"
                        >
                          <MovieCard
                            movie={movie}
                            onSelect={handleMovieSelect}
                            onInfo={openDetailsModal}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Section 2: Recommended for you */}
                {forYouMovies.length > 0 && (
                  <section>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-l-4 border-blue-500 pl-3">
                      Recommended For You
                    </h2>
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                      {forYouMovies.map((movie: any, idx: number) => (
                        <div
                          key={idx}
                          className="min-w-[160px] sm:min-w-[200px] md:min-w-[240px] snap-start"
                        >
                          <MovieCard
                            movie={movie}
                            onSelect={handleMovieSelect}
                            onInfo={openDetailsModal}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Section 3: Users with similar interest */}
                {peerMovies.length > 0 && (
                  <section>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-l-4 border-purple-500 pl-3">
                      Users with Similar Interests Are Watching
                    </h2>
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                      {peerMovies.map((movie: any, idx: number) => (
                        <div
                          key={idx}
                          className="min-w-[160px] sm:min-w-[200px] md:min-w-[240px] snap-start"
                        >
                          <MovieCard
                            movie={movie}
                            onSelect={handleMovieSelect}
                            onInfo={openDetailsModal}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* FALLBACK CATALOG (If no personalization exists yet) */}
                {categories.map((category, idx) => (
                  <div key={idx} className="space-y-4">
                    <h3 className="text-lg md:text-xl font-bold flex items-center gap-2 border-l-4 border-emerald-500 pl-3">
                      {category.title}
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar">
                      {category.movies.map((movie: any) => (
                        <div
                          key={movie.id}
                          className="min-w-[160px] sm:min-w-[200px] md:min-w-[240px] flex-shrink-0 snap-start"
                        >
                          <MovieCard
                            movie={movie}
                            onSelect={handleMovieSelect}
                            onInfo={openDetailsModal}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* WATCH VIEW (Unchanged) */
          <div className="flex flex-col lg:flex-row gap-8">
            {/* ... Your existing watch view code ... */}
            <div className="flex-1 space-y-4 md:space-y-6">
              <button
                onClick={() => setActiveMovie(null)}
                className="flex items-center gap-2 text-gray-500 hover:text-emerald-600 font-semibold transition-colors"
              >
                <ArrowLeft className="w-5 h-5" /> Back to Home
              </button>
              {/* PLAYER */}
              <div className="w-full aspect-video bg-slate-900 rounded-xl overflow-hidden relative flex items-center justify-center">
                {trailerId ? (
                  <iframe
                    className="w-full h-full absolute inset-0"
                    src={`https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&modestbranding=1&rel=0`}
                    allowFullScreen
                  />
                ) : (
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                )}
              </div>
              <h2 className="text-2xl md:text-3xl font-bold">
                {activeMovie.title}
              </h2>
            </div>

            {/* SIDEBAR RECS */}
            <div className="w-full lg:w-1/3 space-y-4">
              <h3 className="text-xl font-bold mb-4">Up Next</h3>
              {recommendations?.map((movie: any, idx: number) => (
                <div
                  key={idx}
                  onClick={() =>
                    handleMovieSelect({ title: movie.title, id: 9999 })
                  }
                  className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 hover:border-emerald-500 transition-all cursor-pointer flex gap-4"
                >
                  {movie.poster && (
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="w-16 h-24 object-cover rounded-md shadow-sm shrink-0"
                    />
                  )}
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm mb-1">
                      {movie.title}
                    </h4>
                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                      {movie.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* OMDb MOVIE DETAILS MODAL (Unchanged) */}
      {modalMovie && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setModalMovie(null)}
        >
          {/* ... Modal code remains identical ... */}
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-48 md:h-64 bg-slate-900 shrink-0">
              {modalMovie.poster && (
                <img
                  src={modalMovie.poster}
                  className="w-full h-full object-cover opacity-50"
                  alt="Backdrop"
                />
              )}
              <button
                onClick={() => setModalMovie(null)}
                className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-0 left-0 p-4 md:p-6 bg-gradient-to-t from-black/90 to-transparent w-full">
                <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-md">
                  {modalMovie.title}
                </h2>
              </div>
            </div>

            <div className="p-4 md:p-8 min-h-[250px]">
              {loadingDetails ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />{" "}
                  Fetching studio data...
                </div>
              ) : movieDetails ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-2 md:gap-3 items-center text-xs md:text-sm font-medium text-slate-600 border-b pb-4">
                    <span className="bg-slate-100 px-3 py-1 rounded-full">
                      {movieDetails.Year}
                    </span>
                    <span className="bg-slate-100 px-3 py-1 rounded-full">
                      {movieDetails.Runtime}
                    </span>
                    <span className="bg-slate-100 px-3 py-1 rounded-full">
                      {movieDetails.Genre}
                    </span>
                    <span className="flex items-center gap-1 text-amber-500 bg-amber-50 px-3 py-1 rounded-full">
                      <Star className="w-4 h-4 fill-current" />{" "}
                      {movieDetails.imdbRating}
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm md:text-lg leading-relaxed">
                    {movieDetails.Plot}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong className="block text-gray-900 mb-1">
                        Director
                      </strong>
                      <span className="text-gray-600">
                        {movieDetails.Director}
                      </span>
                    </div>
                    <div>
                      <strong className="block text-gray-900 mb-1">
                        Top Cast
                      </strong>
                      <span className="text-gray-600">
                        {movieDetails.Actors}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center mt-10">
                  Metadata could not be found for this title.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable Movie Card Component (Unchanged)
function MovieCard({
  movie,
  onSelect,
  onInfo,
}: {
  movie: any;
  onSelect: any;
  onInfo: any;
}) {
  return (
    <div
      onClick={() => onSelect(movie)}
      className="group relative h-56 sm:h-72 bg-slate-900 rounded-xl overflow-hidden cursor-pointer hover:ring-4 hover:ring-emerald-500 transition-all shadow-md flex items-end p-3 sm:p-4"
    >
      {movie.poster && (
        <img
          src={movie.poster}
          alt={movie.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent sm:group-hover:from-black/90 transition-colors" />

      <div className="relative z-10 w-full">
        <h4 className="text-white font-bold text-sm sm:text-lg leading-tight mb-2 sm:mb-3 drop-shadow-md line-clamp-2">
          {movie.title}
        </h4>

        <div className="flex gap-2 opacity-100 translate-y-0 sm:opacity-0 sm:translate-y-4 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 transition-all duration-300">
          <button className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold py-1.5 sm:py-2 rounded-lg flex items-center justify-center gap-1 sm:gap-1.5 shadow-lg">
            <PlayCircle className="w-4 h-4" />{" "}
            <span className="hidden sm:inline">Play</span>
          </button>
          <button
            onClick={(e) => onInfo(movie, e)}
            className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-bold px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg flex items-center justify-center shadow-lg"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
