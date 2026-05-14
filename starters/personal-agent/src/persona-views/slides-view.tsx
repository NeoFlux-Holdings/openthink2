/**
 * Slides viewer — prev/next navigation across an array of `{title, body}`
 * slides. Keyboard arrows work when the section has focus; the body is
 * rendered as preformatted text so markdown stays readable without
 * pulling in a parser.
 */
import { useCallback, useState, type KeyboardEvent } from "react";
import type { SlidesData } from "./types";

export interface SlidesViewProps {
  data?: SlidesData | undefined;
}

export function SlidesView(props: SlidesViewProps) {
  const slides = props.data?.slides ?? [];
  const [index, setIndex] = useState(0);

  const safeIndex = slides.length === 0 ? 0 : Math.min(index, slides.length - 1);
  const current = slides[safeIndex];

  const go = useCallback(
    (delta: number) => {
      setIndex((prev) => {
        if (slides.length === 0) return 0;
        const next = prev + delta;
        if (next < 0) return 0;
        if (next > slides.length - 1) return slides.length - 1;
        return next;
      });
    },
    [slides.length]
  );

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") go(1);
    else if (event.key === "ArrowLeft") go(-1);
  };

  return (
    <section
      className="pv-slides"
      aria-label="Slide deck"
      tabIndex={0}
      onKeyDown={onKey}
    >
      <div className="pv-slides__stage" role="group" aria-roledescription="slide">
        {current ? (
          <article className="pv-slides__slide">
            <h2>{current.title}</h2>
            <pre className="pv-slides__body">{current.body}</pre>
          </article>
        ) : (
          <div className="pv-slides__empty">No slides yet.</div>
        )}
      </div>

      <footer className="pv-slides__nav">
        <button
          type="button"
          className="pv-slides__btn"
          onClick={() => go(-1)}
          disabled={safeIndex <= 0}
          aria-label="Previous slide"
        >
          Prev
        </button>
        <span className="pv-slides__count">
          {slides.length === 0 ? "0 / 0" : `${safeIndex + 1} / ${slides.length}`}
        </span>
        <button
          type="button"
          className="pv-slides__btn"
          onClick={() => go(1)}
          disabled={safeIndex >= slides.length - 1}
          aria-label="Next slide"
        >
          Next
        </button>
      </footer>
    </section>
  );
}

export default SlidesView;
