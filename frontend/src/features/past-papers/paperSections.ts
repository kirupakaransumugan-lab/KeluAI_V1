import type { PaperSection, PaperSummary } from "../../services/api";

/** Everything the chunker found under one paper ("I" or "II"). */
export interface PaperGroup {
  paper: string;
  sections: PaperSection[];
  parts: string[];         // only parts with tagged questions: other part tags aren't reliable
  chunks: number;
  questions: number;
}

/** The chunker tags papers from headings, so a stray heading can create a paper that isn't
 *  really in the document. Decides which detected papers are shown as a paper of their own;
 *  anything left out is still readable under the whole document. */
export function isRealPaper(group: PaperGroup): boolean {
  // TODO(human)
  return group.chunks > 0;
}

/** Papers a document has, for its cards and the reader's section list. */
export function papersIn(doc: Pick<PaperSummary, "sections">): PaperGroup[] {
  const groups = new Map<string, PaperGroup>();
  for (const section of doc.sections) {
    if (!section.paper) continue;
    const group = groups.get(section.paper)
      ?? { paper: section.paper, sections: [], parts: [], chunks: 0, questions: 0 };
    group.sections.push(section);
    group.chunks += section.chunks;
    group.questions += section.questions.length;
    if (section.part && section.questions.length) group.parts.push(section.part);
    groups.set(section.paper, group);
  }
  return [...groups.values()].filter(isRealPaper);
}

/** Tagged questions in a document, counting each paper's Q1 separately. */
export function questionCount(doc: Pick<PaperSummary, "sections">): number {
  return doc.sections.reduce((sum, s) => sum + s.questions.length, 0);
}
