"""
PDF Export Service — generates research report PDFs using reportlab.
Supports Korean text via built-in CID fonts (no external font files needed).
"""
import io
import json
from datetime import datetime
from services.db_service import fetch_all, fetch_one


def _build_pdf(report: dict, evidence: list[dict], quality: dict | None) -> bytes:
    """Build PDF bytes from report data using reportlab."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.cidfonts import UnicodeCIDFont

    # Register CID font for Korean support
    pdfmetrics.registerFont(UnicodeCIDFont("HYSMyeongJo-Medium"))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()

    # Custom styles with Korean font
    title_style = ParagraphStyle(
        "KRTitle", parent=styles["Title"],
        fontName="HYSMyeongJo-Medium", fontSize=18, spaceAfter=6,
        textColor=HexColor("#1a1a2e"),
    )
    heading_style = ParagraphStyle(
        "KRHeading", parent=styles["Heading2"],
        fontName="HYSMyeongJo-Medium", fontSize=13, spaceBefore=12, spaceAfter=4,
        textColor=HexColor("#16213e"),
    )
    body_style = ParagraphStyle(
        "KRBody", parent=styles["Normal"],
        fontName="HYSMyeongJo-Medium", fontSize=10, leading=14,
        spaceAfter=4,
    )
    small_style = ParagraphStyle(
        "KRSmall", parent=styles["Normal"],
        fontName="HYSMyeongJo-Medium", fontSize=8, leading=10,
        textColor=HexColor("#666666"),
    )
    center_style = ParagraphStyle(
        "KRCenter", parent=body_style,
        alignment=TA_CENTER,
    )

    elements = []

    # Header banner
    header_data = [
        [Paragraph("Lucas AI Research Engine", ParagraphStyle(
            "HeaderTitle", parent=title_style, textColor=HexColor("#ffffff"),
            alignment=TA_CENTER, fontSize=14,
        ))],
    ]
    header_table = Table(header_data, colWidths=[170 * mm])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#1a1a2e")),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 8 * mm))

    # Title
    elements.append(Paragraph(report["title"], title_style))

    # Meta info
    meta_lines = [
        f"Date: {report.get('created_at', 'N/A')}",
        f"Category: {report.get('category', 'general')}",
        f"Trigger: {report.get('trigger_type', 'auto')} | Priority: {report.get('priority', 5)}",
        f"Model: {report.get('model_used', 'N/A')}",
    ]
    for line in meta_lines:
        elements.append(Paragraph(line, small_style))
    elements.append(Spacer(1, 4 * mm))

    # Metrics table
    elements.append(Paragraph("Metrics", heading_style))
    conf = (report.get("confidence_avg") or 0) * 100
    agree = (report.get("agreement_rate") or 0) * 100
    metrics_data = [
        ["Confidence", f"{conf:.1f}%", "Agreement", f"{agree:.1f}%"],
        ["Evidence", str(report.get("evidence_count", 0)), "Contradictions", str(report.get("contradictions", 0))],
    ]
    if quality:
        qs = (quality.get("quality_score") or 0) * 100
        sd = (quality.get("source_diversity") or 0) * 100
        metrics_data.append(["Quality Score", f"{qs:.1f}%", "Source Diversity", f"{sd:.1f}%"])
        metrics_data.append(["Verified", f"{quality.get('verified_count', 0)}/{quality.get('source_count', 0)}", "", ""])

    metrics_table = Table(metrics_data, colWidths=[40 * mm, 40 * mm, 40 * mm, 40 * mm])
    metrics_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#e8f4fd")),
        ("FONTNAME", (0, 0), (-1, -1), "HYSMyeongJo-Medium"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#cccccc")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(metrics_table)
    elements.append(Spacer(1, 4 * mm))

    # Summary
    elements.append(Paragraph("Summary", heading_style))
    summary_text = (report.get("summary") or "N/A").replace("\n", "<br/>")
    elements.append(Paragraph(summary_text, body_style))
    elements.append(Spacer(1, 3 * mm))

    # Full Analysis
    if report.get("full_analysis"):
        elements.append(Paragraph("Full Analysis", heading_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#cccccc")))
        # Split into paragraphs and render
        for para in report["full_analysis"].split("\n"):
            para = para.strip()
            if not para:
                elements.append(Spacer(1, 2 * mm))
                continue
            # Detect markdown headings
            if para.startswith("### "):
                elements.append(Paragraph(para[4:], ParagraphStyle(
                    "KRH3", parent=heading_style, fontSize=11,
                )))
            elif para.startswith("## "):
                elements.append(Paragraph(para[3:], heading_style))
            elif para.startswith("# "):
                elements.append(Paragraph(para[2:], ParagraphStyle(
                    "KRH1", parent=heading_style, fontSize=15,
                )))
            elif para.startswith("- "):
                elements.append(Paragraph(f"\u2022 {para[2:]}", body_style))
            else:
                elements.append(Paragraph(para, body_style))
        elements.append(Spacer(1, 4 * mm))

    # Evidence Chain (top 10)
    if evidence:
        elements.append(Paragraph(f"Evidence Chain ({len(evidence)} sources)", heading_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#cccccc")))
        for i, ev in enumerate(evidence[:10], 1):
            conf_pct = (ev.get("confidence") or 0) * 100
            verified_tag = " [Verified]" if ev.get("verified") else ""
            elements.append(Paragraph(
                f"<b>#{i}</b> (Confidence: {conf_pct:.0f}%){verified_tag} — {ev.get('source_type', 'web')}",
                ParagraphStyle("EvHead", parent=body_style, fontSize=9, textColor=HexColor("#333333")),
            ))
            claim = (ev.get("claim") or "")[:300]
            elements.append(Paragraph(claim, small_style))
            elements.append(Spacer(1, 2 * mm))

        if len(evidence) > 10:
            elements.append(Paragraph(f"... and {len(evidence) - 10} more sources", small_style))

    # Footer
    elements.append(Spacer(1, 8 * mm))
    elements.append(HRFlowable(width="100%", thickness=1, color=HexColor("#1a1a2e")))
    elements.append(Paragraph(
        f"Generated by Lucas AI Research Engine | {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        center_style,
    ))

    doc.build(elements)
    return buf.getvalue()


async def export_report_pdf(report_id: int) -> bytes | None:
    """Export a research report as PDF bytes. Returns None if not found."""
    report = await fetch_one(
        """SELECT r.*, t.query, t.trigger_type, t.priority, t.category
           FROM research_reports r
           JOIN research_topics t ON r.topic_id = t.id
           WHERE r.id = ?""",
        (report_id,),
    )
    if not report:
        return None

    evidence = await fetch_all(
        "SELECT * FROM research_evidence WHERE topic_id = ? ORDER BY confidence DESC",
        (report["topic_id"],),
    )

    quality = await fetch_one(
        "SELECT * FROM research_quality_metrics WHERE report_id = ?", (report_id,)
    )

    return _build_pdf(report, evidence, quality)
