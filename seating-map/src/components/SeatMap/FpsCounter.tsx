import { useEffect, useState, useRef } from "react";

export function FpsCounter() {
  const [fps, setFps] = useState(60);
  const frameTimesRef = useRef<number[]>([]);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    let lastTime = performance.now();

    const loop = () => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;

      // Exclude extreme frame times (e.g. if the browser tab was in the background)
      if (delta > 0 && delta < 200) {
        const currentFps = 1000 / delta;
        const times = frameTimesRef.current;
        times.push(currentFps);
        if (times.length > 30) {
          times.shift();
        }
        
        const avgFps = times.reduce((a, b) => a + b, 0) / times.length;
        setFps(Math.round(avgFps));
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  let indicatorColor = "#4ade80"; // Green for 55-60 FPS
  if (fps < 45) {
    indicatorColor = "#f87171"; // Red for <45 FPS
  } else if (fps < 55) {
    indicatorColor = "#facc15"; // Yellow for 45-54 FPS
  }

  return (
    <>
      <style>{`
        .cinema-fps-counter {
          position: absolute;
          bottom: 1.5rem;
          left: 1.75rem;
          z-index: 100;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 9999px;
          padding: 0.4rem 0.8rem;
          font-size: 0.72rem;
          font-weight: 600;
          color: #cbd5e1;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          pointer-events: none;
          font-family: monospace, Courier, monospace;
          user-select: none;
          transition: all 0.3s ease;
        }

        @media (max-width: 640px) {
          .cinema-fps-counter {
            bottom: auto;
            top: 5rem;
            left: 1rem;
            padding: 0.3rem 0.6rem;
            font-size: 0.65rem;
            background: rgba(15, 23, 42, 0.85);
          }
        }
      `}</style>
      <div className="cinema-fps-counter">
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: indicatorColor,
            boxShadow: `0 0 8px ${indicatorColor}`,
            transition: "background-color 0.3s, box-shadow 0.3s",
          }}
        />
        <span>{fps} FPS</span>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
        <span style={{ color: "#94a3b8", fontWeight: 400 }}>Canvas Rendered</span>
      </div>
    </>
  );
}
