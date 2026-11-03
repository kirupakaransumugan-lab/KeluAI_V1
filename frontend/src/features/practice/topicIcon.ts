// A small maths glyph for each topic name the quiz generator returns (English or Tamil).
// First match wins, so the more specific names come first.
const GLYPHS: [RegExp, string][] = [
  [/differential equation|வகையீட்டுச் சமன்பாடு/i, "dy⁄dx"],
  [/differentiat|derivative|stationary|வகையிட|வகையீ/i, "f′(x)"],
  [/integrat|தொகையிட|தொகையீ/i, "∫"],
  [/vector|காவி/i, "a⃗"],
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
