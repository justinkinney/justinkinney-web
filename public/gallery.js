(() => {
  const gallery = window.PHOTO_GALLERY;
  const grid = document.querySelector("[data-gallery-grid]");
  const status = document.querySelector("[data-gallery-status]");
  const count = document.querySelector("[data-gallery-count]");
  const sortControl = document.querySelector("[data-gallery-sort]");

  let visiblePhotos = [];
  let activeIndex = 0;
  let lastFocusedElement = null;

  if (!grid) {
    return;
  }

  if (!gallery) {
    if (status) {
      status.textContent = "Gallery index not found. Generate gallery-data.js and redeploy.";
    }
    grid.innerHTML = `
      <li class="gallery-empty card">
        Gallery index not found. Generate gallery-data.js from your S3 bucket and redeploy this static site.
      </li>
    `;
    return;
  }

  const photos = Array.isArray(gallery.photos) ? gallery.photos : [];

  if (count) {
    count.textContent = `${photos.length} photo${photos.length === 1 ? "" : "s"}`;
  }

  if (status) {
    status.textContent = gallery.source === "local-demo"
      ? "Demo gallery. Run the S3 index generator to publish bucket photos."
      : `Updated ${formatDate(gallery.generatedAt)}`;
  }

  if (photos.length === 0) {
    grid.innerHTML = `
      <li class="gallery-empty card">
        No photos found yet. Generate gallery-data.js from your S3 bucket and redeploy this static site.
      </li>
    `;
    return;
  }

  const lightbox = createLightbox();
  const sortablePhotos = photos.map((photo, index) => ({
    ...photo,
    sortIndex: index,
    sortDate: dateForPhoto(photo),
  }));

  if (sortControl) {
    sortControl.addEventListener("change", () => renderPhotos(sortablePhotos));
  }

  document.addEventListener("keydown", handleKeydown);
  renderPhotos(sortablePhotos);

  function renderPhotos(items) {
    const direction = sortControl?.value === "oldest" ? 1 : -1;
    visiblePhotos = [...items].sort((a, b) => {
      if (a.sortDate !== b.sortDate) {
        return (a.sortDate - b.sortDate) * direction;
      }
      return a.sortIndex - b.sortIndex;
    });

    const fragment = document.createDocumentFragment();

    visiblePhotos.forEach((photo, index) => {
      const item = document.createElement("li");
      item.className = "gallery-item card";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "gallery-thumb";
      button.setAttribute("aria-label", `Open ${photo.alt || photo.title || "photo"}`);
      button.addEventListener("click", () => openLightbox(index));

      const image = document.createElement("img");
      image.src = photo.src;
      image.alt = photo.alt || photo.title || "Gallery photo";
      image.loading = "lazy";
      image.decoding = "async";

      const caption = document.createElement("span");
      caption.className = "gallery-caption";
      caption.textContent = photo.title || filenameFromKey(photo.key || photo.src);

      button.append(image, caption);
      item.append(button);
      fragment.append(item);
    });

    grid.replaceChildren(fragment);
  }

  function createLightbox() {
    const element = document.createElement("div");
    element.className = "gallery-lightbox";
    element.hidden = true;
    element.setAttribute("role", "dialog");
    element.setAttribute("aria-modal", "true");
    element.setAttribute("aria-label", "Photo viewer");
    element.innerHTML = `
      <button class="gallery-lightbox-close" type="button" data-lightbox-close aria-label="Close photo viewer">×</button>
      <button class="gallery-lightbox-nav gallery-lightbox-prev" type="button" data-lightbox-prev aria-label="Previous photo">‹</button>
      <figure class="gallery-lightbox-figure">
        <a data-lightbox-original href="#" target="_blank" rel="noopener noreferrer" aria-label="Open original image in a new tab">
          <img data-lightbox-image alt="" />
        </a>
        <figcaption>
          <span data-lightbox-caption></span>
          <span data-lightbox-position></span>
        </figcaption>
      </figure>
      <button class="gallery-lightbox-nav gallery-lightbox-next" type="button" data-lightbox-next aria-label="Next photo">›</button>
    `;

    element.addEventListener("click", (event) => {
      if (event.target === element) {
        closeLightbox();
      }
    });
    element.querySelector("[data-lightbox-close]").addEventListener("click", closeLightbox);
    element.querySelector("[data-lightbox-prev]").addEventListener("click", showPreviousPhoto);
    element.querySelector("[data-lightbox-next]").addEventListener("click", showNextPhoto);
    document.body.append(element);
    return element;
  }

  function openLightbox(index) {
    activeIndex = index;
    lastFocusedElement = document.activeElement;
    lightbox.hidden = false;
    document.body.classList.add("lightbox-open");
    updateLightbox();
    lightbox.querySelector("[data-lightbox-close]").focus();
  }

  function closeLightbox() {
    if (lightbox.hidden) {
      return;
    }

    lightbox.hidden = true;
    document.body.classList.remove("lightbox-open");
    if (lastFocusedElement?.focus) {
      lastFocusedElement.focus();
    }
  }

  function showPreviousPhoto() {
    activeIndex = (activeIndex - 1 + visiblePhotos.length) % visiblePhotos.length;
    updateLightbox();
  }

  function showNextPhoto() {
    activeIndex = (activeIndex + 1) % visiblePhotos.length;
    updateLightbox();
  }

  function updateLightbox() {
    const photo = visiblePhotos[activeIndex];
    if (!photo) {
      return;
    }

    const title = photo.title || filenameFromKey(photo.key || photo.src);
    const original = lightbox.querySelector("[data-lightbox-original]");
    const image = lightbox.querySelector("[data-lightbox-image]");
    original.href = photo.src;
    original.setAttribute("aria-label", `Open original image: ${title}`);
    image.src = photo.src;
    image.alt = photo.alt || title;
    lightbox.querySelector("[data-lightbox-caption]").textContent = title;
    lightbox.querySelector("[data-lightbox-position]").textContent = `${activeIndex + 1} / ${visiblePhotos.length}`;
  }

  function handleKeydown(event) {
    if (lightbox.hidden) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPreviousPhoto();
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      showNextPhoto();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
    }
  }

  function formatDate(value) {
    if (!value) {
      return "recently";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "recently";
    }

    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function filenameFromKey(value) {
    return decodeURIComponent(String(value).split("/").pop() || "Photo")
      .replace(/[-_]+/g, " ")
      .replace(/\.[^.]+$/, "")
      .trim();
  }

  function dateForPhoto(photo) {
    const fromName = dateFromPixelFilename(photo.key || photo.src || photo.title);
    if (fromName) {
      return fromName;
    }

    const timestamp = Date.parse(photo.dateTaken || photo.lastModified || "");
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  function dateFromPixelFilename(value) {
    const match = String(value || "").match(/PXL_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (!match) {
      return null;
    }

    const [, year, month, day, hour, minute, second] = match;
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).getTime();
  }
})();
