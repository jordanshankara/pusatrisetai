/// Bagian 6.5 BuildSpec — escape karakter khusus, key = {lastnamePenulisPertama}{tahun}{kataPertamaJudul}.
interface BibtexAuthor {
  name: string;
}

interface BibtexInput {
  title: string;
  authors: BibtexAuthor[];
  year: number | null;
  venueDisplayName: string | null;
  venueType: "conference" | "journal" | "preprint_repo" | "repository" | null;
  doi: string | null;
  canonicalUrl: string | null;
}

const SPECIAL_CHARS: Record<string, string> = {
  "{": "\\{",
  "}": "\\}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
};

export function escapeBibtex(value: string): string {
  return value.replace(/[{}&%$#_]/g, (ch) => SPECIAL_CHARS[ch]);
}

function lastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || "unknown";
}

function firstTitleWord(title: string): string {
  const match = title.trim().match(/[A-Za-z0-9]+/);
  return (match?.[0] ?? "untitled").toLowerCase();
}

function bibtexKey(input: BibtexInput): string {
  const year = input.year ?? "nd";
  if (input.authors.length === 0) {
    return `unknown${year}`;
  }
  const last = lastName(input.authors[0].name).toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${last}${year}${firstTitleWord(input.title)}`;
}

function entryType(venueType: BibtexInput["venueType"]): "article" | "inproceedings" | "misc" {
  if (venueType === "journal") return "article";
  if (venueType === "conference") return "inproceedings";
  return "misc";
}

export function buildBibtex(input: BibtexInput): string {
  const type = entryType(input.venueType);
  const key = bibtexKey(input);
  const fields: string[] = [];

  fields.push(`  title = {${escapeBibtex(input.title)}}`);
  if (input.authors.length > 0) {
    fields.push(`  author = {${input.authors.map((a) => escapeBibtex(a.name)).join(" and ")}}`);
  }
  if (input.year !== null) {
    fields.push(`  year = {${input.year}}`);
  }
  if (input.venueDisplayName) {
    const venueField = type === "article" ? "journal" : type === "inproceedings" ? "booktitle" : "howpublished";
    fields.push(`  ${venueField} = {${escapeBibtex(input.venueDisplayName)}}`);
  }
  if (input.doi) {
    fields.push(`  doi = {${escapeBibtex(input.doi)}}`);
  }
  const url = input.canonicalUrl ?? (input.doi ? `https://doi.org/${input.doi}` : null);
  if (url) {
    fields.push(`  url = {${escapeBibtex(url)}}`);
  }

  return `@${type}{${key},\n${fields.join(",\n")}\n}\n`;
}
