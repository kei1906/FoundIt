"use client";
import React, { useRef, useState, useEffect } from "react";

export default function MarqueeTitle({ text, className }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        // Check if text width is greater than container width
        const isOver = textRef.current.scrollWidth > containerRef.current.clientWidth;
        setIsOverflowing(isOver);
      }
    };

    checkOverflow();
    // Re-check on resize
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [text]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden whitespace-nowrap ${className}`}
      style={{ width: "100%", maskImage: isOverflowing ? "linear-gradient(to right, black 85%, transparent 100%)" : "none", WebkitMaskImage: isOverflowing ? "linear-gradient(to right, black 85%, transparent 100%)" : "none" }}
    >
      <div
        ref={textRef}
        className={isOverflowing ? "animate-marquee-scroll inline-block pr-8" : "truncate"}
      >
        {text}
      </div>
    </div>
  );
}
