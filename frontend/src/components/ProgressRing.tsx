import React from "react";

interface ProgressRingProps {
  progress: number;
  message?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({ progress, message = "LOADING SYSTEM INTERACTION FRAMES..." }) => {
  const radius = 60;
  const stroke = 4;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-primary-bg select-none">
      <div className="liquid-glass p-12 rounded-3xl flex flex-col items-center justify-center space-y-6 max-w-sm text-center">
        {/* SVG Circular Ring */}
        <div className="relative flex items-center justify-center w-36 h-36">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background Circle */}
            <circle
              className="text-white/5"
              strokeWidth={stroke}
              stroke="currentColor"
              fill="transparent"
              r={normalizedRadius}
              cx={radius + stroke}
              cy={radius + stroke}
            />
            {/* Active Progress Circle */}
            <circle
              className="text-white/70 transition-all duration-300 ease-out"
              strokeWidth={stroke}
              strokeDasharray={circumference + " " + circumference}
              style={{ strokeDashoffset }}
              strokeLinecap="round"
              fill="transparent"
              r={normalizedRadius}
              cx={radius + stroke}
              cy={radius + stroke}
            />
          </svg>
          {/* Centered Percentage with Instrument Serif Italic */}
          <div className="absolute font-display italic text-4xl text-white font-medium tracking-wide">
            {progress}%
          </div>
        </div>

        {/* Caching Status Information */}
        <div className="space-y-2">
          <p className="font-body text-xs font-semibold tracking-widest text-zinc-500 uppercase">
            {message}
          </p>
          <div className="h-[2px] w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent mx-auto mt-2" />
        </div>
      </div>
    </div>
  );
};
