import React from "react";

const LeadrScribeLogo = ({
  width,
  height,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) => {
  return (
    <svg
      width={width || 130}
      height={height || 43}
      viewBox="0 0 600 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="gradient1-logo" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#DC2626", stopOpacity: 1 }} />
          <stop
            offset="100%"
            style={{ stopColor: "#EF4444", stopOpacity: 1 }}
          />
        </linearGradient>
        <linearGradient id="gradient2-logo" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#FFFFFF", stopOpacity: 1 }} />
          <stop
            offset="100%"
            style={{ stopColor: "#FEE2E2", stopOpacity: 1 }}
          />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="75" fill="url(#gradient1-logo)" />

      <g transform="translate(100, 100)">
        <rect
          x="-6"
          y="-35"
          width="12"
          height="70"
          rx="6"
          fill="url(#gradient2-logo)"
        />

        <rect
          x="-26"
          y="-25"
          width="10"
          height="50"
          rx="5"
          fill="url(#gradient2-logo)"
          opacity="0.9"
        />
        <rect
          x="-44"
          y="-18"
          width="8"
          height="36"
          rx="4"
          fill="url(#gradient2-logo)"
          opacity="0.8"
        />
        <rect
          x="-58"
          y="-12"
          width="6"
          height="24"
          rx="3"
          fill="url(#gradient2-logo)"
          opacity="0.7"
        />

        <rect
          x="16"
          y="-25"
          width="10"
          height="50"
          rx="5"
          fill="url(#gradient2-logo)"
          opacity="0.9"
        />
        <rect
          x="36"
          y="-18"
          width="8"
          height="36"
          rx="4"
          fill="url(#gradient2-logo)"
          opacity="0.8"
        />
        <rect
          x="52"
          y="-12"
          width="6"
          height="24"
          rx="3"
          fill="url(#gradient2-logo)"
          opacity="0.7"
        />
      </g>

      <text
        x="220"
        y="115"
        fontFamily="Arial, sans-serif"
        fontSize="56"
        fontWeight="700"
        fill="#E5E7EB"
      >
        Leadr<tspan fill="#DC2626">Scribe</tspan>
      </text>
    </svg>
  );
};

export default LeadrScribeLogo;
