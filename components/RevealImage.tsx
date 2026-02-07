import React, { useState, useCallback } from 'react';

interface RevealImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
}

export const RevealImage: React.FC<RevealImageProps> = ({ className = '', style, ...rest }) => {
  const [loaded, setLoaded] = useState(false);
  const onLoad = useCallback(() => setLoaded(true), []);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Shimmer placeholder — visible while image loads, fades out after */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s ease-in-out infinite',
          opacity: loaded ? 0 : 1,
          transition: 'opacity 0.6s ease-out',
          pointerEvents: 'none',
        }}
      />
      <img
        {...rest}
        onLoad={onLoad}
        className={className}
        style={{
          ...style,
          opacity: loaded ? 1 : 0,
          filter: loaded ? 'blur(0px)' : 'blur(12px)',
          transform: loaded ? 'scale(1)' : 'scale(1.06)',
          transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), filter 1s cubic-bezier(0.16, 1, 0.3, 1), transform 1s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
    </div>
  );
};
