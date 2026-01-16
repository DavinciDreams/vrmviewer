import React from 'react';

export interface FilePreviewProps {
  file: File;
  onRemove?: () => void;
  onLoad?: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ file, onRemove, onLoad }) => {
  const getFileType = (filename: string): 'model' | 'animation' | 'unknown' => {
    const ext = filename.toLowerCase();
    if (['.vrm', '.glb', '.gltf', '.fbx'].includes(ext)) {
      return 'model';
    }
    if (['.bvh', '.vrma', '.fbx'].includes(ext)) {
      return 'animation';
    }
    return 'unknown';
  };

  const fileType = getFileType(file.name);
  const fileSize = (file.size / (1024 * 1024)).toFixed(2);

  const getIcon = () => {
    switch (fileType) {
      case 'model':
        return (
          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
        );
      case 'animation':
        return (
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
        );
      default:
        return (
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  const getTypeLabel = () => {
    switch (fileType) {
      case 'model':
        return 'Model';
      case 'animation':
        return 'Animation';
      default:
        return 'File';
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <div className="flex-shrink-0">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{file.name}</p>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs text-gray-400">{getTypeLabel()}</span>
            <span className="text-xs text-gray-600">•</span>
            <span className="text-xs text-gray-400">{fileSize} MB</span>
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2 ml-4">
        {onLoad && (
          <button
            onClick={onLoad}
            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded-lg transition-colors"
            title="Load file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
            title="Remove file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
