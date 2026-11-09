"""Repair Tamil text pulled from a PDF's text layer.

PDFs typeset with XeLaTeX (and many others) store Tamil glyphs in *visual* order, so a
text extractor returns them that way:

  * the prefix vowel signs ெ ே ை come BEFORE their consonant ("ைக" for "கை");
  * the two-part vowels come split around it ("ெகா" for "கொ", "ேகா" for "கோ");
  * the extractor's spacing guesses put a space before the pulli ("களம ்") and after it,
    inside words ("பரீட் சை").

`normalize_tamil` puts the codepoints back in logical (Unicode) order. Only Tamil
characters are touched, so English and maths pass through unchanged. Spacing can only be
repaired around the pulli; word gaps the extractor dropped stay missing.
"""
from __future__ import annotations

import re

CONSONANT = "\u0B95-\u0BB9"          # க … ஹ
PREFIX_SIGNS = "\u0BC6\u0BC7\u0BC8"  # ெ ே ை (drawn left of the consonant)
PULLI = "\u0BCD"                     # ்
AA, AU_MARK = "\u0BBE", "\u0BD7"     # ா, ௗ
DEPENDENT = "\u0BBE-\u0BCD\u0BD7"    # every vowel sign and the pulli

# A Tamil letter, spaces, then a vowel sign or pulli: those spaces are always spurious.
_SPACE_BEFORE_SIGN = re.compile(rf"(?<=[\u0B80-\u0BFF])[ \t]+(?=[{DEPENDENT}])")
# Prefix sign written before its consonant: move it after.
_PREFIX_FIRST = re.compile(rf"([{PREFIX_SIGNS}])([{CONSONANT}])")
# Consonant + ெ/ே + ா (or ௗ) is one vowel: ொ ோ ௌ.
_SPLIT_O = re.compile(rf"([{CONSONANT}])\u0BC6{AA}")
_SPLIT_OO = re.compile(rf"([{CONSONANT}])\u0BC7{AA}")
_SPLIT_AU = re.compile(rf"([{CONSONANT}])\u0BC6{AU_MARK}")
# Pulli, spaces, Tamil consonant: the extractor split a cluster (கக் களம் → க்களம்).
_SPACE_AFTER_PULLI = re.compile(rf"{PULLI}[ \t]+(?=[{CONSONANT}])")


# A prefix sign NOT preceded by a consonant. In correct Unicode a vowel sign always follows
# its consonant, so these only occur when the text is in visual order (after a space, another
# sign, the pulli or an independent vowel: "\u0B87\u0BC8\u0BA3", "\u0B9F\u0BCD\u0BC8\u0B9A").
_ORPHAN_PREFIX = re.compile(rf"(?:^|(?<![{CONSONANT}]))[{PREFIX_SIGNS}]", re.M)
_ANY_PREFIX = re.compile(rf"[{PREFIX_SIGNS}]")


def has_tamil(text: str) -> bool:
    return any("\u0B80" <= ch <= "\u0BFF" for ch in text)


def is_visual_order(text: str) -> bool:
    """True when the Tamil in `text` is stored in visual order and needs repair.

    A sequence like "\u0B95 \u0BC8 \u0B95" alone is ambiguous (logical "\u0B95\u0BC8\u0B95" or visual "\u0B95\u0B95\u0BC8"), so this
    decides for the whole text: correct Tamil has no orphan prefix signs at all."""
    total = len(_ANY_PREFIX.findall(text))
    orphans = len(_ORPHAN_PREFIX.findall(text))
    return orphans >= 3 and orphans >= 0.2 * total


# ---------- Checking a Tamil tutor reply ----------
# Weak models drift into other languages mid-sentence ("giả thuyết", "acertissima") or emit
# broken letters. Maths, LaTeX, graph blocks and citations are removed before checking.

_NOT_PROSE = re.compile(r"```.*?```|\$\$.*?\$\$|\$[^$\n]*\$|\[S\d+\]|https?://\S+|\([^()\n]{0,40}\)"
                        r"|^\s*AI-solved.*$", re.S | re.M)
# Latin letters with accents (Vietnamese, Italian, French...) and scripts that never belong
# in a Sri Lankan Tamil reply: other Indic scripts, Sinhala, Cyrillic, Greek words, CJK, Thai.
_FOREIGN = re.compile(r"[À-ÖØ-öø-ɏḀ-ỿऀ-୿ఀ-෿Ѐ-ӿ฀-๿぀-鿿]")
# A vowel sign or pulli with no letter before it, or two in a row: a broken letter.
_BROKEN = re.compile(r"(?:^|(?<![஀-௿]))[ா-்]|[ா-ௌ][ா-ௌ]", re.M)
_LATIN_WORD = re.compile(r"\b[A-Za-z]{4,}\b")
_TAMIL_WORD = re.compile(r"[஀-௿]+")
# English the tutor may legitimately leave in Latin letters inside Tamil prose.
_ALLOWED_LATIN = {"kelu", "paper", "part", "sin", "cos", "tan", "cosec", "sec", "cot", "lim", "log", "exp",
                  "max", "min", "mod", "arg", "with", "units", "newton", "joule", "watt", "combined",
                  "mathematics", "question", "marking", "scheme", "practice", "generated"}
LONG_LATIN = 7      # one stray word this long ("acertissima") is enough to flag the reply


def tamil_reply_problems(text: str) -> list[str]:
    """What is wrong with a Tamil reply: 'foreign' (another language or script),
    'english' (too many English words), 'broken' (malformed Tamil letters). Empty if fine."""
    prose = _NOT_PROSE.sub(" ", text)
    problems = []
    if _FOREIGN.search(prose):
        problems.append("foreign")
    latin = [w for w in _LATIN_WORD.findall(prose) if w.lower() not in _ALLOWED_LATIN]
    tamil_words = len(_TAMIL_WORD.findall(prose))
    if (len(latin) >= 3 and len(latin) > 0.06 * max(tamil_words, 1)) or any(len(w) >= LONG_LATIN for w in latin):
        problems.append("english")
    if _BROKEN.search(prose):
        problems.append("broken")
    return problems


def normalize_tamil(text: str) -> str:
    """Repair visual-order Tamil; leave correct Tamil (and everything else) as it is."""
    if not has_tamil(text):
        return text
    text = _SPACE_BEFORE_SIGN.sub("", text)      # never valid in any Tamil text
    if not is_visual_order(text):
        return text
    text = _PREFIX_FIRST.sub(r"\2\1", text)
    text = _SPLIT_O.sub("\\1\u0BCA", text)
    text = _SPLIT_OO.sub("\\1\u0BCB", text)
    text = _SPLIT_AU.sub("\\1\u0BCC", text)
    return _SPACE_AFTER_PULLI.sub(PULLI, text)
