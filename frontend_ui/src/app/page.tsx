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
  Play,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { API_BASE_URL } from "../../config/api";
import Loader from "./Loader";

// Array of bright, colorful gradients for category sections
const sectionGradients = [
  "from-blue-50 via-indigo-50 to-purple-50",
  "from-emerald-50 via-teal-50 to-cyan-50",
  "from-orange-50 via-amber-50 to-yellow-50",
  "from-pink-50 via-rose-50 to-red-50",
  "from-violet-50 via-fuchsia-50 to-pink-50",
];

export default function Home() {
  // UNIQUE USER ID STATE
  const [currentUserId, setCurrentUserId] = useState<number>(1);
  const [isUserIdLoaded, setIsUserIdLoaded] = useState(false);

  // Discovery State (Default Catalog)
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Personalized Recommendations State
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

  // 0. Initialize User ID on First Load
  useEffect(() => {
    let storedId = localStorage.getItem("vibecast_user_id");
    if (!storedId) {
      storedId = Math.floor(Math.random() * 998999 + 1000).toString();
      localStorage.setItem("vibecast_user_id", storedId);
    }
    setCurrentUserId(parseInt(storedId));
    setIsUserIdLoaded(true);
  }, []);

  // Load default catalog AND personalized recommendations on mount
  useEffect(() => {
    if (!isUserIdLoaded) return;

    fetch(`${API_BASE_URL}/catalog`)
      .then((res) => res.json())
      .then((data) => setCategories(data.categories || []))
      .finally(() => setLoadingCatalog(false));

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
  }, [currentUserId, isUserIdLoaded]);

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
    window.scrollTo({ top: 0, behavior: "smooth" });

    try {
      await fetch(`${API_BASE_URL}/user/watch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUserId, movie_id: movie.id }),
      });

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
    e.stopPropagation();
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20 relative selection:bg-violet-500/30 overflow-x-hidden">
      {/* Playful Background Blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-violet-400/20 rounded-full blur-3xl" />
        <div className="absolute top-[20%] right-[-5%] w-[30rem] h-[30rem] bg-pink-400/20 rounded-full blur-3xl" />
      </div>

      <header className="bg-white/70 backdrop-blur-xl border-b border-white/50 sticky top-0 z-20 shadow-sm">
        <div
          className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => {
            setActiveMovie(null);
            setVibeResults(null);
            setHomeVibe("");
          }}
        >
          <Sparkles className="text-violet-600 w-7 h-7" />
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-500 bg-clip-text text-transparent">
            Movie Magic
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8 relative z-10">
        {!activeMovie ? (
          <div className="space-y-12 pb-12">
            {/* VIBRANT VIBE SEARCH BAR */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 p-8 md:p-12 shadow-2xl shadow-violet-500/20 mt-4"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />

              <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
                <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm">
                  Find your perfect vibe.
                </h2>
                <p className="text-violet-100 text-sm md:text-lg max-w-xl mx-auto font-medium">
                  Type a mood, color, aesthetic, or wild plot idea—our AI will
                  curate the perfect movie magic for you.
                </p>

                <form
                  onSubmit={handleHomeVibeSearch}
                  className="flex flex-col sm:flex-row gap-3 pt-4"
                >
                  <input
                    type="text"
                    placeholder="e.g., A rainy neon city with a cyberpunk mystery..."
                    value={homeVibe}
                    onChange={(e) => setHomeVibe(e.target.value)}
                    className="flex-grow bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-6 py-4 text-base md:text-lg focus:outline-none focus:ring-4 focus:ring-white/30 text-white placeholder-white/60 shadow-inner transition-all font-medium"
                  />
                  <button
                    type="submit"
                    disabled={isSearchingVibe || !homeVibe.trim()}
                    className="bg-white text-violet-600 hover:bg-slate-50 font-black px-8 py-4 rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center min-w-[160px] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSearchingVibe ? (
                      <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                    ) : (
                      "Generate Magic"
                    )}
                  </button>
                </form>
              </div>
            </motion.div>

            {/* DYNAMIC VIBE RESULTS (Appears right below search when active) */}
            {vibeResults && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 bg-white p-6 md:p-8 rounded-[2rem] shadow-xl border border-slate-100"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl md:text-3xl font-black flex items-center gap-3 text-slate-800">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">
                      Custom Curated:
                    </span>{" "}
                    "{homeVibe}"
                  </h3>
                  <button
                    onClick={() => [setVibeResults(null), setHomeVibe("")]}
                    className="text-xs font-bold text-slate-400 hover:text-violet-600 uppercase tracking-wider bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Clear Search
                  </button>
                </div>
                <div className="flex gap-5 overflow-x-auto pb-6 pt-4 snap-x no-scrollbar">
                  {vibeResults.map((movie, idx) => (
                    <div key={idx} className="flex-shrink-0 snap-start">
                      <MovieCard
                        movie={movie}
                        onSelect={handleMovieSelect}
                        onInfo={openDetailsModal}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ALL HOME PAGE SECTIONS (Always visible now, below search/vibe results) */}
            <div className="space-y-12">
              {/* Personalized Rows */}
              {historyMovies.length > 0 && (
                <AnimatedSection
                  title="Jump Back In"
                  gradient="from-blue-50 to-indigo-100"
                  titleColor="text-blue-600"
                >
                  {historyMovies.map((movie: any, idx: number) => (
                    <div key={idx} className="flex-shrink-0 snap-start">
                      <MovieCard
                        movie={movie}
                        onSelect={handleMovieSelect}
                        onInfo={openDetailsModal}
                      />
                    </div>
                  ))}
                </AnimatedSection>
              )}

              {forYouMovies.length > 0 && (
                <AnimatedSection
                  title="Top Picks For You"
                  gradient="from-violet-50 to-fuchsia-100"
                  titleColor="text-violet-600"
                >
                  {forYouMovies.map((movie: any, idx: number) => (
                    <div key={idx} className="flex-shrink-0 snap-start">
                      <MovieCard
                        movie={movie}
                        onSelect={handleMovieSelect}
                        onInfo={openDetailsModal}
                      />
                    </div>
                  ))}
                </AnimatedSection>
              )}

              {peerMovies.length > 0 && (
                <AnimatedSection
                  title="Trending in Your Circle"
                  gradient="from-emerald-50 to-teal-100"
                  titleColor="text-teal-600"
                >
                  {peerMovies.map((movie: any, idx: number) => (
                    <div key={idx} className="flex-shrink-0 snap-start">
                      <MovieCard
                        movie={movie}
                        onSelect={handleMovieSelect}
                        onInfo={openDetailsModal}
                      />
                    </div>
                  ))}
                </AnimatedSection>
              )}

              {/* FALLBACK CATALOG SECTIONS */}
              {categories.map((category, idx) => (
                <AnimatedSection
                  key={idx}
                  title={category.title}
                  gradient={sectionGradients[idx % sectionGradients.length]}
                  titleColor="text-slate-800"
                >
                  {category.movies.map((movie: any) => (
                    <div key={movie.id} className="flex-shrink-0 snap-start">
                      <MovieCard
                        movie={movie}
                        onSelect={handleMovieSelect}
                        onInfo={openDetailsModal}
                      />
                    </div>
                  ))}
                </AnimatedSection>
              ))}
            </div>
          </div>
        ) : (
          /* BRIGHT WATCH VIEW */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col lg:flex-row gap-8 bg-white p-6 md:p-8 rounded-[2rem] shadow-2xl border border-slate-100"
          >
            <div className="flex-1 space-y-6">
              <button
                onClick={() => setActiveMovie(null)}
                className="flex items-center gap-2 text-slate-500 hover:text-violet-600 font-bold transition-colors bg-slate-100 hover:bg-violet-50 px-4 py-2 rounded-xl w-fit"
              >
                <ArrowLeft className="w-5 h-5" /> Back to Home
              </button>

              <div className="w-full aspect-video bg-slate-900 rounded-[2rem] overflow-hidden relative flex items-center justify-center shadow-2xl ring-4 ring-slate-100">
                {trailerId ? (
                  <iframe
                    className="w-full h-full absolute inset-0"
                    src={`https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&modestbranding=1&rel=0`}
                    allowFullScreen
                  />
                ) : (
                  <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
                )}
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">
                {activeMovie.title}
              </h2>
            </div>

            {/* SIDEBAR RECS */}
            <div className="w-full lg:w-1/3 space-y-4">
              <h3 className="text-2xl font-black mb-6 text-slate-800 border-b-2 border-slate-100 pb-4">
                Play Next
              </h3>
              <div className="space-y-4">
                {recommendations?.map((movie: any, idx: number) => (
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    key={idx}
                    onClick={() =>
                      handleMovieSelect({ title: movie.title, id: 9999 })
                    }
                    className="bg-slate-50 rounded-2xl shadow-sm border border-slate-200 p-4 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/10 transition-all cursor-pointer flex gap-4 group"
                  >
                    {movie.poster && (
                      <img
                        src={movie.poster}
                        alt={movie.title}
                        className="w-20 h-28 object-cover rounded-xl shadow-md shrink-0 group-hover:scale-105 transition-transform"
                      />
                    )}
                    <div className="flex flex-col justify-center">
                      <h4 className="font-bold text-slate-800 text-base mb-1 group-hover:text-violet-600 transition-colors line-clamp-2">
                        {movie.title}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-3">
                        {movie.reason}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* OMDb MOVIE DETAILS MODAL */}
      {modalMovie && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setModalMovie(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-56 md:h-72 bg-slate-900 shrink-0">
              {modalMovie.poster && (
                <img
                  src={modalMovie.poster}
                  className="w-full h-full object-cover opacity-60"
                  alt="Backdrop"
                />
              )}
              <button
                onClick={() => setModalMovie(null)}
                className="absolute top-4 right-4 bg-white/20 backdrop-blur-md text-white p-2.5 rounded-full hover:bg-violet-500 transition-colors shadow-lg"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-0 left-0 p-6 md:p-8 bg-gradient-to-t from-white via-white/80 to-transparent w-full">
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 drop-shadow-sm mt-10">
                  {modalMovie.title}
                </h2>
              </div>
            </div>

            <div className="p-6 md:p-8 min-h-[250px] bg-white">
              {loadingDetails ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                  <span className="font-medium">Fetching studio magic...</span>
                </div>
              ) : movieDetails ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-2 md:gap-3 items-center text-xs md:text-sm font-bold text-slate-600 border-b border-slate-100 pb-5">
                    <span className="bg-slate-100 px-4 py-1.5 rounded-full text-slate-700">
                      {movieDetails.Year}
                    </span>
                    <span className="bg-slate-100 px-4 py-1.5 rounded-full text-slate-700">
                      {movieDetails.Runtime}
                    </span>
                    <span className="bg-slate-100 px-4 py-1.5 rounded-full text-slate-700">
                      {movieDetails.Genre}
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-4 py-1.5 rounded-full border border-amber-100">
                      <Star className="w-4 h-4 fill-current" />
                      {movieDetails.imdbRating}
                    </span>
                  </div>
                  <p className="text-slate-600 text-sm md:text-lg leading-relaxed font-medium">
                    {movieDetails.Plot}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div>
                      <strong className="block text-slate-900 mb-1 font-bold text-base">
                        Director
                      </strong>
                      <span className="text-slate-600 font-medium">
                        {movieDetails.Director}
                      </span>
                    </div>
                    <div>
                      <strong className="block text-slate-900 mb-1 font-bold text-base">
                        Top Cast
                      </strong>
                      <span className="text-slate-600 font-medium">
                        {movieDetails.Actors}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-center mt-10 font-medium">
                  Metadata could not be found for this title.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ANIMATED SECTION WRAPPER
function AnimatedSection({ title, children, gradient, titleColor }: any) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`p-6 md:p-8 rounded-[2rem] bg-gradient-to-br ${gradient} shadow-lg border border-white/50 relative overflow-hidden`}
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/40 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3 pointer-events-none" />
      <h2
        className={`text-2xl md:text-3xl font-black mb-6 flex items-center gap-3 relative z-10 ${titleColor}`}
      >
        {title}
      </h2>
      <div className="flex gap-5 overflow-x-auto pb-4 pt-2 snap-x no-scrollbar relative z-10">
        {children}
      </div>
    </motion.section>
  );
}

// BRIGHT & COLORFUL MOVIE CARD
function MovieCard({ movie, onSelect, onInfo }: any) {
  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -8 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="group relative w-[180px] sm:w-[210px] md:w-[240px] h-[270px] sm:h-[315px] md:h-[360px] bg-white rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50 border-[3px] border-white hover:border-violet-300 hover:shadow-2xl hover:shadow-violet-500/30 cursor-pointer flex-shrink-0"
    >
      <div
        onClick={() => onSelect(movie)}
        className="relative w-full h-full overflow-hidden bg-slate-100"
      >
        <img
          src={movie.poster}
          alt={movie.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
          <div className="w-full flex items-center justify-between gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            <button className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white px-3 py-2.5 rounded-xl font-black flex items-center gap-1.5 text-xs sm:text-sm shadow-xl transition-transform active:scale-95 flex-grow justify-center">
              <Play className="w-4 h-4 fill-current" /> Watch
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onInfo(movie, e);
              }}
              className="bg-white/20 hover:bg-white/40 text-white p-2.5 rounded-xl backdrop-blur-md transition-colors border border-white/30 shadow-xl"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
