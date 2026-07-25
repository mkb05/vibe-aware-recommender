"use client";

import { useState, useEffect, FormEvent } from "react";
import {
  Film,
  PlayCircle,
  ArrowLeft,
  Loader2,
  ExternalLink,
} from "lucide-react";

export default function Home() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [activeMovie, setActiveMovie] = useState<any>(null);
  const [trailerId, setTrailerId] = useState<string | null>(null);
  const [vibe, setVibe] = useState(
    "I want movies with a similar atmosphere, pacing, and visual style.",
  );
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [recommendations, setRecommendations] = useState<any>(null);

  // Fetch dynamic catalog from FastAPI on mount
  useEffect(() => {
    fetch("http://127.0.0.1:8000/catalog")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.categories) {
          setCategories(data.categories);
        }
      })
      .catch((err) => console.error("Failed to load catalog", err))
      .finally(() => setLoadingCatalog(false));
  }, []);

  const handleMovieSelect = async (movie: any) => {
    setActiveMovie(movie);
    setTrailerId(null);
    setRecommendations(null);
    window.scrollTo(0, 0);

    // 1. Fetch Trailer
    try {
      const trailerRes = await fetch(
        `http://127.0.0.1:8000/trailer?title=${encodeURIComponent(movie.title)}`,
      );
      const trailerData = await trailerRes.json();
      if (trailerData.video_id) setTrailerId(trailerData.video_id);
    } catch (err) {
      console.error("Failed to load trailer", err);
      setTrailerId("zSWdZVtXT7E"); // Universal fallback
    }

    // 2. Auto-fetch initial recommendations based on the default vibe
    fetchRecommendations(movie.id, vibe);
  };

  const fetchRecommendations = async (movieId: any, currentVibe: string) => {
    setLoadingRecs(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movie_id: movieId, vibe_prompt: currentVibe }),
      });
      const data = await response.json();
      if (data && data.data) {
        setRecommendations(data.data.recommendations);
      }
    } catch (error) {
      console.error("Failed to fetch recommendations", error);
    } finally {
      setLoadingRecs(false);
    }
  };

  const handleVibeUpdate = (e: FormEvent) => {
    e.preventDefault();
    if (activeMovie) fetchRecommendations(activeMovie.id, vibe);
  };

  // Allow clicking a recommendation to dynamically load its trailer and new recs
  const handleRecommendationClick = async (recTitle: string) => {
    handleMovieSelect({ id: 99999, title: recTitle });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 font-sans pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-xs">
        <div
          className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-2 cursor-pointer"
          onClick={() => setActiveMovie(null)}
        >
          <PlayCircle className="text-emerald-500 w-8 h-8" />
          <h1 className="text-xl font-bold tracking-tight">VibeCast</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* VIEW 1: DISCOVERY HOME SCREEN */}
        {!activeMovie ? (
          <div className="space-y-10">
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">
                What's your vibe today?
              </h2>
              <p className="text-gray-500">
                Explore movies dynamically pulled from your database and stream
                trailers instantly.
              </p>
            </div>

            {loadingCatalog ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <span className="ml-2 text-gray-500 font-medium">
                  Loading live database catalog...
                </span>
              </div>
            ) : (
              categories.map((category, idx) => (
                <div key={idx} className="space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-2 border-l-4 border-emerald-500 pl-3">
                    {category.title}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {category.movies.map((movie: any) => (
                      <div
                        key={movie.id}
                        onClick={() => handleMovieSelect(movie)}
                        className="group relative h-64 bg-slate-900 rounded-xl overflow-hidden cursor-pointer hover:ring-4 hover:ring-emerald-500 transition-all shadow-md flex items-end p-4"
                      >
                        {/* Movie Thumbnail Background Image */}
                        {movie.poster && (
                          <img
                            src={movie.poster}
                            alt={movie.title}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        )}

                        {/* Dark Gradient Overlay for text visibility */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent group-hover:from-black/95 transition-colors" />

                        {/* Movie Title */}
                        <h4 className="relative text-white font-bold text-base z-10 leading-tight drop-shadow-md">
                          {movie.title}
                        </h4>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* VIEW 2: WATCH PAGE (YOUTUBE STYLE) */
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left Column: Player & Vibe Control */}
            <div className="flex-1 space-y-6">
              <button
                onClick={() => setActiveMovie(null)}
                className="flex items-center gap-2 text-gray-500 hover:text-emerald-600 font-semibold transition-colors"
              >
                <ArrowLeft className="w-5 h-5" /> Back to Home
              </button>

              {/* Secure Video Player container with direct YouTube fallback button */}
              <div className="w-full aspect-video bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-gray-200 flex flex-col items-center justify-center relative">
                {trailerId ? (
                  <>
                    <iframe
                      className="w-full h-full absolute inset-0"
                      src={`https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&modestbranding=1&rel=0`}
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                    {/* Floating backup watch button in case browser blocks iframe */}
                    <a
                      href={`https://www.youtube.com/watch?v=${trailerId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-3 right-3 bg-black/70 hover:bg-black text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 backdrop-blur-xs transition-all z-10"
                    >
                      Watch on YouTube <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-white">
                    <Loader2 className="w-8 h-8 animate-spin mb-2 text-emerald-500" />
                    <p>Loading Trailer...</p>
                  </div>
                )}
              </div>

              <h2 className="text-2xl font-bold">{activeMovie.title}</h2>

              {/* Vibe Refiner Engine */}
              <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Film className="w-5 h-5 text-emerald-500" /> Refine Your Next
                  Vibe
                </h3>
                <form onSubmit={handleVibeUpdate} className="flex gap-3">
                  <input
                    type="text"
                    value={vibe}
                    onChange={(e) => setVibe(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg p-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={loadingRecs}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 rounded-lg font-semibold transition-colors disabled:opacity-70"
                  >
                    Update
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Recommendations Feed */}
            <div className="w-full lg:w-1/3 space-y-4">
              <h3 className="text-xl font-bold mb-4">
                Up Next (5 Curated Picks)
              </h3>

              {loadingRecs ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((skeleton) => (
                    <div
                      key={skeleton}
                      className="h-32 bg-gray-200 animate-pulse rounded-xl"
                    />
                  ))}
                </div>
              ) : (
                recommendations &&
                recommendations.map((movie: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => handleRecommendationClick(movie.title)}
                    className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group flex gap-4 items-start"
                  >
                    {/* Tiny Poster Thumbnail */}
                    {movie.poster && (
                      <img
                        src={movie.poster}
                        alt={movie.title}
                        className="w-16 h-24 object-cover rounded-md shadow-sm shrink-0 group-hover:scale-105 transition-transform"
                      />
                    )}

                    {/* Text Content */}
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-1 group-hover:text-emerald-600 transition-colors flex items-start justify-between text-sm">
                        {movie.title}
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-normal shrink-0 ml-2 mt-0.5">
                          Play
                        </span>
                      </h4>
                      <p className="text-xs text-gray-600 leading-relaxed bg-emerald-50/50 p-2 rounded-lg border border-emerald-100 mt-2">
                        <strong className="text-emerald-700">Match: </strong>
                        {movie.reason}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
