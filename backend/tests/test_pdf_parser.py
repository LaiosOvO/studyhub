"""Tests for the PDF parsing pipeline.

Covers: TEI XML parsing, section classification, GROBID client,
parser service orchestration, and API endpoints.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
import pytest_asyncio

from app.services.pdf_parser.grobid_client import GrobidClient
from app.services.pdf_parser.section_mapper import (
    build_structured_content,
    classify_section,
    parse_tei_to_sections,
)

# ─── TEI XML Test Fixture ────────────────────────────────────────────

SAMPLE_TEI_XML = """<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt>
        <title>Attention Is All You Need</title>
      </titleStmt>
    </fileDesc>
  </teiHeader>
  <text>
    <front>
      <abstract>
        <p>The dominant sequence transduction models are based on complex
        recurrent or convolutional neural networks.</p>
        <p>We propose a new simple network architecture, the Transformer.</p>
      </abstract>
    </front>
    <body>
      <div>
        <head>1. Introduction</head>
        <p>Recurrent neural networks have been firmly established as state
        of the art approaches in sequence modeling.</p>
      </div>
      <div>
        <head>2. Model Architecture</head>
        <p>Most competitive neural sequence transduction models have an
        encoder-decoder structure.</p>
      </div>
      <div>
        <head>3. Experiments</head>
        <p>We trained on the standard WMT 2014 English-German dataset.</p>
      </div>
      <div>
        <head>4. Results</head>
        <p>On the WMT 2014 English-to-German translation task, the big
        transformer model outperforms the best previously reported models.</p>
      </div>
      <div>
        <head>5. Conclusion</head>
        <p>In this work, we presented the Transformer, the first sequence
        transduction model based entirely on attention.</p>
      </div>
    </body>
    <back>
      <listBibl>
        <biblStruct>
          <analytic>
            <title>Neural Machine Translation by Jointly Learning to Align and Translate</title>
            <author>
              <persName>
                <forename>Dzmitry</forename>
                <surname>Bahdanau</surname>
              </persName>
            </author>
            <author>
              <persName>
                <forename>Kyunghyun</forename>
                <surname>Cho</surname>
              </persName>
            </author>
          </analytic>
          <monogr>
            <date when="2014"/>
          </monogr>
          <idno type="DOI">10.48550/arXiv.1409.0473</idno>
        </biblStruct>
        <biblStruct>
          <analytic>
            <title>Sequence to Sequence Learning with Neural Networks</title>
            <author>
              <persName>
                <forename>Ilya</forename>
                <surname>Sutskever</surname>
              </persName>
            </author>
          </analytic>
          <monogr>
            <date when="2014"/>
          </monogr>
        </biblStruct>
      </listBibl>
    </back>
  </text>
</TEI>"""


# ─── Section Mapper Tests ────────────────────────────────────────────


class TestSectionMapper:
    def test_parse_tei_title(self):
        result = parse_tei_to_sections(SAMPLE_TEI_XML)
        assert result["title"] == "Attention Is All You Need"

    def test_parse_tei_abstract(self):
        result = parse_tei_to_sections(SAMPLE_TEI_XML)
        assert "Transformer" in result["abstract"]
        assert "recurrent" in result["abstract"].lower()

    def test_parse_tei_sections(self):
        result = parse_tei_to_sections(SAMPLE_TEI_XML)
        assert len(result["sections"]) == 5
        headings = [s["heading"] for s in result["sections"]]
        assert "1. Introduction" in headings
        assert "2. Model Architecture" in headings

    def test_parse_tei_references(self):
        result = parse_tei_to_sections(SAMPLE_TEI_XML)
        assert len(result["references"]) == 2
        ref0 = result["references"][0]
        assert "Bahdanau" in ref0["authors"][0]
        assert ref0["doi"] == "10.48550/arXiv.1409.0473"
        assert ref0["year"] == "2014"

    def test_parse_tei_reference_without_doi(self):
        result = parse_tei_to_sections(SAMPLE_TEI_XML)
        ref1 = result["references"][1]
        assert ref1["doi"] is None
        assert "Sutskever" in ref1["authors"][0]


# ─── Section Classification Tests ────────────────────────────────────


class TestSectionClassification:
    def test_classify_introduction(self):
        assert classify_section("1. Introduction") == "introduction"
        assert classify_section("Introduction and Background") == "introduction"

    def test_classify_methodology(self):
        assert classify_section("3. Methodology") == "methodology"
        assert classify_section("Our Approach") == "methodology"
        assert classify_section("Model Architecture") == "methodology"

    def test_classify_experiments(self):
        assert classify_section("4. Experiments") == "experiments"
        assert classify_section("Evaluation Setup") == "experiments"

    def test_classify_results(self):
        assert classify_section("5. Results") == "results"
        assert classify_section("Main Findings") == "results"

    def test_classify_conclusion(self):
        assert classify_section("6. Conclusion") == "conclusion"
        assert classify_section("Summary and Future Work") == "conclusion"

    def test_classify_related_work(self):
        assert classify_section("2. Related Work") == "related_work"
        assert classify_section("Literature Review") == "related_work"

    def test_classify_discussion(self):
        assert classify_section("Discussion") == "discussion"

    def test_classify_other(self):
        assert classify_section("Appendix A") == "other"
        assert classify_section("Acknowledgments") == "other"

    # Chinese headings
    def test_classify_chinese_introduction(self):
        assert classify_section("引言") == "introduction"
        assert classify_section("一、介绍") == "introduction"

    def test_classify_chinese_methodology(self):
        assert classify_section("方法") == "methodology"
        assert classify_section("二、技术方案") == "methodology"

    def test_classify_chinese_experiments(self):
        assert classify_section("实验") == "experiments"
        assert classify_section("三、实验评估") == "experiments"

    def test_classify_chinese_results(self):
        assert classify_section("结果") == "results"

    def test_classify_chinese_conclusion(self):
        assert classify_section("结论") == "conclusion"
        assert classify_section("总结与展望") == "conclusion"


# ─── Build Structured Content Tests ──────────────────────────────────


class TestBuildStructuredContent:
    def test_build_groups_sections(self):
        parsed = parse_tei_to_sections(SAMPLE_TEI_XML)
        structured = build_structured_content(parsed)

        assert structured["title"] == "Attention Is All You Need"
        assert "Transformer" in structured["abstract"]
        assert len(structured["full_sections"]) == 5
        assert len(structured["references"]) == 2

    def test_build_methodology_combined(self):
        parsed = {
            "title": "Test",
            "abstract": "Abstract",
            "sections": [
                {"heading": "Method", "text": "Part 1", "category": "methodology"},
                {"heading": "Approach", "text": "Part 2", "category": "methodology"},
            ],
            "references": [],
        }
        structured = build_structured_content(parsed)
        assert "Part 1" in structured["methodology"]
        assert "Part 2" in structured["methodology"]

    def test_build_empty_sections(self):
        parsed = {
            "title": "Test",
            "abstract": "",
            "sections": [],
            "references": [],
        }
        structured = build_structured_content(parsed)
        assert structured["methodology"] == ""
        assert structured["experiments"] == ""
        assert structured["results"] == ""


# ─── GROBID Client Tests ─────────────────────────────────────────────


class TestGrobidClient:
    @pytest.mark.asyncio
    async def test_process_pdf_sends_correct_request(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = SAMPLE_TEI_XML
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response
            client = GrobidClient("http://test:8070")
            result = await client.process_pdf(b"fake_pdf_bytes")

            assert result == SAMPLE_TEI_XML
            mock_post.assert_called_once()
            call_args = mock_post.call_args
            assert "processFulltextDocument" in str(call_args)

    @pytest.mark.asyncio
    async def test_is_alive_returns_true(self):
        mock_response = MagicMock()
        mock_response.status_code = 200

        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_response
            client = GrobidClient("http://test:8070")
            result = await client.is_alive()
            assert result is True

    @pytest.mark.asyncio
    async def test_is_alive_returns_false_on_error(self):
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = httpx.TimeoutException("timeout")
            client = GrobidClient("http://test:8070")
            result = await client.is_alive()
            assert result is False


# ─── Parser Service Tests ────────────────────────────────────────────


class TestParserService:
    @pytest.mark.asyncio
    async def test_parse_paper_success(self):
        from app.services.pdf_parser.parser_service import ParserService

        mock_grobid = AsyncMock()
        mock_grobid.process_pdf = AsyncMock(return_value=SAMPLE_TEI_XML)

        mock_http = AsyncMock()
        mock_http_response = MagicMock()
        mock_http_response.content = b"fake_pdf"
        mock_http_response.status_code = 200
        mock_http_response.raise_for_status = MagicMock()
        mock_http.get = AsyncMock(return_value=mock_http_response)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        service = ParserService(mock_grobid, mock_http, mock_db)
        result = await service.parse_paper("paper-123", "https://example.com/paper.pdf")

        assert "error" not in result
        assert result["title"] == "Attention Is All You Need"
        assert len(result["full_sections"]) == 5

    @pytest.mark.asyncio
    async def test_parse_paper_grobid_failure(self):
        from app.services.pdf_parser.parser_service import ParserService

        mock_grobid = AsyncMock()
        mock_grobid.process_pdf = AsyncMock(side_effect=httpx.TimeoutException("timeout"))

        mock_http = AsyncMock()
        mock_http_response = MagicMock()
        mock_http_response.content = b"fake_pdf"
        mock_http_response.status_code = 200
        mock_http_response.raise_for_status = MagicMock()
        mock_http.get = AsyncMock(return_value=mock_http_response)

        mock_db = AsyncMock()

        service = ParserService(mock_grobid, mock_http, mock_db)
        result = await service.parse_paper("paper-123", "https://example.com/paper.pdf")

        assert result["error"] == "parsing_failed"

    @pytest.mark.asyncio
    async def test_parse_paper_download_failure(self):
        from app.services.pdf_parser.parser_service import ParserService

        mock_grobid = AsyncMock()
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))

        mock_db = AsyncMock()

        service = ParserService(mock_grobid, mock_http, mock_db)
        result = await service.parse_paper("paper-123", "https://example.com/paper.pdf")

        assert result["error"] == "download_failed"

    @pytest.mark.asyncio
    async def test_parse_paper_from_bytes(self):
        from app.services.pdf_parser.parser_service import ParserService

        mock_grobid = AsyncMock()
        mock_grobid.process_pdf = AsyncMock(return_value=SAMPLE_TEI_XML)

        mock_http = AsyncMock()
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        service = ParserService(mock_grobid, mock_http, mock_db)
        result = await service.parse_paper_from_bytes("paper-123", b"fake_pdf")

        assert "error" not in result
        assert result["title"] == "Attention Is All You Need"
