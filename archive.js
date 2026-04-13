(() => {
  const REPLY_FILTER_STORAGE_KEY = "anincandescence-archive-hide-replies";

  setupReplyFilter();
  setupImageLightbox();

  function setupReplyFilter() {
    const tweets = Array.from(document.querySelectorAll(".tweet"));
    if (!tweets.length) return;

    const replyTweets = tweets.filter((tweet) => {
      const body = tweet.querySelector("p");
      const firstSegment = getFirstSegmentText(body);
      const isReply = /^@\S+/.test(firstSegment);
      tweet.classList.toggle("tweet-is-reply", isReply);
      return isReply;
    });

    if (!replyTweets.length) return;

    const controls = document.createElement("div");
    controls.className = "archive-controls";
    controls.innerHTML = `
      <label class="archive-toggle">
        <input class="archive-toggle-input" type="checkbox" />
        <span class="archive-toggle-switch" aria-hidden="true"></span>
        <span class="archive-toggle-label">隐藏回复帖</span>
        <span class="archive-toggle-meta">${replyTweets.length} / ${tweets.length}</span>
      </label>
    `;

    const intro = document.querySelector(".archive-intro");
    const shell = document.querySelector(".archive-shell");
    if (!shell) return;
    if (intro?.parentNode === shell) {
      shell.insertBefore(controls, intro.nextSibling);
    } else {
      shell.insertBefore(controls, shell.firstChild);
    }

    const checkbox = controls.querySelector(".archive-toggle-input");
    if (!checkbox) return;

    const initialState = readReplyFilterState();
    checkbox.checked = initialState;
    applyReplyFilter(replyTweets, initialState);

    checkbox.addEventListener("change", () => {
      const enabled = checkbox.checked;
      applyReplyFilter(replyTweets, enabled);
      writeReplyFilterState(enabled);
    });
  }

  function getFirstSegmentText(body) {
    if (!body) return "";
    const [firstSegmentHtml = ""] = body.innerHTML.split(/<br\s*\/?>/i);
    const scratch = document.createElement("div");
    scratch.innerHTML = firstSegmentHtml;
    return (scratch.textContent || "").trim();
  }

  function applyReplyFilter(replyTweets, hideReplies) {
    replyTweets.forEach((tweet) => {
      tweet.hidden = hideReplies;
    });
  }

  function readReplyFilterState() {
    try {
      return window.localStorage.getItem(REPLY_FILTER_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function writeReplyFilterState(enabled) {
    try {
      window.localStorage.setItem(REPLY_FILTER_STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // Ignore storage failures and keep the filter session-local.
    }
  }

  function setupImageLightbox() {
    const images = Array.from(document.querySelectorAll(".tweet-media-item img"));
    if (!images.length) return;

    const lightbox = document.createElement("div");
    lightbox.className = "lightbox";
    lightbox.setAttribute("aria-hidden", "true");
    lightbox.innerHTML = `
      <div class="lightbox-backdrop" data-lightbox-close></div>
      <div class="lightbox-dialog" role="dialog" aria-modal="true" aria-label="Image preview">
        <button class="lightbox-close" type="button" aria-label="Close image preview" data-lightbox-close>Close</button>
        <img class="lightbox-image" alt="" />
      </div>
    `;
    document.body.appendChild(lightbox);

    const lightboxImage = lightbox.querySelector(".lightbox-image");
    const closeTargets = lightbox.querySelectorAll("[data-lightbox-close]");

    function closeLightbox() {
      lightbox.classList.remove("is-open");
      lightbox.setAttribute("aria-hidden", "true");
      document.body.classList.remove("lightbox-open");
      lightboxImage.removeAttribute("src");
      lightboxImage.alt = "";
    }

    function openLightbox(image) {
      lightboxImage.src = image.currentSrc || image.src;
      lightboxImage.alt = image.alt || "";
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.classList.add("lightbox-open");
    }

    closeTargets.forEach((target) => {
      target.addEventListener("click", closeLightbox);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && lightbox.classList.contains("is-open")) {
        closeLightbox();
      }
    });

    images.forEach((image) => {
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("click", () => openLightbox(image));
    });
  }
})();
