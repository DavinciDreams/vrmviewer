/**
 * AnimationControls Component
 * Play, pause, stop, speed control, loop toggle, weight, and crossfade.
 *
 * Weight + crossfade slide into the AnimationManager via useAnimation —
 * weight drives `manager.setWeight(currentClipId, ...)` in real time;
 * crossfade is the fadeIn duration applied on the next play() call.
 */

import React, { useId, useState } from 'react';
import { Button } from '../ui/Button';
import { usePlayback } from '../../hooks/usePlayback';
import { useAnimation } from '../../hooks/useAnimation';

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

  // AnimationManager-backed controls — weight tracks the live clip,
  // crossfade is captured locally and applied on the next play.
  const { playbackState, setWeight, play: playAnim } = useAnimation();
  const [crossfadeDuration, setCrossfadeDuration] = useState(0.2);
  const weightId = useId();
  const crossfadeId = useId();
  const weight = playbackState?.weight ?? 1;

  /**
   * Handle play button click — uses the local crossfade duration as the
   * fadeIn argument so switching clips visibly transitions.
   */
  const handlePlay = () => {
    play();
    playAnim(crossfadeDuration);
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

      {/* Divider */}
      <div className="w-px h-8 bg-gray-600" />

      {/* Weight slider — live mixer weight for the current clip */}
      <div className="flex items-center space-x-2">
        <label htmlFor={weightId} className="text-sm text-gray-400 whitespace-nowrap">
          Weight
        </label>
        <input
          id={weightId}
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={weight}
          onChange={(e) => setWeight(parseFloat(e.target.value))}
          className="w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          title={`Weight ${weight.toFixed(2)}`}
        />
        <span className="text-xs text-blue-400 font-mono w-10 text-right">{weight.toFixed(2)}</span>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-600" />

      {/* Crossfade duration — applied as fadeIn on the next play() call */}
      <div className="flex items-center space-x-2">
        <label htmlFor={crossfadeId} className="text-sm text-gray-400 whitespace-nowrap" title="Crossfade duration on next play">
          Fade
        </label>
        <input
          id={crossfadeId}
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={crossfadeDuration}
          onChange={(e) => setCrossfadeDuration(parseFloat(e.target.value))}
          className="w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          title={`Crossfade ${crossfadeDuration.toFixed(2)}s`}
        />
        <span className="text-xs text-blue-400 font-mono w-10 text-right">{crossfadeDuration.toFixed(2)}s</span>
      </div>
    </div>
  );
};
