
(() => {
  const TWEET_FILTERS = [
    {
      key: "reply",
      label: "隐藏回复帖",
      storageKey: `${getArchiveStorageNamespace()}-hide-replies`,
      predicate: (tweet, firstSegment) => {
        const meta = tweet.dataset.isReply;
        if (meta === "true") return true;
        if (meta === "false") return false;
        return /^@\S+/.test(firstSegment);
      },
    },
    {
      key: "repost",
      label: "隐藏转贴",
      storageKey: `${getArchiveStorageNamespace()}-hide-reposts`,
      predicate: (tweet, firstSegment) => {
        const meta = tweet.dataset.isRepost;
        if (meta === "true") return true;
        if (meta === "false") return false;
        return /^RT\s+@\S+/i.test(firstSegment);
      },
    },
  ];

  setupTweetFilters();

  function setupTweetFilters() {
    const tweets = Array.from(document.querySelectorAll(".tweet"));
    if (!tweets.length) return;

    const classifiedFilters = TWEET_FILTERS.map((filter) => ({ ...filter, tweets: [] }));

    tweets.forEach((tweet) => {
      const body = tweet.querySelector("p");
      const firstSegment = getFirstSegmentText(body);
      classifiedFilters.forEach((filter) => {
        const matches = filter.predicate(tweet, firstSegment);
        tweet.classList.toggle(`tweet-is-${filter.key}`, matches);
        if (matches) {
          filter.tweets.push(tweet);
        }
      });
    });

    const activeFilters = classifiedFilters.filter((filter) => filter.tweets.length);
    if (!activeFilters.length) return;

    const controls = document.createElement("div");
    controls.className = "archive-controls";
    controls.innerHTML = activeFilters
      .map(
        (filter) => `
          <label class="archive-toggle">
            <input class="archive-toggle-input" type="checkbox" data-filter-key="${filter.key}" />
            <span class="archive-toggle-switch" aria-hidden="true"></span>
            <span class="archive-toggle-label">${filter.label}</span>
            <span class="archive-toggle-meta">${filter.tweets.length} / ${tweets.length}</span>
          </label>
        `,
      )
      .join("");

    const intro = document.querySelector(".archive-subtitle");
    const shell = document.querySelector(".archive-shell");
    if (!shell) return;
    if (intro?.parentNode === shell) {
      shell.insertBefore(controls, intro.nextSibling);
    } else {
      shell.insertBefore(controls, shell.firstChild);
    }

    activeFilters.forEach((filter) => {
      const checkbox = controls.querySelector(`[data-filter-key="${filter.key}"]`);
      if (!checkbox) return;
      checkbox.checked = readFilterState(filter.storageKey);
      checkbox.addEventListener("change", () => {
        writeFilterState(filter.storageKey, checkbox.checked);
        applyTweetFilters(tweets, activeFilters, controls);
      });
    });

    applyTweetFilters(tweets, activeFilters, controls);
  }

  function getFirstSegmentText(body) {
    if (!body) return "";
    const [firstSegmentHtml = ""] = body.innerHTML.split(/<br\s*\/?>/i);
    const scratch = document.createElement("div");
    scratch.innerHTML = firstSegmentHtml;
    return (scratch.textContent || "").trim();
  }

  function applyTweetFilters(tweets, filters, controls) {
    const enabledFilters = new Set(
      filters
        .filter((filter) => controls.querySelector(`[data-filter-key="${filter.key}"]`)?.checked)
        .map((filter) => filter.key),
    );

    tweets.forEach((tweet) => {
      const shouldHide = filters.some(
        (filter) => enabledFilters.has(filter.key) && tweet.classList.contains(`tweet-is-${filter.key}`),
      );
      tweet.hidden = shouldHide;
    });
  }

  function getArchiveStorageNamespace() {
    const file = (window.location.pathname.split("/").pop() || "archive.html").replace(/\.html$/i, "");
    return file.replace(/_(time_desc|media_first_time_desc|text_length_desc|text_entropy_desc)$/i, "");
  }

  function readFilterState(storageKey) {
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  }

  function writeFilterState(storageKey, enabled) {
    try {
      window.localStorage.setItem(storageKey, enabled ? "1" : "0");
    } catch {
      // Ignore storage failures and keep the filter session-local.
    }
  }
})();


(() => {
  const images = Array.from(document.querySelectorAll(".tweet-media-item img"));
  if (!images.length) return;

  const lightbox = document.createElement("div");
  lightbox.className = "lightbox";
  lightbox.setAttribute("aria-hidden", "true");
  lightbox.innerHTML = `<img class="lightbox-image" alt="" />`;
  document.body.appendChild(lightbox);

  const lightboxImage = lightbox.querySelector(".lightbox-image");

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

  lightbox.addEventListener("click", closeLightbox);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lightbox.classList.contains("is-open")) {
      closeLightbox();
    }
  });

  images.forEach((image) => {
    image.loading = "lazy";
    image.decoding = "async";
    image.tabIndex = 0;
    image.setAttribute("role", "button");
    image.addEventListener("click", () => openLightbox(image));
    image.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLightbox(image);
      }
    });
  });
})();
