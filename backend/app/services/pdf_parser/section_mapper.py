"""TEI XML to structured sections mapper.

Parses GROBID TEI XML output into a structured dictionary of
title, abstract, classified sections, and references.
Handles both English and Chinese section headings.
"""

import xml.etree.ElementTree as ET

TEI_NS = "http://www.tei-c.org/ns/1.0"
NS = {"tei": TEI_NS}

# Section classification keywords (English)
_SECTION_KEYWORDS: dict[str, list[str]] = {
    "introduction": ["introduction", "intro", "background"],
    "methodology": ["method", "approach", "framework", "model", "technique", "algorithm"],
    "experiments": ["experiment", "evaluation", "setup", "implementation", "benchmark"],
    "results": ["result", "finding", "outcome", "performance"],
    "discussion": ["discussion", "analysis", "implication"],
    "conclusion": ["conclusion", "summary", "future work", "concluding"],
    "related_work": ["related work", "literature review", "prior work", "previous work"],
}

# Section classification keywords (Chinese)
_SECTION_KEYWORDS_ZH: dict[str, list[str]] = {
    "introduction": ["引言", "介绍", "背景", "绪论"],
    "methodology": ["方法", "模型", "框架", "算法", "技术方案"],
    "experiments": ["实验", "评估", "测试", "实现"],
    "results": ["结果", "性能", "表现"],
    "discussion": ["讨论", "分析"],
    "conclusion": ["结论", "总结", "展望"],
    "related_work": ["相关工作", "文献综述"],
}


def _extract_text(element: ET.Element | None) -> str:
    """Recursively extract all text content from an XML element."""
    if element is None:
        return ""
    parts: list[str] = []
    if element.text:
        parts.append(element.text)
    for child in element:
        parts.append(_extract_text(child))
        if child.tail:
            parts.append(child.tail)
    return "".join(parts).strip()


def classify_section(heading: str) -> str:
    """Map a section heading to a standard category.

    Checks both English and Chinese keyword lists.
    Returns 'other' if no match found.
    """
    heading_lower = heading.lower().strip()

    # Check English keywords
    for category, keywords in _SECTION_KEYWORDS.items():
        for keyword in keywords:
            if keyword in heading_lower:
                return category

    # Check Chinese keywords
    for category, keywords in _SECTION_KEYWORDS_ZH.items():
        for keyword in keywords:
            if keyword in heading:
                return category

    return "other"


def parse_tei_to_sections(tei_xml: str) -> dict:
    """Parse GROBID TEI XML into a structured sections dictionary.

    Returns:
        Dict with keys: title, abstract, sections, references.
        - sections: list of {heading, text, category}
        - references: list of {title, authors, year, doi}
    """
    root = ET.fromstring(tei_xml)

    # Title
    title_elem = root.find(f".//{{{TEI_NS}}}titleStmt/{{{TEI_NS}}}title")
    title = _extract_text(title_elem) if title_elem is not None else ""

    # Abstract
    abstract_elem = root.find(f".//{{{TEI_NS}}}abstract")
    abstract = ""
    if abstract_elem is not None:
        paragraphs = [
            _extract_text(p)
            for p in abstract_elem.findall(f".//{{{TEI_NS}}}p")
        ]
        abstract = " ".join(paragraphs) if paragraphs else _extract_text(abstract_elem)

    # Body sections
    sections: list[dict] = []
    body = root.find(f".//{{{TEI_NS}}}body")
    if body is not None:
        for div in body.findall(f"{{{TEI_NS}}}div"):
            head_elem = div.find(f"{{{TEI_NS}}}head")
            heading = _extract_text(head_elem) if head_elem is not None else ""

            paragraphs = [
                _extract_text(p)
                for p in div.findall(f"{{{TEI_NS}}}p")
            ]
            text = " ".join(paragraphs)

            if heading or text:
                sections.append({
                    "heading": heading,
                    "text": text,
                    "category": classify_section(heading),
                })

    # References
    references: list[dict] = []
    bibl_list = root.find(f".//{{{TEI_NS}}}listBibl")
    if bibl_list is not None:
        for bibl in bibl_list.findall(f"{{{TEI_NS}}}biblStruct"):
            ref = _parse_reference(bibl)
            if ref:
                references.append(ref)

    return {
        "title": title,
        "abstract": abstract,
        "sections": sections,
        "references": references,
    }


def _parse_reference(bibl: ET.Element) -> dict | None:
    """Parse a single biblStruct element into a reference dict."""
    # Title from analytic or monogr
    analytic = bibl.find(f"{{{TEI_NS}}}analytic")
    monogr = bibl.find(f"{{{TEI_NS}}}monogr")

    title = ""
    if analytic is not None:
        title_elem = analytic.find(f"{{{TEI_NS}}}title")
        title = _extract_text(title_elem) if title_elem is not None else ""

    if not title and monogr is not None:
        title_elem = monogr.find(f"{{{TEI_NS}}}title")
        title = _extract_text(title_elem) if title_elem is not None else ""

    if not title:
        return None

    # Authors
    authors: list[str] = []
    author_source = analytic if analytic is not None else monogr
    if author_source is not None:
        for author in author_source.findall(f"{{{TEI_NS}}}author"):
            persname = author.find(f"{{{TEI_NS}}}persName")
            if persname is not None:
                first = persname.findtext(f"{{{TEI_NS}}}forename") or ""
                last = persname.findtext(f"{{{TEI_NS}}}surname") or ""
                name = f"{first} {last}".strip()
                if name:
                    authors.append(name)

    # Year
    year = None
    if monogr is not None:
        date_elem = monogr.find(f".//{{{TEI_NS}}}date")
        if date_elem is not None:
            when = date_elem.get("when", "")
            if when and len(when) >= 4:
                try:
                    year = when[:4]
                except (ValueError, IndexError):
                    pass

    # DOI
    doi = None
    for idno in bibl.findall(f".//{{{TEI_NS}}}idno"):
        if idno.get("type") == "DOI":
            doi = (idno.text or "").strip()
            break

    return {
        "title": title,
        "authors": authors,
        "year": year,
        "doi": doi,
    }


def build_structured_content(parsed: dict) -> dict:
    """Build final structured content by grouping sections by category.

    Takes output of parse_tei_to_sections and returns a dict with
    methodology, experiments, results combined from matching sections.
    """
    sections = parsed.get("sections", [])

    def _combine_sections(category: str) -> str:
        texts = [s["text"] for s in sections if s["category"] == category and s["text"]]
        return " ".join(texts)

    return {
        "title": parsed.get("title", ""),
        "abstract": parsed.get("abstract", ""),
        "methodology": _combine_sections("methodology"),
        "experiments": _combine_sections("experiments"),
        "results": _combine_sections("results"),
        "references": parsed.get("references", []),
        "full_sections": sections,
    }
