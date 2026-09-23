import React, { useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface LuxuryHeroProps {
  onScrollToRooms?: () => void;
}

export const LuxuryHero: React.FC<LuxuryHeroProps> = ({ onScrollToRooms }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <div className="relative w-full min-h-[90vh] sm:min-h-[94vh] flex flex-col justify-between overflow-hidden bg-[#0A0E17]">
      {/* Background Video using user's uploaded hotel video (hero.mp4) */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-[#0A0E17]">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="w-full h-full object-cover scale-105 transition-transform duration-1000"
          style={{ filter: "brightness(0.85) contrast(1.04)" }}
        >
          {/* User's uploaded hotel video served from public/hero.mp4 */}
          <source src="/hero.mp4" type="video/mp4" />
        </video>

        {/* Ambient artistic gradients */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(13,17,23,0.35) 0%, rgba(13,17,23,0.15) 40%, rgba(13,17,23,0.65) 85%, #FAF8F5 100%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 35%, rgba(184,148,74,0.12) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Spacer for top balance */}
      <div className="pt-16" />

      {/* Center Cinematic Typography */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center my-auto py-12">
        <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 mb-6 text-[#E6CA85] text-xs tracking-[0.3em] uppercase font-semibold">
          <span>MaM Hotel &amp; Luxury Retreat</span>
        </div>

        <h1
          className="font-display font-light text-white tracking-tight leading-[1.08]"
          style={{ fontSize: "clamp(2.6rem, 6vw, 5.2rem)" }}
        >
          Trải nghiệm xa hoa đỉnh cao
          <br />
          <span className="italic font-normal font-display text-[#E8C878]">
            tuyệt tác nghỉ dưỡng thượng lưu
          </span>
        </h1>
      </div>

      {/* Subtle Scroll Down Prompt */}
      <div className="relative z-20 pb-10 flex flex-col items-center justify-center">
        <button
          type="button"
          onClick={onScrollToRooms}
          className="group flex flex-col items-center gap-2 text-white/80 hover:text-white transition cursor-pointer"
        >
          <span className="text-[11px] uppercase tracking-[0.25em] font-medium text-[#E6CA85]">
            Khám phá Không gian Nghỉ dưỡng
          </span>
          <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center group-hover:border-[#E6CA85] group-hover:scale-110 transition duration-300 bg-black/20 backdrop-blur-sm">
            <ChevronDown size={16} className="text-[#E6CA85] animate-bounce" />
          </div>
        </button>
      </div>
    </div>
  );
};
export default LuxuryHero;
