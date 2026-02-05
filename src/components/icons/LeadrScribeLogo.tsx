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
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        leadrscribe
      </h1>
    </div>
  );
};

export default LeadrScribeLogo;
