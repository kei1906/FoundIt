'use client';
import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Loader2, AlertCircle, ChevronDown, Check, Maximize2, Clock, Info } from 'lucide-react';
import ItemPostModal from '@/components/ItemPostModal';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import Cropper from 'react-easy-crop';
import { ITEM_CATEGORIES } from '@/app/Home/page';

// --- CUSTOM DROPDOWN COMPONENT ---
function CustomSelect({ label, value, options, onChange, placeholder = "Select" }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-1 relative">
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400/80 ml-1">{label}</label>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between text-white focus:border-orange-500/50 transition-all active:scale-[0.98] gap-2"
      >
        <span className={`truncate text-left flex-1 ${value ? "text-white" : "text-white/20"}`}>
          {value ? options.find(opt => opt.value === value)?.label || value : placeholder}
        </span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} className="shrink-0">
          <ChevronDown size={16} className="text-orange-400" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 5, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute left-0 right-0 z-20 overflow-hidden rounded-2xl border border-white/20 bg-[#1a1a1a]/90 backdrop-blur-xl shadow-2xl"
            >
              <div className="p-1">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm text-white hover:bg-orange-500/20 transition-colors group gap-2"
                  >
                    <span className="truncate text-left flex-1">{opt.label}</span>
                    {value === opt.value && <Check size={14} className="text-orange-400 shrink-0" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function PostItemContent() {
  const searchParams = useSearchParams();
  const preview = searchParams.get('preview');
  const router = useRouter();
  const { user: authUser, authLoading } = useAuthGuard();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Found');
  const [itemCategory, setItemCategory] = useState('');
  const [locationTag, setLocationTag] = useState('');
  const [specificLocation, setSpecificLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // --- CROP & PREVIEW STATES ---[cite: 4]
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [finalImage, setFinalImage] = useState(preview);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileSelect = (file) => {
    const previewUrl = URL.createObjectURL(file);
    setFinalImage(previewUrl);
    router.push(`/post?preview=${encodeURIComponent(previewUrl)}`);
  };

  const getCroppedImg = async () => {
    try {
      const img = new Image();
      img.src = preview;
      await new Promise((resolve) => (img.onload = resolve));

      const canvas = document.createElement('canvas');
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg');
      });
    } catch (e) {
      console.error("Cropping error:", e);
    }
  };

  const handleDoneAdjusting = async () => {
    const blob = await getCroppedImg();
    if (blob) {
      const newPreview = URL.createObjectURL(blob);
      setFinalImage(newPreview); // Update visual preview immediately[cite: 4]
    }
    setIsCropping(false);
  };

  const handlePost = async () => {
    if (!title || !description || !finalImage || !locationTag) {
      return alert("Please fill in all fields");
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to post.");

      // Fetch the current version of the image (either cropped or original)
      const fetchResponse = await fetch(finalImage || preview);
      const blob = await fetchResponse.blob();
      const fileName = `${user.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('items')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('items')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('items').insert([{
        title,
        description,
        image_url: publicUrl,
        user_id: user.id,
        category,
        item_category: itemCategory || 'Other',
        location_tag: specificLocation ? `${locationTag} - ${specificLocation}` : locationTag,
        status: 'Active'
        // moderation_status defaults to 'pending' via DB column default
      }]);

      if (dbError) throw dbError;
      setSubmitted(true);
      // Brief delay so user sees the confirmation before redirect
      setTimeout(() => router.push('/items'), 2500);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!preview) {
    return <ItemPostModal open={true} onClose={() => router.back()} onFileSelect={handleFileSelect} />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Submitted confirmation screen
  if (submitted) {
    return (
      <div className="min-h-screen text-white flex flex-col items-center justify-center p-6 bg-linear-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#7c2d1233]">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto">
            <Clock size={36} className="text-orange-400" />
          </div>
          <h2 className="text-2xl font-black">Submitted for Review</h2>
          <p className="text-white/50 text-sm max-w-xs mx-auto">Your post will be reviewed by an admin before appearing publicly. You&apos;ll see it in your posts shortly.</p>
          <div className="w-8 h-8 border-3 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mx-auto mt-6" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-6 bg-linear-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#7c2d1233]">
      <header className="flex items-center gap-4 mb-4">
        <button onClick={() => router.back()} className="text-orange-400 p-2 bg-white/5 rounded-full">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Post Report</h1>
      </header>

      {/* Admin review info banner */}
      <div className="flex items-center gap-3 p-3 mb-6 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
        <Info size={16} className="text-orange-400 shrink-0" />
        <p className="text-[11px] text-orange-300/70 font-medium">Your post will be reviewed by an admin before appearing publicly.</p>
      </div>

      {/* INTERACTIVE IMAGE CONTAINER[cite: 4] */}
      <div className="relative w-full h-56 rounded-[2.5rem] overflow-hidden border border-white/10 mb-8 shadow-2xl group bg-black">
        {isCropping ? (
          <div className="absolute inset-0 z-50">
            <Cropper
              image={preview}
              crop={crop}
              zoom={zoom}
              aspect={16 / 9}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
            <button
              onClick={handleDoneAdjusting}
              className="absolute bottom-4 right-4 bg-orange-500 text-black px-6 py-3 rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all"
            >
              Done Adjusting
            </button>
          </div>
        ) : (
          <div className="relative w-full h-full cursor-pointer" onClick={() => setIsCropping(true)}>
            <img src={finalImage || preview} alt="Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />

            {/* PULSATING ADJUST HINT[cite: 4] */}
            <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="bg-orange-500/90 backdrop-blur-md p-3 rounded-full shadow-lg"
              >
                <Maximize2 size={20} className="text-black" />
              </motion.div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white drop-shadow-lg bg-black/40 px-3 py-1 rounded-full">
                Tap to adjust
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6 max-w-md mx-auto pb-10">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400/80 ml-1">Item Title</label>
          <input
            className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-orange-500/30 transition-all placeholder:text-white/20"
            placeholder={category === 'Lost' ? "What did you lose?" : "What did you find?"} 
            value={title} 
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <CustomSelect
            label="Category"
            value={category}
            options={[{ label: 'Found', value: 'Found' }, { label: 'Lost', value: 'Lost' }]}
            onChange={setCategory}
          />
          <CustomSelect
            label="Item Type"
            value={itemCategory}
            options={ITEM_CATEGORIES.map(c => ({ label: `${c.emoji} ${c.label}`, value: c.value }))}
            onChange={setItemCategory}
            placeholder="Select type"
          />
        </div>

        <CustomSelect
          label="General Area"
          value={locationTag}
          options={[
            { label: 'Shed', value: 'Shed' },
            { label: 'Activity Center', value: 'Activity Center' },
            { label: 'ER Bldg.', value: 'ER Bldg.' },
            { label: 'ENB Bldg.', value: 'ENB Bldg.' },
            { label: 'Volleyball Court', value: 'Volleyball Court' },
            { label: 'Basketball Court', value: 'Basketball Court' },
            { label: 'Admin Bldg.', value: 'Admin Bldg.' },
            { label: 'Quadrangle', value: 'Quadrangle' }
          ]}
          onChange={setLocationTag}
        />

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400/80 ml-1">Specific Details</label>
          <textarea
            className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl h-28 outline-none resize-none focus:border-orange-500/30 transition-all text-sm placeholder:text-white/20"
            placeholder="Color, brand, unique features..." value={description} onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button
          onClick={handlePost}
          disabled={loading || isCropping}
          className="w-full py-5 rounded-[2rem] font-bold flex items-center justify-center gap-3 bg-linear-to-r from-orange-600 to-orange-400 hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-orange-900/20 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" /> : <><Send size={18} /> Submit Report</>}
        </button>
      </div>
    </div>
  );
}

export default function PostItem() {
  return (
    <Suspense fallback={<div className="bg-black min-h-screen" />}>
      <PostItemContent />
    </Suspense>
  );
}