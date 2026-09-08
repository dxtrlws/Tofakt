"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export function PosterCarousel({ children }: { children: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) {
      return;
    }
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) {
      return;
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (track.current) {
      observer.observe(track.current);
    }
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [update]);

  function scroll(dir: -1 | 1) {
    scroller.current?.scrollBy({ left: dir * 552, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <section
        aria-label="Poster scroller"
        className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            scroll(-1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            scroll(1);
          }
        }}
        ref={scroller}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: overflow scroller must be in the tab order so it can be panned with arrow keys
        tabIndex={0}
      >
        <div className="flex gap-4" ref={track}>
          {children}
        </div>
      </section>
      {canLeft ? (
        <Arrow
          className="hidden md:flex"
          dir="left"
          onClick={() => scroll(-1)}
        />
      ) : null}
      {canRight ? (
        <Arrow
          className="hidden md:flex"
          dir="right"
          onClick={() => scroll(1)}
        />
      ) : null}
    </div>
  );
}

function Arrow({
  className,
  dir,
  onClick,
}: {
  className?: string;
  dir: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      aria-label={dir === "left" ? "Previous" : "Next"}
      className={`absolute top-[96px] z-10 size-10 items-center justify-center rounded-full border border-border bg-bg-overlay-strong text-fg ${
        dir === "left" ? "-left-3" : "-right-3"
      } ${className ?? "flex"}`}
      onClick={onClick}
      type="button"
    >
      <svg
        aria-hidden="true"
        fill="none"
        height="16"
        viewBox="0 0 24 24"
        width="16"
      >
        {dir === "left" ? (
          <path
            d="M15 6l-6 6 6 6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        ) : (
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        )}
      </svg>
    </button>
  );
}
