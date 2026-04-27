"""Generate a multi-page sample PDF for testing the RAG agent.

Each page has distinct, factual content so the model has clear opportunities
to cite a specific page. The facts are deliberately a mix of:
  - well-known (sanity-check the LLM is using retrieval, not training data)
  - fictional / made-up (only retrieval can answer these correctly)
"""
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak

OUT = "docs/sample.pdf"

styles = getSampleStyleSheet()
h1 = ParagraphStyle("h1", parent=styles["Heading1"], spaceAfter=12)
h2 = ParagraphStyle("h2", parent=styles["Heading2"], spaceAfter=8)
body = ParagraphStyle("body", parent=styles["BodyText"], spaceAfter=8, leading=15)

doc = SimpleDocTemplate(
    OUT, pagesize=LETTER,
    leftMargin=0.9 * inch, rightMargin=0.9 * inch,
    topMargin=0.9 * inch, bottomMargin=0.9 * inch,
    title="Project Aurora — Internal Handbook (Sample)",
    author="RAG Agent Test Fixture",
)

story = []

# ---------- Page 1: Cover / overview ----------
story += [
    Paragraph("Project Aurora", h1),
    Paragraph("Internal Engineering Handbook (Sample, v0.3)", h2),
    Paragraph(
        "Project Aurora is a fictional internal platform used as a test fixture "
        "for retrieval-augmented question answering. This handbook describes its "
        "architecture, team conventions, and operational policies. None of the "
        "facts below are real — they exist purely so a RAG system can be evaluated "
        "on whether it grounds its answers in the document.",
        body,
    ),
    Spacer(1, 0.2 * inch),
    Paragraph("Table of Contents", h2),
    Paragraph("Page 2 — System architecture", body),
    Paragraph("Page 3 — Team & on-call rotation", body),
    Paragraph("Page 4 — Service level objectives (SLOs)", body),
    Paragraph("Page 5 — Deployment policy", body),
    Paragraph("Page 6 — Glossary &amp; FAQ", body),
    PageBreak(),
]

# ---------- Page 2: Architecture ----------
story += [
    Paragraph("1. System Architecture", h1),
    Paragraph(
        "Aurora is composed of three services: <b>Beacon</b> (ingest API), "
        "<b>Lumen</b> (query API), and <b>Helix</b> (background worker). All three "
        "are written in Go 1.23 and deployed as containers on a Kubernetes cluster "
        "named <b>aurora-prod-eu1</b>, hosted in the eu-west-2 region.",
        body,
    ),
    Paragraph(
        "Beacon accepts events at up to <b>12,000 requests per second</b> and "
        "writes them to a Kafka topic called <i>aurora.events.v2</i>. Helix "
        "consumes from that topic and persists records into a PostgreSQL 16 "
        "database named <b>aurora_main</b>. Lumen serves read traffic and is "
        "fronted by a Redis 7 cache with a 90-second TTL.",
        body,
    ),
    Paragraph(
        "The internal RPC framework is gRPC over mTLS. Certificates are issued "
        "by an internal CA called <b>Northstar</b> and rotated every 30 days.",
        body,
    ),
    PageBreak(),
]

# ---------- Page 3: Team ----------
story += [
    Paragraph("2. Team &amp; On-Call Rotation", h1),
    Paragraph(
        "The Aurora team consists of seven engineers split across two squads:",
        body,
    ),
    Paragraph(
        "<b>Squad Polaris</b> — owns Beacon and Helix. Tech lead: <b>Mira Okafor</b>. "
        "Members: Dimitri Ivanov, Sana Khoury, Felix Tan.",
        body,
    ),
    Paragraph(
        "<b>Squad Vega</b> — owns Lumen and the public SDKs. Tech lead: "
        "<b>Renata Salgado</b>. Members: Jae Park, Idris Bello.",
        body,
    ),
    Paragraph(
        "On-call rotates weekly and follows a follow-the-sun handoff at 09:00 UTC "
        "every Monday. The primary on-call carries a pager; the secondary is the "
        "fallback if the primary does not acknowledge within 7 minutes. "
        "Compensation for on-call is one extra day off per full week carried.",
        body,
    ),
    PageBreak(),
]

# ---------- Page 4: SLOs ----------
story += [
    Paragraph("3. Service Level Objectives", h1),
    Paragraph(
        "Aurora commits to the following SLOs, measured over a 30-day rolling window:",
        body,
    ),
    Paragraph(
        "• <b>Beacon ingest availability:</b> 99.95% — error budget of 21.6 minutes / month.",
        body,
    ),
    Paragraph(
        "• <b>Lumen query latency (p99):</b> under 250 ms for cache hits, under 800 ms for cache misses.",
        body,
    ),
    Paragraph(
        "• <b>Helix end-to-end processing latency (p95):</b> under 4 seconds from ingest to durable write.",
        body,
    ),
    Paragraph(
        "• <b>Data durability:</b> zero acknowledged writes lost. Backups run every 6 hours and are retained for 35 days.",
        body,
    ),
    Paragraph(
        "If the error budget for Beacon is exhausted before the window ends, all "
        "non-critical deploys are frozen until the budget resets.",
        body,
    ),
    PageBreak(),
]

# ---------- Page 5: Deployment ----------
story += [
    Paragraph("4. Deployment Policy", h1),
    Paragraph(
        "All production deploys go through a four-stage pipeline: <b>dev → staging "
        "→ canary → prod</b>. The canary stage receives 5% of production traffic "
        "for a minimum of 45 minutes before promotion.",
        body,
    ),
    Paragraph(
        "Deploys are blocked on Fridays after 14:00 UTC and on the day before any "
        "public holiday observed in the United Kingdom, except for security patches "
        "approved by the on-call security engineer.",
        body,
    ),
    Paragraph(
        "Rollback is automated: if the canary stage emits more than <b>0.5% 5xx</b> "
        "responses or p99 latency exceeds the SLO by 20% for three consecutive "
        "minutes, the previous revision is restored without human intervention.",
        body,
    ),
    PageBreak(),
]

# ---------- Page 6: Glossary / FAQ ----------
story += [
    Paragraph("5. Glossary &amp; FAQ", h1),
    Paragraph("<b>Beacon</b> — the ingest API service.", body),
    Paragraph("<b>Lumen</b> — the read/query API service.", body),
    Paragraph("<b>Helix</b> — the background worker that drains Kafka into Postgres.", body),
    Paragraph("<b>Northstar</b> — the internal certificate authority.", body),
    Paragraph("<b>aurora-prod-eu1</b> — the production Kubernetes cluster.", body),
    Spacer(1, 0.15 * inch),
    Paragraph("Frequently Asked Questions", h2),
    Paragraph(
        "<b>Q: Who do I page if Lumen is down at 03:00 UTC on a Sunday?</b><br/>"
        "A: The primary on-call for the current week. If they don't ack within 7 "
        "minutes, the pager escalates to the secondary, then to the tech lead of "
        "Squad Vega (Renata Salgado).",
        body,
    ),
    Paragraph(
        "<b>Q: Can I deploy on Friday at 16:00 UTC?</b><br/>"
        "A: No. Deploys are blocked after 14:00 UTC on Fridays unless it is a "
        "security patch approved by the on-call security engineer.",
        body,
    ),
    Paragraph(
        "<b>Q: What is Aurora's data retention for backups?</b><br/>"
        "A: 35 days, with a snapshot taken every 6 hours.",
        body,
    ),
]

doc.build(story)
print(f"Wrote {OUT}")
