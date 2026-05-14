/**
 * Image viewer — preview with a Download button. The download link
 * uses an anchor with the `download` attribute, which works for
 * same-origin / data URLs without extra JS.
 */
import type { ImageData } from "./types";

export interface ImageViewProps {
  data?: ImageData | undefined;
}

export function ImageView(props: ImageViewProps) {
  const src = props.data?.src;
  const alt = props.data?.alt ?? "Image artifact";
  const downloadName = props.data?.downloadName ?? "image";

  if (!src) {
    return (
      <section className="pv-image" aria-label="Image viewer">
        <div className="pv-image__empty">No image source provided.</div>
      </section>
    );
  }

  return (
    <section className="pv-image" aria-label="Image viewer">
      <div className="pv-image__stage">
        <img src={src} alt={alt} className="pv-image__img" />
      </div>
      <footer className="pv-image__bar">
        <a className="pv-image__btn" href={src} download={downloadName}>
          Download
        </a>
      </footer>
    </section>
  );
}

export default ImageView;
