"use client";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { compressImage } from "@/utils/imageCompression";

export default function ItemPostModal({ open, onClose, onFileSelect }) {
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    const [compressing, setCompressing] = useState(false);

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setCompressing(true);
            // Compress image to ~70% quality and max 1200px dimension
            const compressedFile = await compressImage(file, {
                maxWidth: 1200,
                maxHeight: 1200,
                quality: 0.7
            });
            
            console.log(`Original size: ${(file.size / 1024).toFixed(2)}KB`);
            console.log(`Compressed size: ${(compressedFile.size / 1024).toFixed(2)}KB`);
            
            onFileSelect(compressedFile);
            onClose();
        } catch (error) {
            console.error("Compression error:", error);
            // Fallback to original file if compression fails
            onFileSelect(file);
            onClose();
        } finally {
            setCompressing(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-sm rounded-[2.5rem] bg-black/70 border border-orange-500/30 p-8 relative"
            >
                <button onClick={onClose} className="absolute right-6 top-6 text-orange-400 hover:text-orange-200">
                    <X size={24} />
                </button>

                <h2 className="text-xl font-bold mb-8">Report Found Item</h2>

                <div className="grid grid-cols-2 gap-4 relative">
                    {compressing && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-2xl">
                            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
                            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Optimizing...</span>
                        </div>
                    )}
                    {/* Camera button — triggers capture="environment" (rear camera on real mobile) */}
                    <button
                        type="button"
                        disabled={compressing}
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex flex-col items-center gap-3 rounded-2xl border border-orange-500/20 bg-white/5 p-6 text-left transition hover:bg-orange-500/10 disabled:opacity-50"
                    >
                        <Camera size={32} className="text-orange-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Camera</span>
                    </button>

                    {/* Gallery button — no capture attr → native photo library on real mobile */}
                    <button
                        type="button"
                        disabled={compressing}
                        onClick={() => galleryInputRef.current?.click()}
                        className="flex flex-col items-center gap-3 rounded-2xl border border-orange-500/20 bg-white/5 p-6 text-left transition hover:bg-orange-500/10 disabled:opacity-50"
                    >
                        <ImageIcon size={32} className="text-orange-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Gallery</span>
                    </button>
                </div>

                {/* Subtle hint — extra low opacity, won't distract on mobile */}
                <p className="mt-6 text-center text-[9px] text-white/20 uppercase tracking-widest leading-relaxed">
                    On mobile · Camera opens device camera · Gallery opens photos
                </p>

                {/*
                 * ─── HOW CAMERA / GALLERY WORKS ACROSS DEVICES ──────────────────
                 *
                 * REAL MOBILE BROWSER (Android Chrome / iOS Safari):
                 *   "Camera"  → capture="environment"  → opens REAR camera directly
                 *   "Gallery" → no capture attribute   → opens native photo library
                 *
                 * DESKTOP BROWSER or Chrome DevTools "Mobile View":
                 *   Both buttons open a regular file-explorer window.
                 *   DevTools only simulates screen size & touch events —
                 *   it cannot simulate hardware camera/gallery access.
                 *
                 * TO TEST ON A REAL PHONE (no extra tools needed):
                 *   1. ipconfig  →  find your PC's local IPv4 (e.g. 192.168.1.5)
                 *   2. Open  http://192.168.1.5:3000  in Chrome on your phone
                 *      (phone and PC must share the same Wi-Fi network)
                 *   3. Camera and Gallery now use the phone's real hardware APIs.
                 *
                 * The capture attribute IS the correct W3C standard — no extra
                 * libraries or paid services are needed.
                 * ────────────────────────────────────────────────────────────────
                 */}

                {/* Camera input: capture="environment" = rear camera on mobile */}
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                />

                {/* Gallery input: no capture = photo library on mobile */}
                <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </motion.div>
        </div>
    );
}
