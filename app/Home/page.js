"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Info, X, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NavBar from "@/components/NavBar";
import ItemPostModal from "@/components/ItemPostModal";
import MarqueeTitle from "@/components/MarqueeTitle";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { supabase } from "@/lib/supabase";

// ─── Dynamic Greeting Engine ───
// Returns a context-aware greeting based on the current hour and day of week.
function getGreeting() {
  const hour = new Date().getHours();
  const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) {
    if (hour >= 5 && hour < 12) return "Happy weekend morning ☀️";
    if (hour >= 12 && hour < 17) return "Enjoying the weekend? 🎉";
    return "Weekend vibes 🌙";
  }

  if (hour >= 5 && hour < 12) return "Good morning ☀️";
  if (hour >= 12 && hour < 17) return "Good afternoon 👋";
  if (hour >= 17 && hour < 21) return "Good evening 🌅";
  return "Burning the midnight oil? 🌙";
}

// Returns an engaging subtitle that rotates based on time/day.
function getSubtitle() {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  const isWeekend = day === 0 || day === 6;

  const pool = isWeekend
    ? [
        "Check if your item has been found this week!",
        "Browse what students have reported recently.",
        "Help someone get their belongings back 🤝",
      ]
    : hour >= 5 && hour < 12
      ? [
          "Start the day by helping someone find their item!",
          "Lost something yesterday? Let's check.",
          "New items are posted every morning 📬",
        ]
      : hour >= 12 && hour < 17
        ? [
            "Lost something on campus? Let's find it.",
            "Someone might have found what you're looking for!",
            "Reuniting items with their owners 🔍",
          ]
        : [
            "Check if your lost item was reported today.",
            "Evening check — any new found items?",
            "Don't forget to check before heading home 🏠",
          ];

  // Pick one based on the day-of-year so it changes daily but stays consistent within a day
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return pool[dayOfYear % pool.length];
}

// Emoji map for item categories (used by Recent Feed cards)
const CATEGORY_EMOJI = {
  Electronics: "📱", Wallets: "👛", "IDs & Cards": "🪪",
  "School Supplies": "📚", Keys: "🔑", Books: "📖",
  Clothing: "👕", Bags: "🎒", Accessories: "⌚",
  Documents: "📄", Other: "📦",
};

// Shared item category list — single source of truth
export const ITEM_CATEGORIES = [
  { label: "Electronics", value: "Electronics", emoji: "📱" },
  { label: "Wallets", value: "Wallets", emoji: "👛" },
  { label: "IDs & Cards", value: "IDs & Cards", emoji: "🪪" },
  { label: "School Supplies", value: "School Supplies", emoji: "📚" },
  { label: "Keys", value: "Keys", emoji: "🔑" },
  { label: "Books", value: "Books", emoji: "📖" },
  { label: "Clothing", value: "Clothing", emoji: "👕" },
  { label: "Bags", value: "Bags", emoji: "🎒" },
  { label: "Accessories", value: "Accessories", emoji: "⌚" },
  { label: "Documents", value: "Documents", emoji: "📄" },
  { label: "Other", value: "Other", emoji: "📦" },
];

// Info modal content
const INFO_SECTIONS = [
  {
    icon: "🔍",
    title: "Search & Browse",
    body: "Browse Found or Lost items posted by LSPU students. Filter by location or status to narrow your search."
  },
  {
    icon: "📸",
    title: "Post an Item",
    body: "Found something? Tap the + button, snap or upload a photo, fill in the details, and post it instantly."
  },
  {
    icon: "💬",
    title: "Message the Poster",
    body: "See an item that's yours? Open the item card and tap MESSAGE POSTER to start a private conversation."
  },
  {
    icon: "✅",
    title: "Mark as Claimed",
    body: "Once your item is claimed, open it from the Items page and tap MARK AS CLAIMED to resolve it."
  }
];

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showPostModal, setShowPostModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [userName, setUserName] = useState("");
  const [recentItems, setRecentItems] = useState([]);
  
  // Refs for drag constraints calculation
  const categoryScrollRef = useRef(null);
  const [categoryConstraints, setCategoryConstraints] = useState({ left: 0, right: 0 });
  const recentScrollRef = useRef(null);
  const [recentConstraints, setRecentConstraints] = useState({ left: 0, right: 0 });

  // Updated constraints calculation with resize listener and stability delay
  useEffect(() => {
    const updateConstraints = () => {
      if (categoryScrollRef.current) {
        const width = categoryScrollRef.current.scrollWidth - categoryScrollRef.current.offsetWidth;
        setCategoryConstraints({ left: -Math.max(0, width), right: 0 });
      }
      if (recentScrollRef.current) {
        const width = recentScrollRef.current.scrollWidth - recentScrollRef.current.offsetWidth;
        setRecentConstraints({ left: -Math.max(0, width), right: 0 });
      }
    };

    updateConstraints();
    window.addEventListener('resize', updateConstraints);
    
    // Multiple checks to handle images loading or layout shifts
    const timers = [
      setTimeout(updateConstraints, 100),
      setTimeout(updateConstraints, 500),
      setTimeout(updateConstraints, 1000)
    ];

    return () => {
      window.removeEventListener('resize', updateConstraints);
      timers.forEach(clearTimeout);
    };
  }, [recentItems]); // Re-run when items change, resize handles the rest
  const router = useRouter();
  const { user, authLoading } = useAuthGuard();

  // Fetch user's name for greeting
  useEffect(() => {
    const fetchName = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.full_name) {
        setUserName(data.full_name.split(" ")[0]);
      }
    };
    fetchName();
  }, [user]);

  // Fetch recently reported items (approved only)
  useEffect(() => {
    const fetchRecent = async () => {
      const { data } = await supabase
        .from("items")
        .select("id, title, category, location_tag, item_category, status, created_at")
        .eq("moderation_status", "approved")
        .order("created_at", { ascending: false })
        .limit(6);
      if (data) setRecentItems(data);
    };
    fetchRecent();
  }, []);

  const handleFileSelected = (file) => {
    const previewUrl = URL.createObjectURL(file);
    setShowPostModal(false);
    router.push(`/post?preview=${encodeURIComponent(previewUrl)}`);
  };

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (q) {
      router.push(`/items?search=${encodeURIComponent(q)}`);
    } else {
      router.push("/items");
    }
  };

  // Tapping a category chip navigates to items page with that category pre-selected
  const handleCategoryClick = (categoryValue) => {
    router.push(`/items?item_category=${encodeURIComponent(categoryValue)}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white pb-60 font-sans selection:bg-orange-500/30 flex flex-col items-center pt-12 bg-linear-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#7c2d1233] bg-fixed">

      {/* (i) Info button — top right */}
      <button
        onClick={() => setShowInfoModal(true)}
        className="absolute top-6 right-6 p-3 bg-white/5 border border-white/10 rounded-2xl text-orange-400/70 hover:text-orange-400 hover:bg-white/10 transition-all backdrop-blur-md"
        aria-label="About FoundIt"
      >
        <Info size={20} />
      </button>

      <div className="w-full max-w-md md:max-w-5xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex justify-center mb-6"
        >
          <img src="/logo.png" alt="FoundIt Logo" className="w-24 h-24 rounded-3xl mix-blend-screen drop-shadow-[0_0_24px_rgba(249,115,22,0.5)]" />
        </motion.div>

        {/* User Greeting */}
        {userName ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-white/40 text-sm font-medium mb-1">{getGreeting()}</p>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-linear-to-r from-orange-400 via-orange-500 to-orange-600 drop-shadow-2xl">
              {userName}! 👋
            </h1>
          </motion.div>
        ) : (
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl font-black tracking-tight text-transparent bg-clip-text bg-linear-to-r from-orange-400 via-orange-500 to-orange-600 drop-shadow-2xl"
          >
            FoundIt
          </motion.h1>
        )}
        <motion.p className="text-orange-300/70 mt-4 text-lg font-medium">{getSubtitle()}</motion.p>

        {/* Search bar: navigates to /items?search= on Enter or button click */}
        <div className="relative group my-8 max-w-sm mx-auto">
          <input
            type="text"
            placeholder="Search items..."
            className="w-full bg-white/[0.05] backdrop-blur-2xl border border-white/10 rounded-[2rem] py-5 pl-6 pr-16 outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 text-white text-left placeholder:text-white/20 transition-all duration-300 shadow-2xl"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={handleSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-orange-500 hover:bg-orange-600 text-white rounded-[1.2rem] p-3 transition-all active:scale-90 shadow-lg shadow-orange-500/30"
            aria-label="Search"
          >
            <Search size={18} strokeWidth={3} />
          </button>
        </div>

        {/* Quick Category Chips */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-sm md:max-w-5xl mx-auto"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-3 text-center">Quick Search</p>
          {/* Mobile: horizontal drag scroll */}
          <div className="md:hidden relative -mx-6 px-6 overflow-hidden" ref={categoryScrollRef}>
            <motion.div 
              drag="x"
              dragConstraints={categoryConstraints}
              className="flex gap-2 pb-2 cursor-grab active:cursor-grabbing w-max"
            >
              {ITEM_CATEGORIES.map((cat) => (
                <motion.button
                  key={cat.value}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleCategoryClick(cat.value)}
                  className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-white/[0.05] hover:bg-orange-500/15 border border-white/10 hover:border-orange-500/30 rounded-2xl text-[11px] font-bold text-white/50 hover:text-orange-300 transition-all whitespace-nowrap"
                >
                  <span className="text-sm">{cat.emoji}</span>
                  {cat.label}
                </motion.button>
              ))}
            </motion.div>
          </div>
          {/* Desktop: wrapping grid */}
          <div className="hidden md:flex flex-wrap justify-center gap-2 pb-2">
            {ITEM_CATEGORIES.map((cat) => (
              <motion.button
                key={cat.value}
                whileTap={{ scale: 0.92 }}
                whileHover={{ y: -2 }}
                onClick={() => handleCategoryClick(cat.value)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.05] hover:bg-orange-500/15 border border-white/10 hover:border-orange-500/30 rounded-2xl text-xs font-bold text-white/50 hover:text-orange-300 transition-all whitespace-nowrap"
              >
                <span className="text-sm">{cat.emoji}</span>
                {cat.label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ─── Recently Reported Feed ─── */}
        {recentItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full mt-8"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-3 text-left">
              Recently Reported
            </p>
          </motion.div>
        )}
        {/* Horizontal scroll on mobile, grid on desktop */}
        {recentItems.length > 0 && (
          <>
            {/* Mobile: drag scroll */}
            <div className="md:hidden w-full overflow-hidden mt-1" ref={recentScrollRef}>
              <motion.div
                drag="x"
                dragConstraints={recentConstraints}
                className="flex gap-4 pb-4 cursor-grab active:cursor-grabbing w-max"
              >
                {recentItems.map((item, index) => {
                  const emoji = CATEGORY_EMOJI[item.item_category] || "📦";
                  const isActive = item.status === "Active";
                  const tagLabel = item.category === "Lost" ? "Lost" : (isActive ? "Found" : "Claimed");
                  const tagColor = item.category === "Lost"
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : isActive
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : "bg-orange-500/20 text-orange-400 border-orange-500/30";
                  return (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.07 }}
                      onClick={() => router.push(`/items/${item.id}`)}
                      className="shrink-0 w-36 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-3xl p-4 text-left hover:border-orange-500/40 hover:bg-white/[0.08] transition-all duration-200 cursor-pointer"
                    >
                      <div className="w-full flex justify-center mb-3">
                        <div className="bg-orange-500/10 rounded-2xl p-3"><span className="text-3xl">{emoji}</span></div>
                      </div>
                      <div className="mb-1 w-full max-w-[calc(100%-8px)]">
                        <MarqueeTitle text={item.title} className="font-bold text-sm text-white" />
                      </div>
                      <div className="flex items-center gap-1 mt-1 mb-2">
                        <MapPin size={10} className="text-orange-500/50 shrink-0" />
                        <p className="text-[10px] text-white/40 truncate">{item.location_tag}</p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] border ${tagColor}`}>
                        {tagLabel}
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </div>

            {/* Desktop: responsive grid */}
            <div className="hidden md:grid grid-cols-3 lg:grid-cols-6 gap-4 mt-1 w-full">
              {recentItems.map((item, index) => {
                const emoji = CATEGORY_EMOJI[item.item_category] || "📦";
                const isActive = item.status === "Active";
                const tagLabel = item.category === "Lost" ? "Lost" : (isActive ? "Found" : "Claimed");
                const tagColor = item.category === "Lost"
                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                  : isActive
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "bg-orange-500/20 text-orange-400 border-orange-500/30";
                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.07 }}
                    whileHover={{ y: -4 }}
                    onClick={() => router.push(`/items/${item.id}`)}
                    className="bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-3xl p-4 text-left hover:border-orange-500/40 hover:bg-white/[0.08] transition-all duration-200 cursor-pointer"
                  >
                    <div className="w-full flex justify-center mb-3">
                      <div className="bg-orange-500/10 rounded-2xl p-3"><span className="text-3xl">{emoji}</span></div>
                    </div>
                    <div className="mb-1 w-full">
                      <MarqueeTitle text={item.title} className="font-bold text-sm text-white" />
                    </div>
                    <div className="flex items-center gap-1 mt-1 mb-2">
                      <MapPin size={10} className="text-orange-500/50 shrink-0" />
                      <p className="text-[10px] text-white/40 truncate">{item.location_tag}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] border ${tagColor}`}>
                      {tagLabel}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </>
        )}

      </div>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowInfoModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-[#111] border border-orange-500/20 rounded-[2.5rem] p-8 shadow-2xl shadow-orange-900/20"
            >
              <button
                onClick={() => setShowInfoModal(false)}
                className="absolute top-5 right-5 p-2 bg-white/5 rounded-full text-white/40 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>

              <div className="text-center mb-8">
                <div className="text-4xl mb-3">🎒</div>
                <h2 className="text-2xl font-black text-white">About FoundIt</h2>
                <p className="text-orange-300/60 text-xs mt-1 font-semibold uppercase tracking-widest">LSPU Lost &amp; Found System</p>
              </div>

              <div className="space-y-5">
                {INFO_SECTIONS.map((s) => (
                  <div key={s.title} className="flex gap-4 items-start p-4 bg-white/[0.04] rounded-2xl border border-white/5">
                    <span className="text-2xl shrink-0">{s.icon}</span>
                    <div>
                      <p className="font-black text-sm text-white mb-0.5">{s.title}</p>
                      <p className="text-white/50 text-xs leading-relaxed">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowInfoModal(false)}
                className="mt-8 w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black tracking-widest text-sm transition-all active:scale-95"
              >
                GOT IT
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ItemPostModal
        open={showPostModal}
        onClose={() => setShowPostModal(false)}
        onFileSelect={handleFileSelected}
      />
      {/* Navigation */}
      <NavBar activePage="home" onPlusClick={() => setShowPostModal(true)} />
    </div>
  );
}