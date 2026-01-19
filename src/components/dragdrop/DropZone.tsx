import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export interface DropZoneProps {
  onDrop: (file: File) => void;
  maxSize?: number;
  disabled?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onDrop,
  maxSize = 500 * 1024 * 1024, //500MB
  disabled = false,
}) => {
  const onDropCallback = useCallback(
    (acceptedFiles: File[]) => {
      // Take only the first file for single file mode
      if (acceptedFiles.length > 0) {
        onDrop(acceptedFiles[0]);
      }
    },
    [onDrop]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop: onDropCallback,
    accept: {
      'model/gltf+json': ['.gltf'],
      'model/gltf-binary': ['.glb'],
      'model/vrml': ['.vrm'],
      'application/octet-stream': ['.fbx', '.bvh', '.vrma'],
    },
    maxSize,
    disabled,
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        relative border-2 border-dashed rounded-lg transition-all duration-200
        ${isDragActive
          ? 'border-blue-500 bg-blue-500/10'
          : isDragReject
          ? 'border-red-500 bg-red-500/10'
          : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center p-12 text-center">
        {isDragActive ? (
          <>
            <svg className="w-12 h-12 text-blue-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-lg font-medium text-white">Drop your files here</p>
            <p className="text-sm text-gray-400 mt-1">
              {isDragReject ? 'Invalid file type' : 'Release to upload'}
            </p>
          </>
        ) : (
          <>
            <svg className="w-12 h-12 text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-lg font-medium text-white">
              Drag and drop files here
            </p>
            <p className="text-sm text-gray-400 mt-1">
              or click to browse
            </p>
            <p className="text-xs text-gray-500 mt-4">
              Supported: VRM, GLB, GLTF, FBX, BVH, VRMA
            </p>
            <p className="text-xs text-gray-500">
              Max size: {(maxSize / (1024 * 1024)).toFixed(0)}MB
            </p>
          </>
        )}
      </div>
    </div>
  );
};
