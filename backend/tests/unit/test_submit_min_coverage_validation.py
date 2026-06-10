from o_timeusediary_backend.api import (
    ActivitySubmitItem,
    _validate_timeline_min_coverage,
)


def test_validate_timeline_min_coverage_passes_when_requirements_are_met():
    submitted_activities = [
        ActivitySubmitItem(
            timeline_key="primary",
            activity="Sleep",
            category="Main",
            code=100,
            start_minutes=240,
            end_minutes=360,
            mode="single-choice",
        ),
        ActivitySubmitItem(
            timeline_key="secondary",
            activity="Device",
            category="Media",
            codes=[200, 201],
            start_minutes=360,
            end_minutes=390,
            mode="multiple-choice",
        ),
    ]

    insufficient = _validate_timeline_min_coverage(
        submitted_activities=submitted_activities,
        required_min_coverage_by_timeline={
            "primary": 120,
            "secondary": 30,
        },
    )

    assert insufficient == []


def test_validate_timeline_min_coverage_reports_missing_timelines_and_minutes():
    submitted_activities = [
        ActivitySubmitItem(
            timeline_key="primary",
            activity="Sleep",
            category="Main",
            code=100,
            start_minutes=240,
            end_minutes=300,
            mode="single-choice",
        ),
    ]

    insufficient = _validate_timeline_min_coverage(
        submitted_activities=submitted_activities,
        required_min_coverage_by_timeline={
            "primary": 90,
            "secondary": 30,
        },
    )

    assert len(insufficient) == 2
    assert insufficient[0] == {
        "timeline": "primary",
        "covered_minutes": 60,
        "required_min_coverage": 90,
        "missing_minutes": 30,
    }
    assert insufficient[1] == {
        "timeline": "secondary",
        "covered_minutes": 0,
        "required_min_coverage": 30,
        "missing_minutes": 30,
    }


def test_validate_timeline_min_coverage_ignores_optional_timelines():
    submitted_activities = []

    insufficient = _validate_timeline_min_coverage(
        submitted_activities=submitted_activities,
        required_min_coverage_by_timeline={
            "primary": 0,
            "secondary": 0,
        },
    )

    assert insufficient == []
