"""Verifin synthetic KYC/AML PDF test-data generator.

Generates a reproducible suite of 13 fictional PDF documents used to
exercise the already-built Verifin application end-to-end (KYC
completeness, document extraction, transaction extraction, AML risk
detection, multi-file evidence aggregation, compliance summarization,
persistence, error handling, and human review).

Every document is synthetic. No real identities, accounts, or financial
records are used or fetched from anywhere — everything here is generated
locally and deterministically from the fictional data defined below.

Usage:
    pip install reportlab
    python generate_verifin_test_pdfs.py

Re-running this script is safe: each output file is overwritten in place
(same 13 filenames every run), so it never accumulates duplicates.
"""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)
from reportlab.lib.colors import HexColor


OUTPUT = Path("Verifin_Test_Data")
OUTPUT.mkdir(exist_ok=True)

# A4 is 210mm wide; SimpleDocTemplate below uses 18mm left/right margins,
# so everything drawn between the margins has at most this much width.
# Every table's colWidths must sum to no more than this or it will run
# past the printable area. (This is the bug audit from the brief: several
# of the originally-supplied column-width tuples summed to well over this
# — e.g. 175mm, 191mm, 180mm, 185mm — those are the ones fixed below.)
USABLE_WIDTH = A4[0] - 2 * 18 * mm  # ~174mm


# ---------------------------------------------------------
# Styling
# ---------------------------------------------------------

NAVY = HexColor("#0B1736")
BLUE = HexColor("#2563EB")
TEAL = HexColor("#0F766E")
GREEN = HexColor("#16A34A")
AMBER = HexColor("#D97706")
RED = HexColor("#DC2626")
SLATE = HexColor("#475569")
LIGHT = HexColor("#F1F5F9")
WHITE = colors.white


styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    "VerifinTitle",
    parent=styles["Title"],
    fontSize=22,
    leading=26,
    textColor=NAVY,
    alignment=TA_CENTER,
    spaceAfter=15,
)

heading_style = ParagraphStyle(
    "VerifinHeading",
    parent=styles["Heading2"],
    fontSize=14,
    leading=18,
    textColor=NAVY,
    spaceBefore=10,
    spaceAfter=8,
)

body_style = ParagraphStyle(
    "VerifinBody",
    parent=styles["BodyText"],
    fontSize=9.5,
    leading=14,
    textColor=SLATE,
)

small_style = ParagraphStyle(
    "VerifinSmall",
    parent=body_style,
    fontSize=8,
    leading=11,
)

warning_style = ParagraphStyle(
    "VerifinWarning",
    parent=body_style,
    fontSize=9,
    leading=13,
    textColor=RED,
    alignment=TA_CENTER,
)

label_style = ParagraphStyle(
    "VerifinLabel",
    parent=body_style,
    fontSize=8,
    textColor=SLATE,
)

value_style = ParagraphStyle(
    "VerifinValue",
    parent=body_style,
    fontSize=10,
    textColor=NAVY,
)

# Small wrapping style used inside table cells (transaction/manifest/bank
# tables) so long counterparty names, descriptions, and purposes wrap onto
# multiple lines instead of overflowing their column.
cell_style = ParagraphStyle(
    "VerifinCell",
    parent=body_style,
    fontSize=6.5,
    leading=8,
    textColor=SLATE,
    wordWrap="CJK",  # breaks long unbroken tokens too, not just at spaces
)

cell_header_style = ParagraphStyle(
    "VerifinCellHeader",
    parent=cell_style,
    textColor=WHITE,
    fontName="Helvetica-Bold",
)

manifest_cell_style = ParagraphStyle(
    "VerifinManifestCell",
    parent=body_style,
    fontSize=7.5,
    leading=10,
    textColor=SLATE,
    wordWrap="CJK",
)


# ---------------------------------------------------------
# PDF helpers
# ---------------------------------------------------------

def watermark(canvas, doc):
    canvas.saveState()

    canvas.setFillColor(HexColor("#E2E8F0"))
    canvas.setFont("Helvetica-Bold", 38)
    canvas.translate(105 * mm, 145 * mm)
    canvas.rotate(35)

    canvas.drawCentredString(
        0,
        0,
        "SYNTHETIC TEST DATA",
    )

    canvas.restoreState()

    canvas.saveState()

    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(
        18 * mm,
        12 * mm,
        "VERIFIN TEST ENVIRONMENT",
    )

    canvas.setFillColor(RED)
    canvas.drawRightString(
        195 * mm,
        12 * mm,
        "NOT REAL / FOR TESTING ONLY",
    )

    canvas.restoreState()


def build_pdf(filename, story):
    path = OUTPUT / filename

    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
        title=f"Verifin Synthetic Test Document - {filename}",
        author="Verifin Test Suite",
    )

    doc.build(
        story,
        onFirstPage=watermark,
        onLaterPages=watermark,
    )

    print(f"Created: {path}")


def p(text, style=body_style):
    return Paragraph(text, style)


def section(title):
    return [
        Spacer(1, 8),
        Paragraph(title, heading_style),
    ]


def key_value_table(rows):
    data = []

    for key, value in rows:
        data.append([
            Paragraph(str(key), label_style),
            Paragraph(str(value), value_style),
        ])

    # 48mm + 122mm = 170mm, safely inside the ~174mm usable width
    # (the original 50mm + 125mm = 175mm overran it by 1mm).
    table = Table(
        data,
        colWidths=[48 * mm, 122 * mm],
        hAlign="LEFT",
    )

    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E2E8F0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))

    return table


def transaction_table(rows):
    headers = [
        "Transaction ID",
        "Date",
        "Amount",
        "Currency",
        "Type",
        "Counterparty",
        "Country",
    ]

    data = [[Paragraph(h, cell_header_style) for h in headers]]

    for row in rows:
        data.append([
            row["id"],
            row["date"],
            f'{row["amount"]:,.2f}',
            row["currency"],
            row["type"],
            # Wrapped (not plain text) so long counterparty names break
            # onto multiple lines within the column instead of
            # overflowing past it or getting silently clipped.
            Paragraph(row["counterparty"], cell_style),
            row["country"],
        ])

    # 24+22+23+17+24+38+20 = 168mm, within the ~174mm usable width.
    table = Table(
        data,
        repeatRows=1,
        colWidths=[
            24 * mm,
            22 * mm,
            23 * mm,
            17 * mm,
            24 * mm,
            38 * mm,
            20 * mm,
        ],
    )

    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 6.5),
        ("LEADING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [
            WHITE,
            HexColor("#F8FAFC"),
        ]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    return table


def transaction_header(title, customer, description):
    return [
        p("VERIFIN", title_style),
        p(title, heading_style),
        p(
            "<b>SYNTHETIC TEST DATA -- NOT REAL FINANCIAL INFORMATION</b>",
            warning_style,
        ),
        Spacer(1, 8),
        key_value_table([
            ("Customer", customer),
            ("Document Type", "Synthetic Transaction Log"),
            ("Purpose", description),
            ("Currency", "USD"),
        ]),
        Spacer(1, 12),
    ]


# ---------------------------------------------------------
# 01 Passport
# ---------------------------------------------------------

story = [
    p("VERIFIN", title_style),
    p("SYNTHETIC PASSPORT -- COMPLETE KYC TEST", heading_style),
    p(
        "<b>SYNTHETIC TEST DOCUMENT -- NOT A REAL IDENTIFICATION DOCUMENT</b>",
        warning_style,
    ),
    Spacer(1, 12),
    key_value_table([
        ("Document Type", "Synthetic Passport"),
        ("Document Number", "TEST-PASSPORT-000001"),
        ("Surname", "TESTER"),
        ("Given Names", "ALEXANDER SAMPLE"),
        ("Date of Birth", "14 February 1990"),
        ("Nationality", "SYNTHETIC"),
        ("Place of Birth", "Example City"),
        ("Issue Date", "10 January 2025"),
        ("Expiry Date", "10 January 2035"),
        ("Sex", "X"),
        ("Issuing Authority", "VERIFIN TEST AUTHORITY"),
    ]),
    *section("Machine-readable test information"),
    p(
        "This document intentionally contains fictional information "
        "designed for automated document-analysis testing. "
        "Every identifier in this document is synthetic."
    ),
    Spacer(1, 10),
    p(
        "<b>TEST EXPECTATION:</b> The KYC engine should recognize this as "
        "a complete synthetic identity document containing identity, "
        "date-of-birth, nationality, issue date, and expiry information."
    ),
]

build_pdf("01_Passport_Complete.pdf", story)


# ---------------------------------------------------------
# 02 Address Proof
# ---------------------------------------------------------

story = [
    p("VERIFIN", title_style),
    p("SYNTHETIC ADDRESS VERIFICATION DOCUMENT", heading_style),
    p(
        "<b>SYNTHETIC TEST DOCUMENT -- NOT A REAL IDENTIFICATION DOCUMENT</b>",
        warning_style,
    ),
    p(
        "(Specifically: not a real utility bill or address record of any real person.)",
        small_style,
    ),
    Spacer(1, 12),
    key_value_table([
        ("Customer", "ALEXANDER SAMPLE TESTER"),
        ("Document Number", "TEST-ADDRESS-000001"),
        ("Document Type", "Synthetic Utility Statement"),
        ("Statement Date", "01 March 2026"),
        ("Address", "100 Example Street"),
        ("City", "Test City"),
        ("Country", "Synthetic Country"),
        ("Provider", "Example Utilities -- TEST"),
        ("Account Reference", "TEST-UTILITY-839201"),
    ]),
    *section("Verification information"),
    p(
        "This synthetic document is designed to provide address evidence "
        "for KYC testing. It is intentionally fictional and has no real "
        "utility-provider relationship."
    ),
    Spacer(1, 10),
    p(
        "<b>TEST EXPECTATION:</b> The KYC system should identify this "
        "document as supporting residential/address verification."
    ),
]

build_pdf("02_Address_Proof.pdf", story)


# ---------------------------------------------------------
# 03 Bank Statement
# ---------------------------------------------------------

story = [
    p("VERIFIN", title_style),
    p("SYNTHETIC BANK STATEMENT -- KYC TEST", heading_style),
    p(
        "<b>SYNTHETIC TEST DOCUMENT -- NOT A REAL IDENTIFICATION DOCUMENT</b>",
        warning_style,
    ),
    p(
        "(Specifically: not a real bank statement or account record of any real person.)",
        small_style,
    ),
    Spacer(1, 12),
    key_value_table([
        ("Customer", "ALEXANDER SAMPLE TESTER"),
        ("Institution", "Example Bank -- TEST ONLY"),
        ("Account Number", "TEST-ACCOUNT-000001"),
        ("Statement Period", "01 February 2026 - 28 February 2026"),
        ("Currency", "USD"),
        ("Opening Balance", "$8,500.00"),
        ("Closing Balance", "$8,945.75"),
    ]),
    *section("Statement transactions"),
]

bank_header = ["Date", "Description", "Debit", "Credit", "Balance"]
bank_rows_raw = [
    ["02-Feb-2026", "Synthetic Payroll", "-", "$3,000.00", "$11,500.00"],
    ["04-Feb-2026", "Example Grocery", "$125.50", "-", "$11,374.50"],
    ["09-Feb-2026", "Example Utilities", "$89.75", "-", "$11,284.75"],
    ["14-Feb-2026", "Example Retail", "$240.00", "-", "$11,044.75"],
    ["21-Feb-2026", "Example Transfer", "$2,099.00", "-", "$8,945.75"],
]

bank_rows = [[Paragraph(h, cell_header_style) for h in bank_header]]
for row in bank_rows_raw:
    date, description, debit, credit, balance = row
    bank_rows.append([date, Paragraph(description, cell_style), debit, credit, balance])

# 26+58+28+28+30 = 170mm, within the ~174mm usable width
# (the original 28+68+30+30+35 = 191mm overran it by 17mm).
table = Table(
    bank_rows,
    repeatRows=1,
    colWidths=[26 * mm, 58 * mm, 28 * mm, 28 * mm, 30 * mm],
)

table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 8),
    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT]),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
]))

story += [
    table,
    Spacer(1, 10),
    p(
        "<b>TEST EXPECTATION:</b> Supporting financial evidence is present "
        "and internally consistent for synthetic KYC testing."
    ),
]

build_pdf("03_Bank_Statement.pdf", story)


# ---------------------------------------------------------
# 04 Missing Address
# ---------------------------------------------------------

story = [
    p("VERIFIN", title_style),
    p("SYNTHETIC INCOMPLETE KYC DOCUMENT", heading_style),
    p(
        "<b>SYNTHETIC TEST DOCUMENT -- NOT A REAL IDENTIFICATION DOCUMENT</b>",
        warning_style,
    ),
    Spacer(1, 12),
    key_value_table([
        ("Document Type", "Synthetic Identity Document"),
        ("Document Number", "TEST-INCOMPLETE-000001"),
        ("Name", "JORDAN TEST SUBJECT"),
        ("Date of Birth", "23 June 1988"),
        ("Nationality", "SYNTHETIC"),
        ("Issue Date", "05 January 2025"),
        ("Expiry Date", "05 January 2035"),
        ("Address", "NOT PROVIDED"),
    ]),
    *section("Intentional test condition"),
    p(
        "This document intentionally contains identity information but "
        "does not provide sufficient residential-address evidence."
    ),
    Spacer(1, 10),
    p(
        "<b>TEST EXPECTATION:</b> KYC analysis should identify that "
        "additional address verification is required."
    ),
]

build_pdf("04_KYC_Missing_Address.pdf", story)


# ---------------------------------------------------------
# Transaction data
# ---------------------------------------------------------

normal_transactions = [
    {"id": "N-001", "date": "2026-01-03", "amount": 125.50, "currency": "USD", "type": "PURCHASE", "counterparty": "Example Grocery", "country": "PK"},
    {"id": "N-002", "date": "2026-01-07", "amount": 89.75, "currency": "USD", "type": "PURCHASE", "counterparty": "Example Utilities", "country": "PK"},
    {"id": "N-003", "date": "2026-01-12", "amount": 240.00, "currency": "USD", "type": "PURCHASE", "counterparty": "Example Market", "country": "PK"},
    {"id": "N-004", "date": "2026-01-16", "amount": 65.25, "currency": "USD", "type": "PURCHASE", "counterparty": "Example Cafe", "country": "PK"},
    {"id": "N-005", "date": "2026-01-22", "amount": 175.00, "currency": "USD", "type": "PURCHASE", "counterparty": "Example Pharmacy", "country": "PK"},
    {"id": "N-006", "date": "2026-01-27", "amount": 310.00, "currency": "USD", "type": "PURCHASE", "counterparty": "Example Retail", "country": "PK"},
]

unusual_transactions = [
    {"id": "U-001", "date": "2026-02-01", "amount": 950.00, "currency": "USD", "type": "TRANSFER", "counterparty": "Example Counterparty A", "country": "PK"},
    {"id": "U-002", "date": "2026-02-01", "amount": 975.00, "currency": "USD", "type": "TRANSFER", "counterparty": "Example Counterparty B", "country": "PK"},
    {"id": "U-003", "date": "2026-02-01", "amount": 980.00, "currency": "USD", "type": "TRANSFER", "counterparty": "Example Counterparty C", "country": "PK"},
    {"id": "U-004", "date": "2026-02-02", "amount": 1500.00, "currency": "USD", "type": "TRANSFER", "counterparty": "Example Counterparty D", "country": "AE"},
    {"id": "U-005", "date": "2026-02-03", "amount": 1750.00, "currency": "USD", "type": "TRANSFER", "counterparty": "Example Counterparty E", "country": "AE"},
    {"id": "U-006", "date": "2026-02-04", "amount": 1900.00, "currency": "USD", "type": "TRANSFER", "counterparty": "Example Counterparty F", "country": "AE"},
]

high_risk_transactions = [
    {"id": "H-001", "date": "2026-03-01", "amount": 9500.00, "currency": "USD", "type": "TRANSFER", "counterparty": "Synthetic Offshore A", "country": "XX"},
    {"id": "H-002", "date": "2026-03-01", "amount": 9800.00, "currency": "USD", "type": "TRANSFER", "counterparty": "Synthetic Offshore B", "country": "XX"},
    {"id": "H-003", "date": "2026-03-02", "amount": 9700.00, "currency": "USD", "type": "TRANSFER", "counterparty": "Synthetic Offshore C", "country": "XX"},
    {"id": "H-004", "date": "2026-03-03", "amount": 9600.00, "currency": "USD", "type": "TRANSFER", "counterparty": "Synthetic Offshore D", "country": "XX"},
    {"id": "H-005", "date": "2026-03-04", "amount": 25000.00, "currency": "USD", "type": "WIRE", "counterparty": "Synthetic Offshore E", "country": "XX"},
    {"id": "H-006", "date": "2026-03-05", "amount": 24000.00, "currency": "USD", "type": "WIRE", "counterparty": "Synthetic Offshore F", "country": "XX"},
    {"id": "H-007", "date": "2026-03-05", "amount": 23500.00, "currency": "USD", "type": "WIRE", "counterparty": "Synthetic Offshore G", "country": "XX"},
]


# ---------------------------------------------------------
# Transaction PDFs
# ---------------------------------------------------------

def make_transaction_pdf(
    filename,
    title,
    customer,
    description,
    rows,
    expectation,
):
    story = transaction_header(
        title,
        customer,
        description,
    )

    story += [
        transaction_table(rows),
        Spacer(1, 12),
        p(f"<b>TEST EXPECTATION:</b> {expectation}"),
    ]

    build_pdf(filename, story)


make_transaction_pdf(
    "05_Normal_Transactions.pdf",
    "NORMAL TRANSACTION HISTORY",
    "ALEXANDER SAMPLE TESTER",
    "Baseline low-risk synthetic transaction activity.",
    normal_transactions,
    "The AML engine should generally identify ordinary/low-risk transaction behavior "
    "(a risk indicator, not proof of any conclusion).",
)


make_transaction_pdf(
    "06_Unusual_Transactions.pdf",
    "UNUSUAL TRANSACTION HISTORY",
    "ALEXANDER SAMPLE TESTER",
    "Synthetic transaction activity containing velocity and geographic anomalies.",
    unusual_transactions,
    "The AML engine should identify unusual velocity, repeated transfers, and "
    "geographic changes as potential anomalies and consider the case for "
    "additional review -- not as confirmed wrongdoing.",
)


make_transaction_pdf(
    "07_High_Risk_Transactions.pdf",
    "HIGH-RISK TRANSACTION HISTORY",
    "ALEXANDER SAMPLE TESTER",
    "Synthetic transaction activity intentionally designed to trigger stronger AML scrutiny.",
    high_risk_transactions,
    "The AML engine should identify significant anomalous patterns and recommend "
    "heightened review/escalation, described as risk indicators rather than a "
    "determination of criminal conduct.",
)


# ---------------------------------------------------------
# Multi-file transaction PDFs
# ---------------------------------------------------------

jan = [
    {"id": "M-JAN-001", "date": "2026-01-04", "amount": 120.00, "currency": "USD", "type": "PURCHASE", "counterparty": "Example Store", "country": "PK"},
    {"id": "M-JAN-002", "date": "2026-01-10", "amount": 215.00, "currency": "USD", "type": "PURCHASE", "counterparty": "Example Market", "country": "PK"},
    {"id": "M-JAN-003", "date": "2026-01-18", "amount": 350.00, "currency": "USD", "type": "TRANSFER", "counterparty": "Example Person A", "country": "PK"},
]

feb = [
    {"id": "M-FEB-001", "date": "2026-02-03", "amount": 500.00, "currency": "USD", "type": "PURCHASE", "counterparty": "Example Store", "country": "PK"},
    {"id": "M-FEB-002", "date": "2026-02-11", "amount": 750.00, "currency": "USD", "type": "TRANSFER", "counterparty": "Example Person B", "country": "PK"},
    {"id": "M-FEB-003", "date": "2026-02-25", "amount": 1200.00, "currency": "USD", "type": "TRANSFER", "counterparty": "Example Person C", "country": "AE"},
]

mar = [
    {"id": "M-MAR-001", "date": "2026-03-02", "amount": 950.00, "currency": "USD", "type": "TRANSFER", "counterparty": "Example Person D", "country": "AE"},
    {"id": "M-MAR-002", "date": "2026-03-05", "amount": 1100.00, "currency": "USD", "type": "TRANSFER", "counterparty": "Example Person E", "country": "AE"},
    {"id": "M-MAR-003", "date": "2026-03-09", "amount": 1250.00, "currency": "USD", "type": "TRANSFER", "counterparty": "Example Person F", "country": "AE"},
]


make_transaction_pdf(
    "08_Multi_File_January.pdf",
    "MULTI-FILE TRANSACTION TEST -- JANUARY",
    "MULTI-FILE TEST CUSTOMER",
    "Part 1 of 3 in one synthetic transaction evidence set (see 09 and 10).",
    jan,
    "Verifin should include this file in the complete transaction evidence set.",
)

make_transaction_pdf(
    "09_Multi_File_February.pdf",
    "MULTI-FILE TRANSACTION TEST -- FEBRUARY",
    "MULTI-FILE TEST CUSTOMER",
    "Part 2 of 3 in one synthetic transaction evidence set (see 08 and 10).",
    feb,
    "Verifin should include this file in the complete transaction evidence set.",
)

make_transaction_pdf(
    "10_Multi_File_March.pdf",
    "MULTI-FILE TRANSACTION TEST -- MARCH",
    "MULTI-FILE TEST CUSTOMER",
    "Part 3 of 3 in one synthetic transaction evidence set (see 08 and 09).",
    mar,
    "Verifin should include this file in the complete transaction evidence set.",
)


# ---------------------------------------------------------
# 11 Malformed transaction PDF
# ---------------------------------------------------------

story = [
    p("VERIFIN", title_style),
    p("MALFORMED TRANSACTION LOG -- ERROR TEST", heading_style),
    p(
        "<b>SYNTHETIC TEST DATA -- NOT REAL FINANCIAL INFORMATION</b>",
        warning_style,
    ),
    p(
        "This file is additionally, and intentionally, INVALID -- see below.",
        small_style,
    ),
    Spacer(1, 12),
    p(
        "This document intentionally contains malformed transaction "
        "information and should be used to test validation and error "
        "handling rather than successful AML analysis."
    ),
    Spacer(1, 12),
]

malformed_header = ["Transaction ID", "Date", "Amount", "Currency", "Type"]
malformed_rows_raw = [
    ["BAD-001", "NOT-A-DATE", "ONE THOUSAND", "???", "UNKNOWN"],
    ["BAD-002", "", "-999999999999", "", ""],
    ["BAD-003", "2026-99-99", "ABC", "USD", "TRANSFER"],
    ["BAD-004", "INVALID", "", "INVALID", "INVALID"],
]

malformed_cell_style = ParagraphStyle(
    "VerifinMalformedCell", parent=cell_style, fontSize=7.5, leading=9
)
malformed_header_style = ParagraphStyle(
    "VerifinMalformedHeader", parent=malformed_cell_style, textColor=WHITE, fontName="Helvetica-Bold"
)

malformed_rows = [[Paragraph(h, malformed_header_style) for h in malformed_header]]
for row in malformed_rows_raw:
    malformed_rows.append([Paragraph(cell if cell else "(blank)", malformed_cell_style) for cell in row])

# 32+32+38+32+32 = 166mm, within the ~174mm usable width
# (the original 35+35+40+35+35 = 180mm overran it by 6mm).
table = Table(
    malformed_rows,
    colWidths=[
        32 * mm,
        32 * mm,
        38 * mm,
        32 * mm,
        32 * mm,
    ],
)

table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), RED),
    ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 8),
    ("GRID", (0, 0), (-1, -1), 0.4, RED),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
]))

story += [
    table,
    Spacer(1, 12),
    p(
        "<b>TEST EXPECTATION:</b> Verifin should detect invalid or "
        "unusable transaction data and provide a clear validation/error "
        "state rather than producing a confident AML conclusion."
    ),
]

build_pdf("11_Malformed_Transactions.pdf", story)


# ---------------------------------------------------------
# 00 Test Manifest
# ---------------------------------------------------------

story = [
    p("VERIFIN", title_style),
    p("SYNTHETIC TEST SUITE MANIFEST", heading_style),
    p(
        "<b>ALL DATA IN THIS TEST SUITE IS FICTIONAL AND SYNTHETIC.</b>",
        warning_style,
    ),
    Spacer(1, 12),
    p(
        "This test suite is designed to verify the Verifin KYC/AML "
        "workflow, document extraction, transaction analysis, "
        "multi-file evidence handling, persistence, AI orchestration, "
        "and error recovery."
    ),
    *section("Test scenarios"),
]

manifest_header = ["File", "Purpose", "Expected"]
manifest_rows_raw = [
    ["01_Passport_Complete.pdf", "Complete identity evidence", "KYC evidence present"],
    ["02_Address_Proof.pdf", "Address verification", "Address evidence present"],
    ["03_Bank_Statement.pdf", "Financial supporting evidence", "Supporting evidence"],
    ["04_KYC_Missing_Address.pdf", "Incomplete KYC", "Additional evidence required"],
    ["05_Normal_Transactions.pdf", "Baseline AML", "Generally low risk"],
    ["06_Unusual_Transactions.pdf", "Anomalous behavior", "Review / medium-risk indicators"],
    ["07_High_Risk_Transactions.pdf", "Strong anomalies", "High-risk indicators / escalation"],
    ["08_Multi_File_January.pdf", "Multi-file test", "Evidence included"],
    ["09_Multi_File_February.pdf", "Multi-file test", "Evidence included"],
    ["10_Multi_File_March.pdf", "Multi-file test", "Evidence included"],
    ["11_Malformed_Transactions.pdf", "Error handling", "Validation failure"],
]

manifest_header_style = ParagraphStyle(
    "VerifinManifestHeader", parent=manifest_cell_style, textColor=WHITE, fontName="Helvetica-Bold"
)
manifest = [[Paragraph(h, manifest_header_style) for h in manifest_header]]
for row in manifest_rows_raw:
    manifest.append([Paragraph(cell, manifest_cell_style) for cell in row])

# 55+70+45 = 170mm, within the ~174mm usable width
# (the original 65+65+55 = 185mm overran it by 11mm).
manifest_table = Table(
    manifest,
    repeatRows=1,
    colWidths=[55 * mm, 70 * mm, 45 * mm],
)

manifest_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 7),
    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT]),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))

story += [
    manifest_table,
    PageBreak(),
    p("Recommended end-to-end test", heading_style),
    p("Use the following sequence to test Verifin:"),
    Spacer(1, 8),
    p("1. Create a new customer application for ALEXANDER SAMPLE TESTER."),
    p("2. Upload 01_Passport_Complete.pdf."),
    p("3. Upload 02_Address_Proof.pdf."),
    p("4. Upload 03_Bank_Statement.pdf."),
    p("5. Upload 05_Normal_Transactions.pdf."),
    p("6. Run the complete KYC -> AML -> Compliance workflow."),
    p("7. Verify that the application reaches the expected review state."),
    p("8. Refresh the browser and verify that all data remains."),
    p("9. Restart the server and verify that the application remains."),
    p("10. Repeat using 06_Unusual_Transactions.pdf."),
    p("11. Repeat using 07_High_Risk_Transactions.pdf."),
    p("12. Run the multi-file test with 08, 09 and 10."),
    p("13. Verify that all three transaction documents contribute to the AML evidence set."),
    p("14. Test 04_KYC_Missing_Address.pdf and verify incomplete KYC."),
    p("15. Test 11_Malformed_Transactions.pdf and verify graceful validation/error handling."),
]

build_pdf("00_TEST_MANIFEST.pdf", story)


# ---------------------------------------------------------
# 12 Expected Results
# ---------------------------------------------------------

story = [
    p("VERIFIN", title_style),
    p("EXPECTED TEST RESULTS", heading_style),
    p(
        "<b>REFERENCE ONLY -- AI RESULTS MAY VARY</b>",
        warning_style,
    ),
    Spacer(1, 12),
    p(
        "These are expected behavioral outcomes, not hard-coded AI answers. "
        "A production AI model may describe the same risk differently. "
        "The important requirement is that the system identifies the "
        "relevant evidence and produces a reasonable, explainable result."
    ),
    *section("Scenario 1 -- Complete KYC + Normal Transactions"),
    p(
        "<b>Expected:</b> KYC should generally be considered complete. "
        "Normal transaction activity should generally produce low-risk indicators."
    ),
    *section("Scenario 2 -- Incomplete KYC"),
    p(
        "<b>Expected:</b> The system should identify missing address "
        "verification rather than incorrectly declaring KYC complete."
    ),
    *section("Scenario 3 -- Unusual Transactions"),
    p(
        "<b>Expected:</b> The system should identify transaction velocity, "
        "repeated transfers, and unusual geographic behavior as potential "
        "risk indicators requiring review."
    ),
    *section("Scenario 4 -- High-Risk Transactions"),
    p(
        "<b>Expected:</b> The system should identify the unusually large "
        "and repeated transfer activity and recommend heightened review "
        "or escalation."
    ),
    *section("Scenario 5 -- Multiple Transaction Documents"),
    p(
        "<b>Expected:</b> All three transaction PDFs should be available "
        "to the evidence/AML pipeline. The system must not silently use "
        "only the first uploaded file."
    ),
    *section("Scenario 6 -- Malformed Transaction Data"),
    p(
        "<b>Expected:</b> The system should reject or flag the malformed "
        "data and should not generate an unjustifiably confident risk "
        "conclusion from invalid input."
    ),
    *section("Important"),
    p(
        "These documents are synthetic software-testing artifacts. "
        "They are not genuine passports, bank statements, utility bills, "
        "financial records, or identification documents. Any risk "
        "language used by Verifin when analyzing them should be framed "
        "as risk indicators, potential anomalies, or review "
        "recommendations -- not as findings of actual criminal conduct."
    ),
]

build_pdf("12_Expected_Test_Results.pdf", story)


# ---------------------------------------------------------
# Verification
# ---------------------------------------------------------

EXPECTED_FILES = [
    "00_TEST_MANIFEST.pdf",
    "01_Passport_Complete.pdf",
    "02_Address_Proof.pdf",
    "03_Bank_Statement.pdf",
    "04_KYC_Missing_Address.pdf",
    "05_Normal_Transactions.pdf",
    "06_Unusual_Transactions.pdf",
    "07_High_Risk_Transactions.pdf",
    "08_Multi_File_January.pdf",
    "09_Multi_File_February.pdf",
    "10_Multi_File_March.pdf",
    "11_Malformed_Transactions.pdf",
    "12_Expected_Test_Results.pdf",
]

# Every KYC/identity document must carry the identity-document warning;
# every financial document must carry the financial-data warning. Checked
# below (with the em/en dashes normalized to "--", see NOTE) so a future
# edit that accidentally drops one of these required warnings fails loudly
# instead of silently shipping a bad PDF.
IDENTITY_DOCS = {
    "01_Passport_Complete.pdf",
    "02_Address_Proof.pdf",
    "03_Bank_Statement.pdf",
    "04_KYC_Missing_Address.pdf",
}
FINANCIAL_DOCS = {
    "05_Normal_Transactions.pdf",
    "06_Unusual_Transactions.pdf",
    "07_High_Risk_Transactions.pdf",
    "08_Multi_File_January.pdf",
    "09_Multi_File_February.pdf",
    "10_Multi_File_March.pdf",
    "11_Malformed_Transactions.pdf",
}

missing = [
    filename
    for filename in EXPECTED_FILES
    if not (OUTPUT / filename).exists()
]

if missing:
    raise RuntimeError(
        f"PDF generation failed. Missing files: {missing}"
    )

# Best-effort content validation: confirm each PDF is a non-empty, readable
# PDF and carries the branding/warning markers it's supposed to. This uses
# pypdf if it's installed; if not, generation still succeeds (pypdf is a
# validation convenience, not a hard dependency of PDF generation itself).
try:
    from pypdf import PdfReader

    HAVE_PYPDF = True
except Exception:  # noqa: BLE001 - any import-time failure just disables validation
    HAVE_PYPDF = False

content_errors = []
if HAVE_PYPDF:
    for filename in EXPECTED_FILES:
        path = OUTPUT / filename
        try:
            reader = PdfReader(str(path))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as exc:  # noqa: BLE001 - report, don't crash the run
            content_errors.append(f"{filename}: could not be read/parsed ({exc})")
            continue

        if "VERIFIN" not in text:
            content_errors.append(f"{filename}: missing 'VERIFIN' branding marker")

        if filename in IDENTITY_DOCS and "NOT A REAL IDENTIFICATION DOCUMENT" not in text:
            content_errors.append(
                f"{filename}: missing required identity-document warning"
            )
        if filename in FINANCIAL_DOCS and "NOT REAL FINANCIAL INFORMATION" not in text:
            content_errors.append(
                f"{filename}: missing required financial-data warning"
            )

if content_errors:
    raise RuntimeError(
        "PDF content validation failed:\n" + "\n".join(f"  - {e}" for e in content_errors)
    )

print()
print("=" * 60)
print("VERIFIN TEST PDF GENERATION COMPLETE")
print("=" * 60)
print(f"Output directory: {OUTPUT.resolve()}")
print(f"Generated PDFs: {len(EXPECTED_FILES)}")
print(f"Content validation: {'passed (pypdf)' if HAVE_PYPDF else 'skipped (pypdf not installed)'}")
print()

for filename in EXPECTED_FILES:
    path = OUTPUT / filename
    print(f"[OK] {filename} ({path.stat().st_size:,} bytes)")

print()
print("All expected PDF files were generated successfully.")
