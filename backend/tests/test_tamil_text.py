"""Tamil text from a PDF text layer, put back into logical Unicode order."""
import pytest

from app.rag.tamil_text import normalize_tamil

# Left: exactly what pypdf returned from the 2025 Tamil marking scheme. Right: correct Tamil.
CASES = [
    ("இலங ் ைக", "இலங்கை"),                          # space before pulli + prefix ை
    ("திைணக ் களம ்", "திணைக்களம்"),                 # prefix ை, split cluster
    ("பரீட ் ைச", "பரீட்சை"),
    ("ெகாள ் ேவாம்", "கொள்வோம்"),                    # split ொ and ோ
    ("இைணந ் த கணிதம ்", "இணைந்த கணிதம்"),         # the real space survives
    ("ெவள் ைள", "வெள்ளை"),                          # ெ before ள is not ௌ
    ("ெகௗ", "கௌ"),
]


# One real line from the PDF: enough orphan signs to be recognised as visual order.
PAGE = "இலங ் ைக பரீட ் ைசத ் திைணக ் களம ் ெகாள ் ேவாம்"


@pytest.mark.parametrize("raw,expected", CASES)
def test_visual_order_is_repaired(raw, expected):
    # Short fragments can't show their order on their own, so each is judged inside a page.
    assert normalize_tamil(f"{PAGE} {raw}").endswith(expected)


def test_a_whole_visual_order_line():
    # Every letter is right. A real gap after the pulli ("களம் கொள்") is joined too: the
    # extractor's spaces after ் are mostly breaks inside words, so they all go.
    assert normalize_tamil(PAGE) == "இலங்கை பரீட்சைத்திணைக்களம்கொள்வோம்"


def test_english_and_maths_are_untouched():
    text = "Q1 (5) 9 · 2^k < (k + 3)!  sin 2θ = 2 sin θ cos θ"
    assert normalize_tamil(text) is text


def test_already_correct_tamil_is_unchanged():
    good = "கணிதத் தொகுத்தறிவுக் கோட்பாட்டைப் பயன்படுத்தி நிறுவுக"
    assert normalize_tamil(good) == good
