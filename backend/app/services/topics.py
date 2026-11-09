"""The fixed A/L Combined Maths topic list behind "topics covered" and "mastery by topic".

The AI names each question's topic in its own words ("Loci in the Argand diagram"), so names
are matched onto this list. Order matters: the first match wins, so specific topics come
before broad ones ("Limits involving trigonometric functions" is Limits, not Trigonometry).
A name that matches nothing still counts in accuracy and streaks, just not under a topic.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Topic:
    id: int                     # topics.id and Qdrant `topic_ids`: never change or reuse one
    key: str
    strand: str                 # "pure" | "applied"
    en: str
    ta: str
    pattern: re.Pattern


def _t(id_: int, key: str, strand: str, en: str, ta: str, pattern: str) -> Topic:
    return Topic(id_, key, strand, en, ta, re.compile(pattern, re.I))


TOPICS: tuple[Topic, ...] = (
    # Applied first where the wording would otherwise read as Pure ("resolving vectors of forces").
    _t(1, "projectiles", "applied", "Projectile motion", "எறியங்கள்", r"projectile|எறிய"),
    _t(2, "collisions", "applied", "Impulse and collisions", "கணத்தாக்கும் மோதுகையும்", r"impulse|collision|கணத்தாக்கு|மோது"),
    _t(3, "work_energy", "applied", "Work, energy and power", "வேலை, சக்தி, வலு", r"\bwork\b|energy|\bpower\b.*engine|வேலை|சக்தி"),
    _t(4, "circular_motion", "applied", "Circular motion", "வட்ட இயக்கம்", r"circular motion|வட்ட இயக்க"),
    _t(5, "shm", "applied", "Simple harmonic motion", "எளிமை இசை இயக்கம்", r"harmonic|இசை இயக்க"),
    _t(6, "newton", "applied", "Newton's laws of motion", "நியூற்றனின் விதிகள்", r"newton|pulley|connected particles|நியூற்ற"),
    _t(7, "kinematics", "applied", "Kinematics", "இயக்கவியல்", r"kinematic|velocity.time|relative velocity|acceleration|இயக்கவியல்"),
    _t(8, "friction", "applied", "Friction", "உராய்வு", r"friction|உராய்வு"),
    _t(9, "centre_of_mass", "applied", "Centre of mass", "திணிவு மையம்", r"cent(re|er) of (mass|gravity)|திணிவு மைய|ஈர்வை மைய"),
    _t(10, "statics", "applied", "Statics and coplanar forces", "நிலையியல்", r"static|coplanar|equilibrium|\bforces?\b|moment|jointed rod|framework|நிலையியல்|விசை"),
    _t(11, "vectors", "applied", "Vectors", "காவிகள்", r"vector|காவி"),
    _t(12, "probability", "applied", "Probability", "நிகழ்தகவு", r"probab|bayes|நிகழ்தகவு"),
    _t(13, "statistics", "applied", "Statistics", "புள்ளிவிபரவியல்", r"statistic|\bmean\b|median|variance|standard deviation|புள்ளிவிபர"),

    _t(14, "complex", "pure", "Complex numbers", "சிக்கலெண்கள்", r"complex|argand|de moivre|சிக்கல"),
    _t(15, "induction", "pure", "Mathematical induction", "கணிதத் தொகுத்தறிவு", r"induction|தொகுத்தறி"),
    _t(16, "binomial", "pure", "Binomial expansion", "ஈருறுப்பு விரிவு", r"binomial|ஈருறுப்பு"),
    _t(17, "permutations", "pure", "Permutations and combinations", "வரிசைமாற்றமும் சேர்மானமும்", r"permutation|combination|arrangement|வரிசைமாற்ற|சேர்மான"),
    _t(18, "limits", "pure", "Limits", "எல்லைகள்", r"\blimits?\b|எல்லை"),
    _t(19, "integration", "pure", "Integration", "தொகையிடல்", r"integra|volume of revolution|area under|தொகையி|தொகையீ"),
    _t(20, "diff_applications", "pure", "Applications of differentiation", "வகையிடலின் பிரயோகங்கள்", r"applications of differentiation|tangent|normal to|stationary|maxim|minim|curve sketch|நிலைப்புள்ளி|வகையிடலின் பிரயோக"),
    _t(21, "differentiation", "pure", "Differentiation", "வகையிடல்", r"differentia|derivative|வகையிட|வகையீ"),
    _t(22, "circles", "pure", "Circles", "வட்டங்கள்", r"circle|வட்ட"),
    _t(23, "straight_lines", "pure", "Straight lines", "நேர்கோடுகள்", r"straight line|coordinate geometry|gradient|நேர்கோடு|ஆள்கூற்று"),
    _t(24, "matrices", "pure", "Matrices", "தாயங்கள்", r"matri|தாய"),
    _t(25, "series", "pure", "Series", "தொடர்கள்", r"series|sequence|progression|summation|தொடர்"),
    _t(26, "inequalities", "pure", "Inequalities", "சமனிலிகள்", r"inequal|absolute value|modulus|சமனிலி"),
    _t(27, "trigonometry", "pure", "Trigonometry", "திரிகோணகணிதம்", r"trig|sine rule|cosine rule|திரிகோண"),
    _t(28, "partial_fractions", "pure", "Partial fractions", "பகுதிப் பின்னங்கள்", r"partial fraction|பகுதிப் பின்ன"),
    _t(29, "quadratics", "pure", "Quadratics", "இருபடிச் சார்புகள்", r"quadratic|discriminant|இருபடி"),
    _t(30, "polynomials", "pure", "Polynomials", "பல்லுறுப்பிகள்", r"polynomial|remainder theorem|factor theorem|பல்லுறுப்பி"),
    _t(31, "logarithms", "pure", "Indices and logarithms", "சுட்டிகளும் மடக்கைகளும்", r"logarithm|\bindices\b|exponential|மடக்கை|சுட்டி"),
    _t(32, "functions", "pure", "Functions", "சார்புகள்", r"function|சார்பு"),
)


_BY_KEY = {t.key: t for t in TOPICS}
_BY_ID = {t.id: t for t in TOPICS}


def by_key(key: str) -> Topic | None:
    return _BY_KEY.get(key)


def by_id(topic_id: int) -> Topic | None:
    return _BY_ID.get(topic_id)


def classify(name: str) -> Topic | None:
    return next((t for t in TOPICS if t.pattern.search(name)), None)
