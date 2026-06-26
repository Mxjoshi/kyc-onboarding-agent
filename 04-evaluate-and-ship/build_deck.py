#!/usr/bin/env python3
"""
Submission-quality pitch deck for the KYC Onboarding Agent (Acme Bank UAE).
16:9 (960x540 pt) PDF, generated with reportlab. All content is sourced from this
repository (README, SPEC, phase deliverables, eval results, app source) and one
live sample run captured from the running app.

Text is laid out with a small manual word-wrap engine (stringWidth + drawString),
because this environment's reportlab build mis-wraps the Paragraph/Table flowables
at narrow widths. Helvetica (core font) renders identically everywhere.

Run:  python3 build_deck.py
Out:  kyc-onboarding-agent-deck.pdf  (in this folder)
"""
import re
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

W, H = 960.0, 540.0

# ---- palette (matches the app's design system) ----
NAVY   = HexColor("#0B2545")
NAVY2  = HexColor("#13315C")
ACCENT = HexColor("#14B8A6")
GREEN  = HexColor("#16A34A")
AMBER  = HexColor("#D97706")
RED    = HexColor("#DC2626")
INK    = HexColor("#14223B")
MUTED  = HexColor("#5B6B82")
SLATE  = HexColor("#334155")
LINE   = HexColor("#D8DEE9")
SOFT   = HexColor("#F1F5F9")
WHITE  = HexColor("#FFFFFF")
CAPGRY = HexColor("#475569")

REG, BOLD, OBL = "Helvetica", "Helvetica-Bold", "Helvetica-Oblique"

SPINE = 46.0
CL, CR = 86.0, 914.0
CW = CR - CL            # 828
CTOP, CBOT = 430.0, 58.0

# =================================================================
# manual text engine (the reportlab flowables mis-wrap here)
# =================================================================
def parse_runs(text):
    """'<b>foo</b> bar' -> [('foo', True), (' bar', False)]"""
    bold, runs = False, []
    for part in re.split(r'(<b>|</b>)', text):
        if part == '<b>': bold = True
        elif part == '</b>': bold = False
        elif part != '': runs.append((part.replace('&nbsp;', ' '), bold))
    return runs

def _layout(c, runs, size, max_w):
    space = 0.278 * size   # Helvetica space advance; this build's stringWidth(' ') returns 0
    lines, wsum = [[]], 0.0
    for txt, bold in runs:
        font = BOLD if bold else REG
        for word in txt.split(' '):
            if word == '': continue
            wl = c.stringWidth(word, font, size)
            need = wl + (space if lines[-1] else 0)
            if lines[-1] and wsum + need > max_w:
                lines.append([(word, font, wl)]); wsum = wl
            else:
                lines[-1].append((word, font, wl)); wsum += need
    return lines

def measure(c, runs, size, max_w, leading):
    return max(1, len(_layout(c, runs, size, max_w))) * leading

def draw_rich(c, x, y_top, runs, size, max_w, color, leading, bold_color=None):
    """Draw wrapped rich text from y_top downward. Returns block height."""
    space = 0.278 * size
    lines = _layout(c, runs, size, max_w)
    y = y_top - size
    for ln in lines:
        cx = x
        for (word, font, wl) in ln:
            c.setFont(font, size)
            c.setFillColor(bold_color if (bold_color is not None and font == BOLD) else color)
            c.drawString(cx, y, word); cx += wl + space
        y -= leading
    return len(lines) * leading

def ctext(c, cx, y, text, font, size, color):
    c.setFillColor(color); c.setFont(font, size)
    c.drawString(cx - c.stringWidth(text, font, size)/2.0, y, text)

def tracked(c, x, y, text, size, color, tracking=1.6, font=BOLD):
    """Letter-spaced text, drawn char by char (a text-object setCharSpace leaks
    into the page state in this build and corrupts later word spacing)."""
    c.setFont(font, size); c.setFillColor(color)
    cx = x
    for ch in text:
        c.drawString(cx, y, ch)
        cx += c.stringWidth(ch, font, size) + tracking

# =================================================================
# chrome
# =================================================================
def spine(c, num=None):
    c.setFillColor(NAVY); c.rect(0, 0, SPINE, H, fill=1, stroke=0)
    c.setFillColor(ACCENT); c.rect(SPINE-3, 0, 3, H, fill=1, stroke=0)
    if num is not None:
        c.saveState(); c.translate(24, 30); c.rotate(90)
        c.setFillColor(HexColor("#5B7196")); c.setFont(BOLD, 9)
        c.drawString(0, 0, "KYC ONBOARDING AGENT"); c.restoreState()
        ctext(c, SPINE/2.0, H-26, str(num), BOLD, 9, HexColor("#5B7196"))

def footer(c, note=None):
    c.setFillColor(MUTED); c.setFont(REG, 8.4)
    c.drawString(CL, 30, note or "Synthetic data. Acme Bank UAE is fictional. No real customer data.")

def header(c, kicker, title, num):
    spine(c, num)
    tracked(c, CL, 498, kicker.upper(), 11, ACCENT, 1.6)
    c.setFillColor(NAVY); c.setFont(BOLD, 25); c.drawString(CL, 466, title)
    c.setFillColor(ACCENT); c.rect(CL, 454, 58, 3.2, fill=1, stroke=0)

# =================================================================
# bullets (circle bullet, true hanging indent, vertically centered)
# =================================================================
def bullets(c, items, top=CTOP, bot=CBOT, x=CL, width=CW, gap=12, size=14, leading=19.5):
    blocks = []
    for it in items:
        note = isinstance(it, tuple)
        txt = it[1] if note else it
        runs = parse_runs(txt)
        indent = 22
        h = measure(c, runs, size, width - indent, leading)
        blocks.append((runs, indent, note, h))
    total = sum(b[3] for b in blocks) + gap*(len(blocks)-1)
    y = top - max(0.0, ((top-bot) - total)/2.0)
    for runs, indent, note, h in blocks:
        if note:
            draw_rich(c, x+indent, y, runs, 12.5, width-indent, MUTED, 17)
            c.setFillColor(HexColor("#94A3B8")); c.rect(x+4, y-13, 9, 1.6, fill=1, stroke=0)
        else:
            c.setFillColor(ACCENT); c.circle(x+5, y - size*0.52, 2.4, fill=1, stroke=0)
            draw_rich(c, x+indent, y, runs, size, width-indent, INK, leading, bold_color=NAVY)
        y -= (h + gap)

# =================================================================
# table (drawn manually with the text engine)
# =================================================================
STATUS_COLOR = {"Met": GREEN, "Yes": GREEN, "Pending": AMBER, "Caught": GREEN, "No": RED}

def table(c, rows, col_w, top=CTOP, bot=CBOT, x=CL, status_col=None, size=10.7, leading=14):
    PAD, VPAD = 9.0, 8.0
    total_w = sum(col_w)
    grid, row_h = [], []
    for ri, row in enumerate(rows):
        cells, maxh = [], 0.0
        for ci, val in enumerate(row):
            inner = col_w[ci] - 2*PAD
            is_head = (ri == 0)
            is_status = (status_col is not None and ci == status_col and ri > 0)
            bold = is_head or ci == 0 or is_status
            runs = [(val, bold)]
            h = measure(c, runs, size, inner, leading)
            cells.append((runs, h, is_head, is_status, val)); maxh = max(maxh, h)
        grid.append(cells); row_h.append(maxh + 2*VPAD)
    total_h = sum(row_h)
    y_top = top - max(0.0, ((top-bot) - total_h)/2.0)
    yy = y_top
    for ri, (cells, rh) in enumerate(zip(grid, row_h)):
        ybot = yy - rh
        if ri == 0:
            c.setFillColor(NAVY); c.rect(x, ybot, total_w, rh, fill=1, stroke=0)
        elif ri % 2 == 0:
            c.setFillColor(SOFT); c.rect(x, ybot, total_w, rh, fill=1, stroke=0)
        cx = x
        for ci, (runs, h, is_head, is_status, val) in enumerate(cells):
            inner = col_w[ci] - 2*PAD
            block_top = ybot + (rh + h)/2.0
            if is_head:
                draw_rich(c, cx+PAD, block_top, runs, size, inner, WHITE, leading)
            elif is_status:
                col = STATUS_COLOR.get(val.strip(), INK)
                draw_rich(c, cx+PAD, block_top, runs, size, inner, col, leading)
            else:
                draw_rich(c, cx+PAD, block_top, runs, size, inner, INK, leading,
                          bold_color=(NAVY if ci == 0 else None))
            cx += col_w[ci]
        yy = ybot
    c.setStrokeColor(LINE); c.setLineWidth(0.5)
    yy = y_top; c.line(x, yy, x+total_w, yy)
    for rh in row_h:
        yy -= rh; c.line(x, yy, x+total_w, yy)
    cx = x; c.line(cx, y_top, cx, y_top-total_h)
    for w in col_w:
        cx += w; c.line(cx, y_top, cx, y_top-total_h)

# =================================================================
# two equal boxes (input / output)
# =================================================================
def two_box(c, lt, lbody, rt, rbody, top=CTOP, bot=66):
    gap = 26.0; bw = (CW-gap)/2.0; bh = top-bot; by = bot
    for i, (ttl, body, accent) in enumerate([(lt, lbody, False), (rt, rbody, True)]):
        bx = CL + i*(bw+gap)
        c.setFillColor(SOFT); c.roundRect(bx, by, bw, bh, 8, fill=1, stroke=0)
        c.setStrokeColor(LINE); c.setLineWidth(0.8); c.roundRect(bx, by, bw, bh, 8, fill=0, stroke=1)
        hbar = 30.0
        c.setFillColor(ACCENT if accent else NAVY2)
        c.roundRect(bx, by+bh-hbar, bw, hbar, 8, fill=1, stroke=0)
        c.rect(bx, by+bh-hbar, bw, 10, fill=1, stroke=0)
        c.setFillColor(WHITE); c.setFont(BOLD, 12.5); c.drawString(bx+15, by+bh-hbar+10, ttl)
        yy = by + bh - hbar - 14
        for line in body:
            h = draw_rich(c, bx+15, yy, parse_runs(line), 12.2, bw-30, INK, 16.5, bold_color=NAVY)
            yy -= (h + 7)

# =================================================================
# architecture diagram
# =================================================================
def arrow(c, x1, y, x2):
    c.setStrokeColor(MUTED); c.setLineWidth(1.6); c.line(x1, y, x2-6, y)
    c.setFillColor(MUTED); p = c.beginPath()
    p.moveTo(x2, y); p.lineTo(x2-7, y+4.5); p.lineTo(x2-7, y-4.5); p.close()
    c.drawPath(p, fill=1, stroke=0)

def node(c, x, y, w, h, title, caption, header_color, rounded=False):
    cx = x + w/2.0; cap = caption.split("\n") if caption else []
    if rounded:
        c.setFillColor(header_color); c.roundRect(x, y, w, h, 12, fill=1, stroke=0)
        ctext(c, cx, y+h/2.0+8, title, BOLD, 11.5, WHITE)
        yy = y+h/2.0 - 9
        for ln in cap:
            ctext(c, cx, yy, ln, REG, 8.2, HexColor("#CFEAE5")); yy -= 10.5
    else:
        c.setFillColor(WHITE); c.setStrokeColor(LINE); c.setLineWidth(0.9)
        c.roundRect(x, y, w, h, 7, fill=1, stroke=1)
        c.setFillColor(header_color); c.roundRect(x, y+h-23, w, 23, 7, fill=1, stroke=0)
        c.rect(x, y+h-23, w, 9, fill=1, stroke=0)
        ctext(c, cx, y+h-16.5, title, BOLD, 10.8, WHITE)
        yy = y+h-39
        for ln in cap:
            ctext(c, cx, yy, ln, REG, 8.6, CAPGRY); yy -= 11

def diagram(c):
    header(c, "Architecture", "How a decision is made (and who decides)", 6)
    y, h = 250, 96
    boxes = [
        ("Case in",        "Officer picks\na newcomer case",   NAVY,   True),
        ("RAG retrieval",  "Local embeddings\nrank policy",     ACCENT, False),
        ("Grounded answer","Decides from only\nthose sections", NAVY2,  False),
        ("Trust judge",    "Grades vs rubric,\ntags the cause", AMBER,  False),
        ("Human + audit",  "Risk to a human,\nall logged",      GREEN,  True),
    ]
    n = len(boxes); gap = 16.0; bw = (CW - gap*(n-1))/n; x = CL; centers = []
    for (ttl, cap, col, rnd) in boxes:
        node(c, x, y, bw, h, ttl, cap, col, rounded=rnd)
        centers.append((x, x+bw)); x += bw + gap
    for i in range(n-1):
        arrow(c, centers[i][1], y+h/2.0, centers[i+1][0])
    by, bh = 116, 76
    c.setFillColor(NAVY); c.roundRect(CL, by, CW, bh, 9, fill=1, stroke=0)
    c.setFillColor(ACCENT); c.rect(CL, by, 5, bh, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont(BOLD, 12.5)
    c.drawString(CL+22, by+bh-25, "What the AI does, and does not, decide")
    msg = ("The AI decides only from the retrieved policy and cites every claim. It refuses when the policy is silent, "
           "and it never auto-approves risk: sanctions, PEP, and uncovered cases go to a human. An independent judge "
           "grades every answer.")
    draw_rich(c, CL+22, by+bh-36, parse_runs(msg), 10.6, CW-150, HexColor("#CBD5E1"), 14.6)
    footer(c)

# =================================================================
# dark title / closing
# =================================================================
def title_slide(c):
    c.setFillColor(NAVY); c.rect(0,0,W,H, fill=1, stroke=0)
    c.setFillColor(ACCENT); c.rect(0,0,8,H, fill=1, stroke=0)
    tracked(c, 70, 410, "UAE BANKING  /  KYC AND AML  /  AGENTIC AI", 12, ACCENT, 2.2)
    c.setFillColor(WHITE); c.setFont(BOLD, 50); c.drawString(68, 340, "KYC Onboarding Agent")
    c.setFillColor(HexColor("#9FB3C8")); c.setFont(REG, 17); c.drawString(70, 311, "Acme Bank UAE (fictional)")
    c.setFillColor(ACCENT); c.rect(70, 289, 70, 3.5, fill=1, stroke=0)
    one = ("A trustworthy KYC/AML onboarding assistant: it reviews a newcomer against policy and returns a cited "
           "proceed, request documents, or escalate decision, refuses when the policy is silent, escalates risk to "
           "a human, and grades every answer with a visible trust layer.")
    draw_rich(c, 70, 268, parse_runs(one), 15.5, 760, HexColor("#E2E8F0"), 22)
    c.setFillColor(HexColor("#7E93AB")); c.setFont(REG, 12.5)
    c.drawString(70, 120, "Buildathon project. The onboarding companion to the Newcomer Credit Decisioning Copilot capstone.")
    c.setFillColor(HexColor("#6B8099")); c.setFont(BOLD, 10.5)
    c.drawString(70, 88, "github.com/Mxjoshi/kyc-onboarding-agent")
    c.setFillColor(HexColor("#566C86")); c.setFont(OBL, 9.6)
    c.drawString(70, 58, "Synthetic data only. No real customers or company documents. Built solo with Claude Code as the engineering pair.")
    c.showPage()

def closing_slide(c):
    c.setFillColor(NAVY); c.rect(0,0,W,H, fill=1, stroke=0)
    c.setFillColor(ACCENT); c.rect(0,0,8,H, fill=1, stroke=0)
    tracked(c, 70, 432, "STATUS AND CLOSE", 12, ACCENT, 2.2)
    c.setFillColor(WHITE); c.setFont(BOLD, 33); c.drawString(68, 388, "Built, tested, evaluated.")
    c.setFillColor(ACCENT); c.setFont(BOLD, 33); c.drawString(68, 351, "Deployment is the next step.")
    lines = [
        ("Built", "The agent, the trust layer, and the seven screen console are complete, type clean, and unit tested."),
        ("Proven", "Three real cases graded 100 percent, the discrimination test catches 3 of 3 planted bad answers, every failure gets a root cause tag."),
        ("Pending", "Live deployment (the Render blueprint is wired). The in memory audit log would persist in production."),
    ]
    yy = 308
    for k, v in lines:
        c.setFillColor(ACCENT); c.setFont(BOLD, 13); c.drawString(70, yy-13, k)
        h = draw_rich(c, 150, yy, parse_runs(v), 12.5, 740, HexColor("#D7E0EA"), 17)
        yy -= max(34, h+16)
    c.setStrokeColor(HexColor("#274060")); c.setLineWidth(1); c.line(70, 122, 890, 122)
    c.setFillColor(WHITE); c.setFont(BOLD, 12); c.drawString(70, 97, "github.com/Mxjoshi/kyc-onboarding-agent")
    c.setFillColor(HexColor("#7E93AB")); c.setFont(REG, 11)
    c.drawString(70, 75, "Monika owns the product: scope, decisions, reviews, and sign offs. Claude Code is the engineering pair.")
    c.setFillColor(HexColor("#566C86")); c.setFont(OBL, 9.6)
    c.drawString(70, 50, "Synthetic data only. Acme Bank UAE is fictional. Aligned to the CBUAE Feb 2026 Guidance Note expectations.")
    c.showPage()

# =================================================================
# content slide wrappers
# =================================================================
def slide_bullets(c, kicker, title, num, items, lead=None):
    header(c, kicker, title, num); t = CTOP
    if lead:
        h = draw_rich(c, CL, CTOP, parse_runs(lead), 13.5, CW, SLATE, 18.5); t = CTOP - h - 16
    bullets(c, items, top=t, bot=CBOT); footer(c)

def slide_table(c, kicker, title, num, rows, col_w, status_col=None, lead=None, note=None):
    header(c, kicker, title, num); t = CTOP
    if lead:
        h = draw_rich(c, CL, CTOP, parse_runs(lead), 13.5, CW, SLATE, 18.5); t = CTOP - h - 14
    table(c, rows, col_w, top=t, bot=CBOT, status_col=status_col); footer(c, note)

# ================================================================= BUILD
def build(path):
    c = canvas.Canvas(path, pagesize=(W, H))
    title_slide(c)

    slide_bullets(c, "The problem", "Onboarding a newcomer is slow, manual, and high stakes", 2, [
        "When an expat newcomer opens a UAE bank account, a compliance officer checks identity, AML risk, and document requirements by hand against scattered policy.",
        "A wrong approval is an AML breach. A wrong rejection loses a good customer. Every decision must be explainable to a regulator.",
        "A generic AI chatbot makes this worse: it sounds confident even when wrong, and a confident wrong answer in KYC is a compliance failure.",
        "The UAE is about 88 percent expat, so this is a high volume problem, not an edge case.",
    ]); c.showPage()

    slide_table(c, "The landscape", "Alternatives today, and the gap each one leaves", 3, [
        ["Approach", "What it does today", "The gap it leaves"],
        ["Manual officer review", "An officer reads policy and the file by hand for each applicant.", "Slow and inconsistent. Hard to audit at scale, prone to human error."],
        ["Generic AI chatbot", "A general LLM answers questions about the case.", "Confident when wrong. No grounding, no citations, no refusal. Unsafe for compliance."],
        ["Rules engine or KYC vendor", "Fixed checklists and screening flags.", "Rigid and opaque to the officer. No plain language reasoning, weak on novel cases."],
        ["This agent", "Grounded cited decision, honest refusal, human escalation, a proven trust layer.", "Closes the gap: explainable and auditable by design."],
    ], [176, 330, 322], lead="A general LLM is not the baseline to beat. The real baselines are manual review and rigid vendor tools.")
    c.showPage()

    slide_bullets(c, "Who it is for", "The compliance officer, and the people who audit them", 4, [
        "<b>Primary user: the bank's onboarding and compliance officer.</b> They enter a newcomer's case and need a fast, defensible recommendation they can stand behind.",
        "<b>Secondary user: the risk and audit function.</b> They must prove, after the fact, that every decision was sound and policy backed.",
        "What both need is the same: a decision that is grounded in policy, cited clause by clause, and recorded in an audit trail.",
        ("note", "The design follows UAE supervisory expectations directly: explainability, human oversight, the right to challenge an outcome, and auditability (CBUAE Feb 2026 Guidance Note)."),
    ]); c.showPage()

    slide_bullets(c, "The approach", "Retrieval plus an LLM, wrapped in a visible trust layer", 5, [
        "<b>Retrieval augmented, not free recall.</b> The agent retrieves the relevant policy sections first, then decides using only those, citing each claim.",
        "<b>No trained model.</b> Rules and retrieval plus an LLM. For a regulated v1, explainability and defensibility matter more than a marginal accuracy gain.",
        "<b>The trust layer is the point, not the chat.</b> Citations on every claim, honest refusal, an independent judge that grades each answer, and a discrimination test that proves the judge catches bad answers.",
        "<b>Local embeddings.</b> Retrieval runs offline via transformers.js, so the whole pipeline runs from one command with a single API key for generation.",
    ]); c.showPage()

    diagram(c); c.showPage()

    slide_bullets(c, "The product flow", "What happens on screen, step by step", 7, [
        "<b>1. Pick a case.</b> On the Onboarding screen the officer selects an applicant and reviews their profile, documents, and AML screening.",
        "<b>2. Run the check.</b> Live steps stream on screen: retrieve, then decide, then grade.",
        "<b>3. Read the verdict.</b> Proceed, request documents, or escalate, with a confidence signal and every claim linked to the exact policy clause (click to see the rule).",
        "<b>4. Trust scoreboard.</b> The judge's rubric score appears beside the decision, with a root cause tag if any check fails.",
        "<b>5. Human in the loop.</b> Escalated and paused cases land in the Review queue. Every decision is written to the Audit log and the CBUAE mapped Report.",
    ]); c.showPage()

    slide_bullets(c, "What is built", "A real, running application, not a concept", 8, [
        "<b>Seven screen console</b> (Next.js, React, TypeScript): Dashboard, Onboarding, Review queue, Policy search, Trust layer, Audit log, Report.",
        "<b>Six wired API routes</b> and the full retrieve, decide, grade pipeline running end to end on one command.",
        "<b>Grounded agent and independent judge</b> in code, both calling Claude (claude-opus-4-8); retrieval by local embeddings (all-MiniLM-L6-v2, cosine similarity).",
        "<b>Tested and type clean:</b> 8 unit tests pass, the production build type checks, the policy index and sample customers are committed so it runs on a fresh clone.",
        ("note", "Verified live for this deck: the full pipeline ran on localhost and returned the real decision shown next."),
    ]); c.showPage()

    header(c, "A real worked example", "One case in, the real captured output", 9)
    two_box(c,
        "INPUT: the applicant (synthetic)",
        ["<b>Omar Khan.</b> Resident newcomer, salaried.",
         "Applying for a current account.",
         "Documents on file: passport, Emirates ID, residence visa, salary certificate, tenancy contract.",
         "AML screening: no sanctions match, not a PEP."],
        "OUTPUT: the agent's decision (live)",
        ["<b>Recommendation: PROCEED.</b> Confidence: high.",
         "<b>Trust score: 100 percent</b> (all 4 rubric checks passed; root cause: none).",
         "Why: all required identity and address documents present, no AML flags, each claim cited to its policy section.",
         "The officer reads the cited rationale, can defend it, and makes the final call."])
    footer(c, "Captured from the running app. Companion cases: Layla returns REQUEST DOCUMENTS, Sara returns ESCALATE (both 100 percent).")
    c.showPage()

    slide_bullets(c, "The core AI, made trustworthy", "Five mechanisms that keep the answer honest", 10, [
        "<b>Grounding (RAG).</b> The decision can only use the retrieved policy sections, not the model's memory.",
        "<b>Citations.</b> Every claim names the exact section it rests on; structured JSON output is validated, ungrounded answers are rejected.",
        "<b>Honest refusal.</b> When the policy does not cover a case, the agent says so and escalates instead of guessing.",
        "<b>Independent judge.</b> A second Claude call grades each answer against a 4 check rubric; the score is computed in code, not trusted to the model.",
        "<b>Root cause tags.</b> A failed check is labelled bad_retrieval, bad_generation, or ambiguous_input, so a failure points to the real fix.",
    ]); c.showPage()

    slide_bullets(c, "How it was evaluated", "A rubric, a judge, and a test that tries to break it", 11, [
        "<b>The rubric (4 yes/no checks):</b> grounded citations, honest refusal, no hallucination, correct action.",
        "<b>LLM judge.</b> Reads the full policy, the case, and the agent's answer, then grades each check. The score and failed checks are computed in code for reliability.",
        "<b>Discrimination test.</b> The judge is fed three deliberately broken answers: an invented salary rule, a wrong citation, and a confident answer to a case the policy does not cover.",
        "<b>The standout loop (find, diagnose, fix, verify).</b> An early run wrongly escalated Omar; the eval flagged it, RCA tagged bad_retrieval (a missing AML section), the fix raised retrieval to 7 sections, and the same eval verified Omar then passed at 100 percent.",
    ]); c.showPage()

    slide_table(c, "Results", "Success criteria: target versus measured", 12, [
        ["Success criterion", "Target", "Measured", "Status"],
        ["Every answer cites the exact policy section", "Yes", "Yes, on all graded answers", "Met"],
        ["Refuse when the policy does not cover the case", "Yes", "Yes (tourist remote case refused)", "Met"],
        ["Escalate risk to a human, never auto approve", "Yes", "Yes (sanctions plus PEP escalated)", "Met"],
        ["Real cases graded by the judge", "Pass", "3 of 3 at 100 percent", "Met"],
        ["Discrimination test catches planted bad answers", "3 of 3", "3 of 3 caught", "Met"],
        ["Each failure gets a root cause tag", "Yes", "Yes (bad_retrieval on the Omar loop)", "Met"],
        ["Runs end to end on one command", "Yes", "Yes", "Met"],
        ["Live public deployment", "Yes", "Not yet (blueprint wired)", "Pending"],
    ], [322, 92, 252, 90], status_col=3,
       note="Synthetic data. Figures are the repository's recorded eval output (scripts/test-evals.mjs) plus a live run.")
    c.showPage()

    slide_table(c, "Risks and how each was tested", "Every known failure mode has a guardrail and a test", 13, [
        ["Risk", "Guardrail", "How it was tested"],
        ["Hallucinated rule (invented fee or threshold)", "no_hallucination check; uses only retrieved policy", "Discrimination test: invented salary rule, caught"],
        ["Wrong citation (rule says the opposite)", "grounded_citations check against the cited section", "Discrimination test: false address rule, caught"],
        ["Confident answer to an uncovered case", "honest_refusal check; refuse and escalate", "Discrimination test: tourist remote case, caught"],
        ["Auto approving a risky customer", "Sanctions, PEP, uncovered cases route to a human", "Sara case returns ESCALATE, not approve"],
        ["Silent bad retrieval", "RCA bad_retrieval tag plus find, fix, verify loop", "Omar regression found, fixed, re verified by the eval"],
        ["Prompt injection in free text", "Input length clamp before the prompt; synthetic data", "Long and adversarial input is capped"],
    ], [236, 300, 292])
    c.showPage()

    slide_bullets(c, "The differentiator", "Two stages of one newcomer journey, connected", 14, [
        "<b>The trust layer is the product.</b> Most demos show an LLM answering. This one shows the LLM being graded, and proves the grader catches bad answers on purpose.",
        "<b>One connected journey.</b> This agent gets the expat safely in the door (onboarding). The Newcomer Credit Decisioning Copilot capstone then decides if they can borrow (credit).",
        "<b>A real connector, not a slogan.</b> Onboarding outputs a verified CustomerProfile (identity, KYC and AML status, the economic fields), which is exactly the input the credit copilot consumes.",
        "<b>Regulation aligned by design.</b> Grounding, citations, refusal, human oversight, and audit map directly to the CBUAE Feb 2026 Guidance Note expectations.",
    ]); c.showPage()

    slide_bullets(c, "Impact", "Faster, more consistent, and defensible onboarding", 15, [
        "<b>For the officer:</b> a grounded, cited recommendation in seconds instead of a slow manual policy hunt.",
        "<b>For risk and audit:</b> every decision recorded with its citations, trust score, and root cause, so it is defensible to a regulator.",
        "<b>For the bank:</b> fewer wrong rejections of good newcomers, and fewer unsafe approvals, on a high volume expat population.",
        ("note", "Illustrative, not yet measured on real operations. The claims describe the designed effect; no live bank throughput or error rate has been measured."),
    ]); c.showPage()

    slide_bullets(c, "Roadmap", "What is next, in priority order", 16, [
        "<b>Deploy live.</b> Ship the Render blueprint to a public URL (the one remaining phase 4 step).",
        "<b>Persist the audit log.</b> Move the in memory store to an append only store so the trail survives a restart.",
        "<b>Connect to the capstone.</b> Emit the verified CustomerProfile and feed it straight into the credit copilot.",
        "<b>MCP wrapper.</b> Expose the same functions as tools so the agent can be driven by other systems.",
        "<b>Broaden the policy set</b> and add more graded cases to the eval harness.",
    ]); c.showPage()

    closing_slide(c)
    c.save()

if __name__ == "__main__":
    import os
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kyc-onboarding-agent-deck.pdf")
    build(out); print("wrote", out)
