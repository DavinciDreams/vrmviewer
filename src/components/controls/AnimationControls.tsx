/**
 * AnimationControls Component
 * Play, pause, stop, speed control, and loop toggle
 */

import React from 'react';
import { Button } from '../ui/Button';
import { usePlayback } from '../../hooks/usePlayback';

/**
 * AnimationControls props
 */
export interface AnimationControlsProps {
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onSpeedChange?: (speed: number) => void;
  onLoopToggle?: () => void;
}

/**
 * AnimationControls component
 */
export const AnimationControls: React.FC<AnimationControlsProps> = ({
  onPlay,
  onPause,
  onStop,
  onSpeedChange,
  onLoopToggle,
}) => {
  // Get playback state from hook
  const { isPlaying, isStopped, speed, loop } = usePlayback();
  const { play, pause, stop, setSpeed, toggleLoop } = usePlayback();

  /**
   * Handle play button click
   */
  const handlePlay = () => {
    play();
    if (onPlay) {
      onPlay();
    }
  };

  /**
   * Handle pause button click
   */
  const handlePause = () => {
    pause();
    if (onPause) {
      onPause();
    }
  };

  /**
   * Handle stop button click
   */
  const handleStop = () => {
    stop();
    if (onStop) {
      onStop();
    }
  };

  /**
   * Handle speed decrease
   */
  const handleSpeedDecrease = () => {
    const newSpeed = Math.max(0.1, speed - 0.1);
    setSpeed(newSpeed);
    if (onSpeedChange) {
      onSpeedChange(newSpeed);
    }
  };

  /**
   * Handle speed increase
   */
  const handleSpeedIncrease = () => {
    const newSpeed = Math.min(3.0, speed + 0.1);
    setSpeed(newSpeed);
    if (onSpeedChange) {
      onSpeedChange(newSpeed);
    }
  };

  /**
   * Handle loop toggle
   */
  const handleLoopToggle = () => {
    toggleLoop();
    if (onLoopToggle) {
      onLoopToggle();
    }
  };

  return (
    <div className="flex items-center space-x-4 bg-gray-800 rounded-lg p-3 border border-gray-700">
      {/* Playback Controls */}
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStop}
          disabled={isStopped}
          title="Stop"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" />
          </svg>
        </Button>
        
        {isPlaying ? (
          <Button
            variant="primary"
            size="sm"
            onClick={handlePause}
            title="Pause"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={handlePlay}
            disabled={isStopped}
            title="Play"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </Button>
        )}
      </div>
      
      {/* Divider */}
      <div className="w-px h-8 bg-gray-600" />
      
      {/* Speed Control */}
      <div className="flex items-center space-x-3">
        <span className="text-sm text-gray-400 whitespace-nowrap">Speed:</span>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSpeedDecrease}
            disabled={speed <= 0.1}
            title="Decrease speed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </Button>
          <span className="text-sm text-white font-mono w-12 text-center">
            {speed.toFixed(1)}x
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSpeedIncrease}
            disabled={speed >= 3.0}
            title="Increase speed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </Button>
        </div>
      </div>
      
      {/* Divider */}
      <div className="w-px h-8 bg-gray-600" />
      
      {/* Loop Toggle */}
      <Button
        variant={loop ? 'primary' : 'ghost'}
        size="sm"
        onClick={handleLoopToggle}
        title={loop ? 'Looping' : 'Not looping'}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {loop && (
          <span className="ml-1 text-xs">ON</span>
        )}
      </Button>
    </div>
  );
};
