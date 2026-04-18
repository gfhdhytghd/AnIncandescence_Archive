
(() => {
  const TWEET_FILTERS = [
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

  const allTweets = Array.from(document.querySelectorAll(".tweet"));
  if (!allTweets.length) return;

  const controls = document.createElement("div");
  controls.className = "archive-controls";

  const stickyBar = document.createElement("div");
  stickyBar.className = "archive-sticky-bar";

  setupArchiveTabs(allTweets, stickyBar);
  setupTweetFilters(allTweets, controls);
  setupCommentExpansion(allTweets, controls);
  setupReplyChainExpansion(allTweets, controls);
  if (controls.children.length) stickyBar.appendChild(controls);

  const header = document.querySelector(".archive-header");
  const shell = document.querySelector(".archive-shell");
  if (header) header.hidden = true;
  if (shell && stickyBar.children.length) {
    if (header?.parentNode === shell) {
      shell.insertBefore(stickyBar, header.nextSibling);
    } else {
      shell.insertBefore(stickyBar, shell.firstChild);
    }
  }

  /* On mobile, move tabs out of stickyBar so they can be independently sticky */
  const mq = window.matchMedia("(max-width:600px)");
  function reflow() {
    const tabs = stickyBar.parentNode && stickyBar.querySelector(".archive-tabs");
    if (!tabs) return;
    if (mq.matches) {
      stickyBar.parentNode.insertBefore(tabs, stickyBar);
    } else {
      stickyBar.insertBefore(tabs, stickyBar.firstChild);
    }
  }
  reflow();
  mq.addEventListener("change", reflow);

  setupDetailPanel();

  function setupArchiveTabs(tweets, container) {
    const tabKey = `${getArchiveStorageNamespace()}-archive-tab`;
    const posts = tweets.filter((t) => t.dataset.isReply !== "true");
    const replyTweets = tweets.filter((t) => t.dataset.isReply === "true");
    const commentIds = new Set();
    tweets.forEach((tweet) => {
      tweet.querySelectorAll(".tweet-comments [data-comment-id]").forEach((node) => {
        if (node.dataset.commentId) commentIds.add(node.dataset.commentId);
      });
    });
    const threadRoots = tweets.filter((t) => t.querySelector(".tweet-comments") && !commentIds.has(t.dataset.tweetId));
    const orphanReplies = replyTweets.filter((t) => !commentIds.has(t.dataset.tweetId));
    const replyViewTweets = new Set([...threadRoots, ...orphanReplies]);
    if (!replyTweets.length && !threadRoots.length) return;

    const tabBar = document.createElement("div");
    tabBar.className = "archive-tabs";
    tabBar.innerHTML =
      `<button class="archive-tab active" data-archive-tab="posts">` +
      `帖子<span class="archive-tab-meta">${posts.length}</span></button>` +
    `<button class="archive-tab" data-archive-tab="replies">` +
      `回复<span class="archive-tab-meta">${replyTweets.length}</span></button>`;

    container.appendChild(tabBar);

    const tabButtons = Array.from(tabBar.querySelectorAll(".archive-tab"));
    const scrollPositions = { posts: 0, replies: 0 };
    const originalOrder = new Map(tweets.map((tweet, index) => [tweet, index]));
    let currentTab = "posts";

    const saved = readTabState(tabKey);
    if (saved && saved !== "posts") {
      activateTab(saved, true);
    }

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => activateTab(btn.dataset.archiveTab, false));
    });

    function activateTab(name, isInit) {
      if (!isInit) scrollPositions[currentTab] = window.scrollY;
      currentTab = name;
      tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.archiveTab === name));
      writeTabState(tabKey, name);
      orderTweetsForTab(name);
      tweets.forEach((tweet) => {
        const isRepost = tweet.classList.contains("tweet-is-repost");
        const hiddenByFilter = isRepost && (document.querySelector("[data-filter-key=\"repost\"]")?.checked || false);
        tweet.hidden = hiddenByFilter || !tabAllowsTweet(tweet, name);
      });
      if (window._archiveSetCommentExpansionForTab) window._archiveSetCommentExpansionForTab();
      if (!isInit) window.scrollTo(0, scrollPositions[name]);
    }

    function tabAllowsTweet(tweet, name) {
      if (name === "posts") return tweet.dataset.isReply !== "true";
      return replyViewTweets.has(tweet);
    }

    function orderTweetsForTab(name) {
      const shell = document.querySelector(".archive-shell");
      if (!shell) return;
      const ordered = tweets.slice().sort((a, b) => {
        if (name !== "replies") return originalOrder.get(a) - originalOrder.get(b);
        const aVisible = tabAllowsTweet(a, "replies") ? 1 : 0;
        const bVisible = tabAllowsTweet(b, "replies") ? 1 : 0;
        if (aVisible !== bVisible) return bVisible - aVisible;
        return originalOrder.get(a) - originalOrder.get(b);
      });
      ordered.forEach((tweet) => shell.appendChild(tweet));
    }

    function readTabState(key) {
      try { return window.localStorage.getItem(key) || "posts"; } catch { return "posts"; }
    }
    function writeTabState(key, value) {
      try { window.localStorage.setItem(key, value); } catch {}
    }

    // Expose for coordination with filters
    window._archiveActiveTab = () => {
      const active = tabBar.querySelector(".archive-tab.active");
      return active ? active.dataset.archiveTab : "posts";
    };
    window._archiveTabAllowsTweet = tabAllowsTweet;
    window._archiveRefreshTab = () => {
      const active = tabBar.querySelector(".archive-tab.active");
      if (active) activateTab(active.dataset.archiveTab, true);
    };
  }

  function setupTweetFilters(tweets, ctrls) {
    const classifiedFilters = TWEET_FILTERS.map((filter) => ({ ...filter, tweets: [] }));

    tweets.forEach((tweet) => {
      const body = tweet.querySelector("p");
      const firstSegment = getFirstSegmentText(body);
      classifiedFilters.forEach((filter) => {
        const matches = filter.predicate(tweet, firstSegment);
        tweet.classList.toggle(`tweet-is-${filter.key}`, matches);
        if (matches) filter.tweets.push(tweet);
      });
    });

    const activeFilters = classifiedFilters.filter((f) => f.tweets.length);
    if (!activeFilters.length) return;

    activeFilters.forEach((filter) => {
      const label = document.createElement("label");
      label.className = "archive-toggle";
      label.innerHTML =
        `<input class="archive-toggle-input" type="checkbox" data-filter-key="${filter.key}"/>` +
        `<span class="archive-toggle-switch" aria-hidden="true"></span>` +
        `<span class="archive-toggle-label">${filter.label}</span>`;
      ctrls.appendChild(label);

      const checkbox = label.querySelector("input");
      checkbox.checked = readFilterState(filter.storageKey);
      checkbox.addEventListener("change", () => {
        writeFilterState(filter.storageKey, checkbox.checked);
        applyTweetFilters(tweets, activeFilters, ctrls);
      });
    });

    applyTweetFilters(tweets, activeFilters, ctrls);
  }

  function setupCommentExpansion(tweets, ctrls) {
    const expandKey = `${getArchiveStorageNamespace()}-default-expand-comments`;
    const tweetsWithComments = tweets.filter((t) => t.querySelector(".tweet-comments"));
    if (!tweetsWithComments.length) return;

    const defaultExpand = readFilterState(expandKey);

    // Global toggle
    const toggle = document.createElement("label");
    toggle.className = "archive-toggle";
    toggle.innerHTML =
      `<input class="archive-toggle-input" type="checkbox" data-filter-key="expand-comments"/>` +
      `<span class="archive-toggle-switch" aria-hidden="true"></span>` +
      `<span class="archive-toggle-label">默认展开评论</span>`;
    ctrls.appendChild(toggle);

    const globalCheckbox = toggle.querySelector("input");
    globalCheckbox.checked = defaultExpand;
    globalCheckbox.addEventListener("change", () => {
      writeFilterState(expandKey, globalCheckbox.checked);
      applyCommentExpansionForActiveTab();
    });

    // Per-tweet buttons
    tweetsWithComments.forEach((tweet) => {
      const btn = tweet.querySelector(".tweet-expand-btn");
      if (btn) {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const comments = tweet.querySelector(".tweet-comments");
          if (comments) setCommentState(tweet, comments.hidden);
        });
      }
    });
    window._archiveSetCommentExpansionForTab = applyCommentExpansionForActiveTab;
    applyCommentExpansionForActiveTab();

    function applyCommentExpansionForActiveTab() {
      const activeTab = window._archiveActiveTab ? window._archiveActiveTab() : "posts";
      tweetsWithComments.forEach((tweet) => {
        const forceExpanded = activeTab === "replies"
          && window._archiveTabAllowsTweet
          && window._archiveTabAllowsTweet(tweet, "replies");
        setCommentState(tweet, forceExpanded || globalCheckbox.checked);
      });
    }
  }

  function setCommentState(tweet, expanded) {
    const comments = tweet.querySelector(".tweet-comments");
    const btn = tweet.querySelector(".tweet-expand-btn");
    if (comments) comments.hidden = !expanded;
    if (btn) {
      const count = btn.dataset.commentCount;
      btn.textContent = expanded
        ? `收起评论 (${count})`
        : `展开评论 (${count})`;
    }
  }

  function setupReplyChainExpansion(tweets, ctrls) {
    const expandKey = `${getArchiveStorageNamespace()}-default-expand-reply-chain`;
    const tweetsWithChain = tweets.filter((t) => t.querySelector(".tweet-reply-chain"));
    if (!tweetsWithChain.length) return;

    const defaultExpand = readFilterState(expandKey);

    const toggle = document.createElement("label");
    toggle.className = "archive-toggle";
    toggle.innerHTML =
      `<input class="archive-toggle-input" type="checkbox" data-filter-key="expand-reply-chain"/>` +
      `<span class="archive-toggle-switch" aria-hidden="true"></span>` +
      `<span class="archive-toggle-label">默认展开回复链</span>`;
    ctrls.appendChild(toggle);

    const globalCheckbox = toggle.querySelector("input");
    globalCheckbox.checked = defaultExpand;
    globalCheckbox.addEventListener("change", () => {
      writeFilterState(expandKey, globalCheckbox.checked);
      tweetsWithChain.forEach((tweet) => {
        const chain = tweet.querySelector(".tweet-reply-chain");
        if (chain) chain.open = globalCheckbox.checked;
      });
    });

    tweetsWithChain.forEach((tweet) => {
      const chain = tweet.querySelector(".tweet-reply-chain");
      if (chain) chain.open = defaultExpand;
    });
  }

  function setupDetailPanel() {
    const panel = document.querySelector(".detail-panel");
    if (!panel) return;
    const backdrop = document.querySelector(".detail-panel-backdrop");
    const closeBtn = panel.querySelector(".detail-panel-close");
    const panelBody = panel.querySelector(".detail-panel-body");

    document.querySelectorAll(".tweet").forEach((tweet) => {
      tweet.addEventListener("click", (e) => {
        if (e.target.closest("a, button, video, input, .lightbox")) return;
        openPanel(tweet);
      });
    });

    function openPanel(tweet) {
      panelBody.innerHTML = "";

      // Referenced / replied-to content (shown above post)
      const replyChain = tweet.querySelector(".tweet-reply-chain");
      if (replyChain) {
        const ctx = document.createElement("div");
        ctx.className = "detail-context";
        const chainClone = replyChain.cloneNode(true);
        chainClone.open = true;
        ctx.appendChild(chainClone);
        panelBody.appendChild(ctx);
      }

      // Post details (clone without comments, expand button, reply chain)
      const clone = tweet.cloneNode(true);
      const cd = clone.querySelector(".tweet-comments");
      const eb = clone.querySelector(".tweet-expand-btn");
      const rc = clone.querySelector(".tweet-reply-chain");
      if (cd) cd.remove();
      if (eb) eb.remove();
      if (rc) rc.remove();
      clone.removeAttribute("class");
      clone.className = "detail-post";
      panelBody.appendChild(clone);

      // Comments (shown below post)
      const comments = tweet.querySelector(".tweet-comments");
      const commentCount = comments ? Number(comments.dataset.commentTotal || comments.children.length || 0) : 0;
      if (comments && commentCount) {
        const section = document.createElement("div");
        section.className = "detail-comments";
        section.innerHTML =
          "<div class='detail-comments-header'>评论 (" + commentCount + ")</div>" +
          comments.innerHTML +
          "<p class='detail-note'>仅包含本地存档及已缓存回复链中可见的评论，并按父子回复关系嵌套显示</p>";
        panelBody.appendChild(section);
      }

      panelBody.scrollTop = 0;
      panel.classList.add("is-open");
      if (backdrop) backdrop.hidden = false;
      document.body.classList.add("detail-panel-open");
    }

    function closePanel() {
      panel.classList.remove("is-open");
      panelBody.innerHTML = "<p class='detail-empty'>点击帖子查看详情</p>";
      if (backdrop) backdrop.hidden = true;
      document.body.classList.remove("detail-panel-open");
    }

    if (backdrop) backdrop.addEventListener("click", closePanel);
    if (closeBtn) closeBtn.addEventListener("click", closePanel);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panel.classList.contains("is-open")) closePanel();
    });
  }

  function applyTweetFilters(tweets, filters, ctrls) {
    const enabledFilters = new Set(
      filters
        .filter((f) => ctrls.querySelector(`[data-filter-key="${f.key}"]`)?.checked)
        .map((f) => f.key),
    );
    const activeTab = window._archiveActiveTab ? window._archiveActiveTab() : null;
    tweets.forEach((tweet) => {
      const hiddenByFilter = filters.some(
        (f) => enabledFilters.has(f.key) && tweet.classList.contains(`tweet-is-${f.key}`),
      );
      if (hiddenByFilter) {
        tweet.hidden = true;
      } else if (activeTab) {
        const allowedByTab = window._archiveTabAllowsTweet
          ? window._archiveTabAllowsTweet(tweet, activeTab)
          : true;
        tweet.hidden = !allowedByTab;
      } else {
        tweet.hidden = false;
      }
    });
  }

  function getFirstSegmentText(body) {
    if (!body) return "";
    const [firstSegmentHtml = ""] = body.innerHTML.split(/<br\s*\/?>/i);
    const scratch = document.createElement("div");
    scratch.innerHTML = firstSegmentHtml;
    return (scratch.textContent || "").trim();
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

  function prepareImage(image) {
    image.loading = "lazy";
    image.decoding = "async";
    image.tabIndex = 0;
    image.setAttribute("role", "button");
  }

  function prepareImages(root) {
    root.querySelectorAll(".tweet-media-item img").forEach(prepareImage);
  }

  lightbox.addEventListener("click", closeLightbox);

  document.addEventListener("click", (event) => {
    const image = event.target.closest(".tweet-media-item img");
    if (!image) return;
    event.preventDefault();
    event.stopPropagation();
    openLightbox(image);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lightbox.classList.contains("is-open")) {
      closeLightbox();
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const image = event.target.closest(".tweet-media-item img");
    if (!image) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    openLightbox(image);
  }, true);

  prepareImages(document);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches(".tweet-media-item img")) prepareImage(node);
        prepareImages(node);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
