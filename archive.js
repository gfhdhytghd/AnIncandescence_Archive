(() => {
  const TWEET_FILTERS = [
    {
      key: "reply",
      storageKey: "anincandescence-archive-hide-replies",
      label: "隐藏回复帖",
      predicate: (text) => /^@\S+/.test(text),
    },
    {
      key: "retweet",
      storageKey: "anincandescence-archive-hide-retweets",
      label: "隐藏转贴",
      predicate: (text) => /^RT\s+@\S+/.test(text),
    },
  ];

  setupTweetFilters();
  setupImageLightbox();

  function setupTweetFilters() {
    const tweets = Array.from(document.querySelectorAll(".tweet"));
    if (!tweets.length) return;

    const classifiedFilters = TWEET_FILTERS.map((filter) => ({ ...filter, tweets: [] }));

    tweets.forEach((tweet) => {
      const body = tweet.querySelector("p");
      const firstSegment = getFirstSegmentText(body);
      classifiedFilters.forEach((filter) => {
        const matches = filter.predicate(firstSegment);
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

    const intro = document.querySelector(".archive-intro");
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
        .filter((filter) => {
          const checkbox = controls.querySelector(`[data-filter-key="${filter.key}"]`);
          return checkbox?.checked;
        })
        .map((filter) => filter.key),
    );

    tweets.forEach((tweet) => {
      const shouldHide = filters.some(
        (filter) => enabledFilters.has(filter.key) && tweet.classList.contains(`tweet-is-${filter.key}`),
      );
      tweet.hidden = shouldHide;
    });
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
