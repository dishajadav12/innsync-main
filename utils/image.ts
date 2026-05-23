const FALLBACK_IMAGE_SRC = "/images/0-big-image.jpg";

export const getSafeImageSrc = (src: string, fallback: string = FALLBACK_IMAGE_SRC) => {
  if (!src) return fallback;

  try {
    const parsed = new URL(src);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    // Unsplash photo-page links are HTML pages, not direct image assets.
    if (host === "unsplash.com" && path.startsWith("/photos/")) {
      return fallback;
    }
  } catch {
    return src;
  }

  return src;
};
