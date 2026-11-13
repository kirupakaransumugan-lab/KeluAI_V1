// A small maths glyph for each topic name the quiz generator returns (English or Tamil).
// First match wins, so the more specific names come first.
const GLYPHS: [RegExp, string][] = [
  // Applied mathematics first: their names share words ("motion", "forces") with each other.
  [/centre of mass|ஈர்வை மையம்|திணிவு மையம்/i, "x̄"],
  [/circular motion|வட்ட இயக்கம்/i, "ω"],
  [/simple harmonic|எளிய இசை/i, "∿"],
  [/projectile|எறிபொருள்/i, "↗"],
  [/newton|நியூற்றன்/i, "F=ma"],
  [/kinematic|இயக்கவியல்|இயக்கக்/i, "v(t)"],
  [/impulse|collision|கணத்தாக்கு|மோதல்/i, "Δp"],
  [/friction|உராய்வு/i, "μ"],
  [/work|energy|power|வேலை|சக்தி|வலு/i, "W"],
  [/statics|coplanar|forces|நிலையியல்|விசை/i, "ΣF"],
  [/statist|புள்ளிவிபர/i, "σ"],
  [/partial fraction|பகுதிப் பின்ன/i, "A⁄B"],
  [/indices|logarithm|சுட்டி|மடக்கை/i, "logₐ"],
  [/function|சார்ப/i, "f(x)"],
  [/differential equation|வகையீட்டுச் சமன்பாடு/i, "dy⁄dx"],
  [/differentiat|derivative|stationary|வகையிட|வகையீ/i, "f′(x)"],
  [/integrat|தொகையிட|தொகையீ/i, "∫"],
  [/vector|காவி/i, "→"],
  [/complex|சிக்கல்/i, "ℂ"],
  [/probab|நிகழ்தகவு/i, "P(A)"],
  [/induction|தொகுத்தறி/i, "Σ"],
  [/inequal|சமனிலி/i, "≤"],
  [/limit|எல்லை/i, "lim"],
  [/binomial|ஈருறுப்பு/i, "ⁿCᵣ"],
  [/permutation|combination|வரிசைமாற்ற|சேர்மான/i, "n!"],
  [/trig|sin|cos|திரிகோண/i, "θ"],
  [/circle|வட்ட/i, "◯"],
  [/straight line|line|நேர்கோடு/i, "y=mx"],
  [/quadratic|polynomial|இருபடி|பல்லுறுப்பி/i, "x²"],
  [/series|sequence|தொடர்/i, "Σaₙ"],
  [/matri|தாய/i, "[A]"],
];

export function topicGlyph(topic: string): string {
  return GLYPHS.find(([re]) => re.test(topic))?.[1] ?? "π";
}
