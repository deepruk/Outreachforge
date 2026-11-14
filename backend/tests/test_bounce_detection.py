"""Regression tests for human-readable and standard delivery-failure notices."""

from lib.engine import BOUNCE_NARRATIVE_RE, DSN_RECIPIENT_RE


def test_gmail_blocked_delivery_extracts_recipient():
    body = (
        "Message blocked\n"
        "Your message to stephen.mccranor@frame.agency has been blocked.\n"
        "554 5.7.1 Service unavailable; Sender address blocked."
    )
    assert BOUNCE_NARRATIVE_RE.findall(body) == ["stephen.mccranor@frame.agency"]


def test_standard_dsn_extracts_final_recipient():
    body = "Final-Recipient: rfc822; stephen.mccranor@frame.agency\nAction: failed"
    assert DSN_RECIPIENT_RE.findall(body) == ["stephen.mccranor@frame.agency"]


def test_narrative_parser_handles_angle_brackets_and_case():
    body = "Your message to <Stephen.McCranor@Frame.Agency> could not be delivered."
    assert BOUNCE_NARRATIVE_RE.findall(body) == ["Stephen.McCranor@Frame.Agency"]


def test_gmail_address_not_found_bounce_extracts_recipient():
    body = (
        "Address not found\\n"
        "Your message wasn't delivered to rebecca@paredes-marketing.com "
        "because the address couldn't be found or is unable to receive email."
    )
    assert BOUNCE_NARRATIVE_RE.findall(body) == ["rebecca@paredes-marketing.com"]


def test_gmail_address_not_found_bounce_extracts_recipient():
    body = (
        "Address not found\\n"
        "Your message wasn't delivered to rebecca@paredes-marketing.com "
        "because the address couldn't be found or is unable to receive email."
    )
    assert BOUNCE_NARRATIVE_RE.findall(body) == ["rebecca@paredes-marketing.com"]


def test_extended_dsn_recipient_headers_are_detected():
    body = "Original-Rcpt-To: rfc822; failed@example.com\\nAction: failed"
    assert DSN_RECIPIENT_RE.findall(body) == ["failed@example.com"]
