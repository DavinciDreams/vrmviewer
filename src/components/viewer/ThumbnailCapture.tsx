import React from 'react';
import { Button } from '../ui/Button';

export interface ThumbnailCaptureProps {
  onCapture: () => void;
  isCapturing?: boolean;
  disabled?: boolean;
}

export const ThumbnailCapture: React.FC<ThumbnailCaptureProps> = ({
  onCapture,
  isCapturing = false,
  disabled = false,
}) => {
  return (
    <div className="absolute top-4 right-4 z-10">
      <Button
        variant="primary"
        size="sm"
        onClick={onCapture}
        disabled={disabled || isCapturing}
        loading={isCapturing}
        title="Capture thumbnail"
      >
        {isCapturing ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Capturing...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Capture
          </>
        )}
      </Button>
    </div>
  );
};
