/**
 * PlaybackControls Component
 * Timeline scrubber and time display
 */

import React from 'react';
import { usePlaybackStore } from '../../store/playbackStore';

/**
 * PlaybackControls props
 */
export interface PlaybackControlsProps {
  onSeek?: (time: number) => void;
}

/**
 * PlaybackControls component
 */
export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  onSeek,
}) => {
  // Get playback state from store
  const { currentTime, duration } = usePlaybackStore();

  /**
   * Format time as MM:SS
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Format time as MM:SS.ms
   */
  const formatTimeWithMs = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  /**
   * Handle timeline scrub
   */
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseFloat(e.target.value);
    const newTime = (newProgress / 100) * duration;
    
    // Update store
    usePlaybackStore.getState().seek(newTime);
    
    // Call custom handler if provided
    if (onSeek) {
      onSeek(newTime);
    }
  };

  /**
   * Handle timeline click
   */
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, x / rect.width));
    const newTime = progress * duration;
    
    // Update store
    usePlaybackStore.getState().seek(newTime);
    
    // Call custom handler if provided
    if (onSeek) {
      onSeek(newTime);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <div className="flex items-center space-x-4">
        {/* Current Time */}
        <span className="text-sm text-white font-mono whitespace-nowrap min-w-[80px]">
          {formatTimeWithMs(currentTime)}
        </span>
        
        {/* Timeline */}
        <div 
          className="flex-1 relative h-2 bg-gray-700 rounded-full cursor-pointer group"
          onClick={handleTimelineClick}
          title="Click to seek"
        >
          {/* Progress bar */}
          <div
            className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-150 ease-out"
            style={{
              '--progress-percent': `${progress}%`,
              width: 'var(--progress-percent)'
            } as React.CSSProperties}
          />
          
          {/* Scrubber handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-blue-500 cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
            style={{
              '--progress-percent': `${progress}%`,
              left: 'var(--progress-percent)',
              transform: 'translate(-50%, -50%)'
            } as React.CSSProperties}
            onMouseDown={(e) => e.stopPropagation()}
          />
          
          {/* Range input for scrubbing */}
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            style={{
              background: 'transparent',
            }}
          />
        </div>
        
        {/* Duration */}
        <span className="text-sm text-gray-400 font-mono whitespace-nowrap min-w-[80px]">
          {formatTimeWithMs(duration)}
        </span>
      </div>
      
      {/* Progress percentage */}
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>Progress: {progress.toFixed(1)}%</span>
        {duration > 0 && (
          <span>Remaining: {formatTime(duration - currentTime)}</span>
        )}
      </div>
    </div>
  );
};
