import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function Showreel() {
  const [modalOpen, setModalOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const modalVideoRef = useRef<HTMLVideoElement>(null);

  const openModal = () => {
    setModalOpen(true);
    setTimeout(() => modalVideoRef.current?.play(), 50);
  };

  const closeModal = () => {
    setModalOpen(false);
    modalVideoRef.current?.pause();
  };

  return (
    <>
      <section className="relative bg-background overflow-hidden py-0">
        {/* Award banner at top */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="w-full border-b border-border"
        >
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center border border-[#DCE5FF]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1.5" className="text-foreground">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div>
                <p className="text-foreground font-bold text-sm leading-tight">Thinkatic designs the best AI</p>
                <p className="text-foreground font-bold text-sm leading-tight">products & experiences. Officially.</p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm max-w-sm">
              2025 AI Excellence Award — Visual Design. Three years of industry recognition for AI product innovation.
            </p>
            <div className="sm:ml-auto flex items-center gap-3 flex-wrap">
              {['ACCERN (2023)', 'VT.NEWS (2024)', 'ELVA (2025)'].map((award) => (
                <span key={award} className="flex items-center gap-1 px-3 py-1.5 border border-[#DCE5FF] rounded-full text-xs text-muted-foreground font-medium hover:border-[#214ECF]/50 hover:text-foreground transition-colors cursor-default">
                  {award}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Showreel visual area */}
        <div className="relative max-w-7xl mx-auto px-6">
          {/* "Watch Our Showreel" circular pill button */}
          <motion.button
            onClick={openModal}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            whileHover={{ scale: 1.05 }}
            className="absolute top-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-white text-black font-bold text-sm uppercase tracking-widest px-7 py-4 rounded-full shadow-[0_0_40px_rgba(33,78,207,0.12)] hover:shadow-[0_0_60px_rgba(33,78,207,0.22)] transition-shadow cursor-pointer"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-background opacity-50" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-background" />
            </span>
            Watch Our Showreel
          </motion.button>

          {/* Auto-looping preview video */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="relative mt-0 pt-28 pb-0 flex justify-center"
          >
            {/* Glow behind the video */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-32 bg-[#214ECF]/10 blur-3xl rounded-full pointer-events-none" />

            {/* Video preview — autoplays, loops, no controls */}
            <div
              className="relative w-full max-w-5xl rounded-t-3xl overflow-hidden border border-border cursor-pointer group"
              onClick={openModal}
            >
              <video
                ref={previewVideoRef}
                className="w-full h-auto object-cover block"
                autoPlay
                muted
                loop
                playsInline
                disablePictureInPicture
                style={{ pointerEvents: 'none', maxHeight: '520px' }}
              >
                <source src="/videos/showreel-hd.mp4" type="video/mp4" />
              </video>

              {/* Overlay with play button on hover */}
              <div className="absolute inset-0 bg-background/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-20 h-20 rounded-full bg-[#214ECF] flex items-center justify-center shadow-[0_0_50px_rgba(33,78,207,0.22)]"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="black">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </motion.div>
              </div>

              {/* Bottom gradient fade */}
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent pointer-events-none" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Full-screen video modal ── */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            ref={overlayRef}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-background/95 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === overlayRef.current) closeModal(); }}
          >
            <motion.div
              className="relative w-full max-w-5xl mx-4"
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Close button */}
              <button
                onClick={closeModal}
                className="absolute -top-12 right-0 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 text-sm font-medium"
              >
                Close
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>

              {/* Full video in modal — no controls */}
              <div className="rounded-2xl overflow-hidden border border-border shadow-[0_0_60px_rgba(33,78,207,0.12)]">
                <video
                  ref={modalVideoRef}
                  className="w-full h-auto block"
                  autoPlay
                  muted
                  loop
                  playsInline
                  disablePictureInPicture
                >
                  <source src="/videos/showreel-hd.mp4" type="video/mp4" />
                </video>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
