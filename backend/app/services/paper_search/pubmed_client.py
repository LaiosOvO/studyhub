"""PubMed/NCBI E-utilities client for academic paper search.

Uses the two-step esearch + efetch pattern to find and retrieve
paper metadata from PubMed. Parses XML responses.
"""

import logging
import xml.etree.ElementTree as ET

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.schemas.paper import PaperResult, PaperSource

from .base_client import BasePaperClient

logger = logging.getLogger(__name__)

ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"


def _extract_text(element: ET.Element | None) -> str:
    """Recursively extract all text from an XML element."""
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


def _parse_pubmed_article(article: ET.Element) -> PaperResult | None:
    """Parse a single PubmedArticle XML element into PaperResult."""
    medline = article.find("MedlineCitation")
    if medline is None:
        return None

    article_elem = medline.find("Article")
    if article_elem is None:
        return None

    # PMID
    pmid_elem = medline.find("PMID")
    pmid = pmid_elem.text if pmid_elem is not None else None

    # Title
    title_elem = article_elem.find("ArticleTitle")
    title = _extract_text(title_elem) if title_elem is not None else ""
    if not title:
        return None

    # Abstract
    abstract_elem = article_elem.find("Abstract")
    abstract = None
    if abstract_elem is not None:
        abstract_texts = [
            _extract_text(at)
            for at in abstract_elem.findall("AbstractText")
        ]
        abstract = " ".join(abstract_texts) if abstract_texts else None

    # Authors
    authors: list[str] = []
    author_list = article_elem.find("AuthorList")
    if author_list is not None:
        for author in author_list.findall("Author"):
            last = author.findtext("LastName") or ""
            first = author.findtext("ForeName") or author.findtext("Initials") or ""
            name = f"{last} {first}".strip()
            if name:
                authors.append(name)

    # Year
    year = None
    pub_date = article_elem.find(".//PubDate")
    if pub_date is not None:
        year_elem = pub_date.find("Year")
        if year_elem is not None and year_elem.text:
            try:
                year = int(year_elem.text)
            except ValueError:
                pass

    # Venue (journal)
    journal = article_elem.find("Journal")
    venue = None
    if journal is not None:
        venue = journal.findtext("Title")

    # DOI from ArticleIdList
    doi = None
    pubmed_data = article.find("PubmedData")
    if pubmed_data is not None:
        for article_id in pubmed_data.findall(".//ArticleId"):
            if article_id.get("IdType") == "doi":
                doi = (article_id.text or "").strip()
                break

    # Language
    language_elem = article_elem.find("Language")
    language = language_elem.text if language_elem is not None else None

    return PaperResult(
        doi=doi,
        pmid=pmid,
        title=title,
        abstract=abstract,
        authors=authors,
        year=year,
        venue=venue,
        language=language,
        sources=[PaperSource.PUBMED],
    )


class PubMedClient(BasePaperClient):
    """PubMed paper search client via NCBI E-utilities."""

    def __init__(self, http_client: httpx.AsyncClient, api_key: str = "") -> None:
        super().__init__(http_client)
        self._api_key = api_key

    def _base_params(self) -> dict[str, str]:
        """Return common E-utilities parameters."""
        params: dict[str, str] = {"db": "pubmed", "retmode": "xml"}
        if self._api_key:
            params["api_key"] = self._api_key
        return params

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TimeoutException)),
    )
    async def _esearch(self, term: str, retmax: int = 25) -> list[str]:
        """Search PubMed and return a list of PMIDs."""
        params = {**self._base_params(), "term": term, "retmax": str(retmax)}
        response = await self._client.get(ESEARCH_URL, params=params, timeout=30.0)
        response.raise_for_status()

        root = ET.fromstring(response.text)
        return [
            id_elem.text
            for id_elem in root.findall(".//Id")
            if id_elem.text
        ]

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TimeoutException)),
    )
    async def _efetch(self, pmids: list[str]) -> list[PaperResult]:
        """Fetch paper details for a list of PMIDs."""
        if not pmids:
            return []

        params = {**self._base_params(), "id": ",".join(pmids)}
        response = await self._client.get(EFETCH_URL, params=params, timeout=30.0)
        response.raise_for_status()

        root = ET.fromstring(response.text)
        papers: list[PaperResult] = []
        for article in root.findall("PubmedArticle"):
            paper = _parse_pubmed_article(article)
            if paper is not None:
                papers.append(paper)
        return papers

    async def search_keywords(
        self, query: str, limit: int = 25
    ) -> list[PaperResult]:
        """Search PubMed by keyword."""
        pmids = await self._esearch(query, retmax=limit)
        return await self._efetch(pmids)

    async def search_doi(self, doi: str) -> PaperResult | None:
        """Look up a paper by DOI in PubMed."""
        pmids = await self._esearch(f"{doi}[AID]", retmax=1)
        papers = await self._efetch(pmids)
        return papers[0] if papers else None

    async def search_author(
        self, author: str, limit: int = 25
    ) -> list[PaperResult]:
        """Search papers by author name in PubMed."""
        pmids = await self._esearch(f"{author}[au]", retmax=limit)
        return await self._efetch(pmids)
