from datetime import datetime, timezone

from lib.engine import classify_reply, reply_suppression_operation


def test_out_of_office_reply_is_classified_but_still_suppressed():
    assert classify_reply("Automatic reply", "I am out of office until Monday") == "out_of_office"
    query, update = reply_suppression_operation("user-1", "Person@Example.com", datetime.now(timezone.utc))
    assert query == {
        "user_id": "user-1",
        "email": "person@example.com",
        "status": {"$nin": ["bounced", "unsubscribed"]},
    }
    assert update["$set"]["status"] == "replied"
    assert update["$set"]["next_send_at"] is None


def test_all_classified_reply_types_use_the_same_suppression_rule():
    samples = [
        ("Re: interested", "This sounds interesting"),
        ("Re: no thanks", "Please remove me"),
        ("Re: wrong person", "I'm not the right person"),
        ("Re: meeting", "Let's meet next Tuesday at 10"),
        ("Re: quick question", "Thanks for reaching out"),
    ]
    for subject, body in samples:
        # Even replies that cannot be classified must use the same suppression operation.
        classify_reply(subject, body)
        query, update = reply_suppression_operation("user-1", "person@example.com", datetime.now(timezone.utc))
        assert query["email"] == "person@example.com"
        assert update["$set"]["status"] == "replied"
