import { motion, useAnimation } from "framer-motion";
import { useEffect, useMemo } from "react";

interface SciFiOverlayProps {
  mode: 'idle' | 'scanning' | 'success';
  progress: number;
}

export default function SciFiOverlay({ mode, progress }: SciFiOverlayProps) {
  const sweepControls = useAnimation();
  const normalizedProgress = useMemo(() => Math.min(Math.max(progress, 0), 100) / 100, [progress]);

  useEffect(() => {
    if (mode === 'scanning') {
      sweepControls.start({
        rotate: [0, 360],
        opacity: [0.3, 0.6, 0.3],
        transition: {
          rotate: {
            duration: 3,
            repeat: Infinity,
            ease: "linear"
          },
          opacity: {
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }
        }
      });
    } else if (mode === 'success') {
      sweepControls.start({
        scale: [1, 1.5],
        opacity: [0.8, 0],
        transition: { duration: 0.5, ease: "easeOut" }
      });
    } else {
      sweepControls.stop();
    }
  }, [mode, sweepControls]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Frosted Frame with Gradient Border */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 rounded-3xl"
          style={{
            background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.1), rgba(59, 130, 246, 0.1))',
            backdropFilter: mode === 'scanning' ? 'blur(2px)' : 'blur(0px)',
            transition: 'backdrop-filter 0.3s ease'
          }}
        />
        <div 
          className="absolute inset-0 rounded-3xl"
          style={{
            background: 'linear-gradient(135deg, transparent, transparent)',
            border: '2px solid transparent',
            backgroundImage: mode === 'scanning' 
              ? 'linear-gradient(135deg, rgba(147, 51, 234, 0.4), rgba(59, 130, 246, 0.4))'
              : 'linear-gradient(135deg, rgba(147, 51, 234, 0.2), rgba(59, 130, 246, 0.2))',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            transition: 'background-image 0.3s ease'
          }}
        />
      </div>

      {/* Corner Brackets */}
      <svg 
        className="absolute inset-0 w-full h-full" 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
        style={{
          opacity: mode === 'scanning' ? 1 : 0.5,
          transition: 'opacity 0.3s ease'
        }}
      >
        {/* Top-left bracket */}
        <path
          d="M 2 15 L 2 2 L 15 2"
          stroke="url(#bracket-gradient)"
          strokeWidth="0.5"
          fill="none"
          className={mode === 'scanning' ? 'animate-pulse-bracket' : ''}
        />
        {/* Top-right bracket */}
        <path
          d="M 85 2 L 98 2 L 98 15"
          stroke="url(#bracket-gradient)"
          strokeWidth="0.5"
          fill="none"
          className={mode === 'scanning' ? 'animate-pulse-bracket' : ''}
        />
        {/* Bottom-left bracket */}
        <path
          d="M 2 85 L 2 98 L 15 98"
          stroke="url(#bracket-gradient)"
          strokeWidth="0.5"
          fill="none"
          className={mode === 'scanning' ? 'animate-pulse-bracket' : ''}
        />
        {/* Bottom-right bracket */}
        <path
          d="M 85 98 L 98 98 L 98 85"
          stroke="url(#bracket-gradient)"
          strokeWidth="0.5"
          fill="none"
          className={mode === 'scanning' ? 'animate-pulse-bracket' : ''}
        />
        
        <defs>
          <linearGradient id="bracket-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(147, 51, 234)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.8" />
          </linearGradient>
        </defs>
      </svg>

      {/* HUD Grid Overlay */}
      <div 
        className="absolute inset-4 rounded-2xl transition-opacity duration-500"
        style={{
          opacity: mode === 'scanning' ? 0.15 : 0,
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              rgba(147, 51, 234, 0.3) 0px,
              transparent 1px,
              transparent 20px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(59, 130, 246, 0.3) 0px,
              transparent 1px,
              transparent 20px
            )
          `,
        }}
      />

      {/* Radial Scanning Sweep */}
      {mode === 'scanning' && (
        <motion.div
          animate={sweepControls}
          className="absolute inset-0 rounded-3xl"
          style={{
            background: `conic-gradient(
              from 0deg at 50% 50%,
              transparent 0deg,
              rgba(147, 51, 234, 0.4) 45deg,
              rgba(59, 130, 246, 0.4) 90deg,
              transparent 135deg
            )`,
            maskImage: 'radial-gradient(circle at 50% 50%, transparent 30%, black 70%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 50%, transparent 30%, black 70%)',
          }}
        />
      )}

      {/* Progress Ring */}
      {mode === 'scanning' && normalizedProgress > 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke="rgba(147, 51, 234, 0.2)"
              strokeWidth="4"
              fill="none"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke="url(#progress-gradient)"
              strokeWidth="4"
              fill="none"
              strokeDasharray={`${normalizedProgress * 283} 283`}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dasharray 0.3s ease'
              }}
            />
            <defs>
              <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgb(147, 51, 234)" />
                <stop offset="100%" stopColor="rgb(59, 130, 246)" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      )}
    </div>
  );
}
