#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
ARCHIVE_FILES = [
    "anincandescence_archive.html",
    "anincandescence_archive_time_desc.html",
    "anincandescence_archive_media_first_time_desc.html",
    "anincandescence_archive_text_length_desc.html",
    "anincandescence_archive_text_entropy_desc.html",
]


def intro_for(filename: str) -> str:
    mapping = {
        "anincandescence_archive.html": "原始归档顺序，按时间从早到晚排列。",
        "anincandescence_archive_time_desc.html": "按时间从新到旧排列，适合直接追最新内容。",
        "anincandescence_archive_media_first_time_desc.html": "优先显示带图推文，再按时间从新到旧排列。",
        "anincandescence_archive_text_length_desc.html": "按正文可见文本长度从长到短排列。",
        "anincandescence_archive_text_entropy_desc.html": "按正文字符信息熵从高到低排列。",
    }
    return mapping[filename]


def transform_html(text: str, filename: str) -> str:
    title_match = re.search(r"<title>(.*?)</title>", text, re.S)
    h1_match = re.search(r"<h1>(.*?)</h1>", text, re.S)
    if not title_match or not h1_match:
        raise ValueError(f"Missing title or h1 in {filename}")

    title = title_match.group(1).strip()
    heading = h1_match.group(1).strip()
    intro = intro_for(filename)

    text = text.replace(
        "<meta charset='UTF-8'>",
        "<meta charset='UTF-8'>\n<meta name='viewport' content='width=device-width, initial-scale=1.0'>",
        1,
    )

    text = re.sub(
        r"<style>.*?</style>",
        "<link rel='stylesheet' href='archive.css'>",
        text,
        count=1,
        flags=re.S,
    )

    body_open = (
        "<body>\n"
        "<div class='archive-shell'>\n"
    )
    text = text.replace("<body>\n", body_open, 1)

    new_heading = (
        f"<h1 class='archive-page-title'>{heading}</h1>\n"
        f"<p class='archive-intro'>{intro}</p>"
    )
    text = text.replace(f"<h1>{heading}</h1>", new_heading, 1)

    text = text.replace("</body>", "  <script src='archive.js'></script>\n</div>\n</body>", 1)
    return text


def main() -> None:
    for filename in ARCHIVE_FILES:
        path = ROOT / filename
        original = path.read_text(encoding="utf-8")
        updated = transform_html(original, filename)
        path.write_text(updated, encoding="utf-8")
        print(f"updated {filename}")


if __name__ == "__main__":
    main()
