from lib.engine import prioritize_due_leads


def make_leads(new_count: int, followup_count: int):
    return (
        [{"id": f"n{i}", "current_step": 0} for i in range(new_count)]
        + [{"id": f"f{i}", "current_step": 1} for i in range(followup_count)]
    )


def test_zero_priority_sends_new_leads_first():
    leads = make_leads(3, 2)
    ordered = prioritize_due_leads(leads, 0)
    assert [lead["id"] for lead in ordered] == ["n0", "n1", "n2", "f0", "f1"]


def test_full_priority_sends_followups_first():
    leads = make_leads(3, 2)
    ordered = prioritize_due_leads(leads, 100)
    assert [lead["id"] for lead in ordered] == ["f0", "f1", "n0", "n1", "n2"]


def test_balanced_priority_interleaves_groups_and_preserves_fifo():
    leads = make_leads(4, 4)
    ordered = prioritize_due_leads(leads, 50)
    ids = [lead["id"] for lead in ordered]
    assert ids == ["n0", "f0", "n1", "f1", "n2", "f2", "n3", "f3"]


def test_weighted_priority_uses_configured_share():
    leads = make_leads(4, 4)
    ordered = prioritize_due_leads(leads, 75)
    assert sum((lead.get("current_step") or 0) > 0 for lead in ordered[:4]) == 3


def test_priority_clamps_out_of_range_values():
    leads = make_leads(2, 2)
    assert prioritize_due_leads(leads, -10) == prioritize_due_leads(leads, 0)
    assert prioritize_due_leads(leads, 110) == prioritize_due_leads(leads, 100)
