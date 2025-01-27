import styles from "./video-controls.module.css";

import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faPause } from "@fortawesome/free-solid-svg-icons";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Gaps = {
  color: string;
  start: number;
  end: number;
};

interface VideoControlsProps {
  onPlayPause: () => void;
  onGoto: (time: number) => void;
  progress: number;
  isPlaying: boolean;
  gaps: Gaps[];
}

const VideoControls: React.FC<VideoControlsProps> = ({
  onPlayPause,
  onGoto,
  progress,
  isPlaying,
  gaps,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let lastScrollTop = 0;
    const handleScroll = () => {
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      if (scrollTop - 200 > lastScrollTop) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        onPlayPause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onPlayPause]);

  // Filter out gaps that are too close to each other
  // Start by sorting the gaps by start time
  gaps.sort((a, b) => a.start - b.start);
  const filteredGaps = gaps.filter((gap, i) => {
    if (i === 0) return true;
    const prevGap = gaps[i - 1];
    return gap.start - prevGap.end > 0.5;
  });

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-background border-t p-4 transition-transform z-10 ${
        isVisible ? "transform-none" : "transform translate-y-full"
      }`}
    >
      <div className="flex items-center">
        <button onClick={onPlayPause} className="text-white w-6 h-6 pr-4">
          <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
        </button>
        <Progress
          value={progress}
          onClick={(e: any) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPosition = e.clientX - rect.left;
            const clickProgress = (clickPosition / rect.width) * 100;
            onGoto(clickProgress);
          }}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseMove={(e: any) => {
            if (isDragging) {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickPosition = e.clientX - rect.left;
              const clickProgress = (clickPosition / rect.width) * 100;
              onGoto(clickProgress);
            }
          }}
          className={cn("cursor-pointer", styles["progress"])}
          id="progress-bar-id"
        />
        <div>
          {/* <div className="absolute w-2 h-2 bg-red-400 top-6 left-10 rounded translate-x-[1450px]"></div> */}
          {filteredGaps
            .map((gap, i) => {
              const barWidthPx =
                document.getElementById("progress-bar-id")?.offsetWidth || 0;
              const classes = `pointer-events-none absolute w-2 h-2 top-6 left-10 rounded border border-light-gray`;

              const startTranslationPx = (gap.start / 100) * barWidthPx;
              const endTranslationPx = (gap.end / 100) * barWidthPx;

              return [
                <div
                  key={`start-${i}`}
                  className={cn(classes)}
                  style={{
                    transform: `translateX(${startTranslationPx}px)`,
                    backgroundColor: gap.color,
                  }}
                />,
                // <div
                //   key={`end-${i}`}
                //   className={cn(classes)}
                //   style={{
                //     transform: `translateX(${endTranslationPx}px)`,
                //     backgroundColor: gap.color,
                //   }}
                // />,
              ];
            })
            .flat()}
        </div>
      </div>
    </div>
  );
};

export default VideoControls;
