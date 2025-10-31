const LeadrScribeIcon = ({
  width,
  height,
  className,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
}) => (
  <svg
    width={width || 24}
    height={height || 24}
    viewBox="0 0 512 512"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="currentColor"
  >
    <g transform="translate(256, 256)">
      <rect
        x="-20"
        y="-120"
        width="40"
        height="240"
        rx="20"
      />

      <rect
        x="-80"
        y="-90"
        width="36"
        height="180"
        rx="18"
        opacity="0.95"
      />
      <rect
        x="-136"
        y="-70"
        width="32"
        height="140"
        rx="16"
        opacity="0.9"
      />
      <rect
        x="-186"
        y="-50"
        width="28"
        height="100"
        rx="14"
        opacity="0.85"
      />
      <rect
        x="-228"
        y="-35"
        width="24"
        height="70"
        rx="12"
        opacity="0.8"
      />

      <rect
        x="44"
        y="-90"
        width="36"
        height="180"
        rx="18"
        opacity="0.95"
      />
      <rect
        x="104"
        y="-70"
        width="32"
        height="140"
        rx="16"
        opacity="0.9"
      />
      <rect
        x="158"
        y="-50"
        width="28"
        height="100"
        rx="14"
        opacity="0.85"
      />
      <rect
        x="204"
        y="-35"
        width="24"
        height="70"
        rx="12"
        opacity="0.8"
      />
    </g>
  </svg>
);

export default LeadrScribeIcon;
