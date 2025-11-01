import React from "react";

const LeadrScribeLogo = ({
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) => {
  return (
    <div className={`flex items-center justify-center ${className || ''}`}>
      <h1 className="text-3xl font-black tracking-tight" style={{
        color: '#ffc7c7',
        textShadow: `
          -2px -2px 0 #c11414,
          2px -2px 0 #c11414,
          -2px 2px 0 #c11414,
          2px 2px 0 #c11414,
          0px -2px 0 #c11414,
          0px 2px 0 #c11414,
          -2px 0px 0 #c11414,
          2px 0px 0 #c11414
        `
      }}>
        leadrscribe
      </h1>
    </div>
  );
};

export default LeadrScribeLogo;
