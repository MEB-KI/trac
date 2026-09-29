"""Source guards for HTML built in the backend.

The unit suite runs without services, so these tests grep the shipped sources
for the shapes that break HTML escaping globally:

* HTML assembled directly in a Python f-string (no escaping at all),
* ``|safe`` (or ``Markup()``) in an admin template, which turns Jinja
  autoescaping off for a single value.

``tests/integration/test_admin_html_escaping.py`` covers the behaviour against a
running server; this file makes the *class* of mistake fail fast, before it
reaches participants or administrators.
"""

import re
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
SRC = BACKEND_ROOT / "src" / "o_timeusediary_backend"
TEMPLATES = SRC / "templates"

# Direct, single-line HTML built from an f-string: the shape of the reflected
# XSS in the admin "study not found" page. Multi-line content is accepted when
# the values are escaped explicitly (see admin_study_detail) - the integration
# test covers that behaviour.
FSTRING_CONTENT = re.compile(r"HTMLResponse\(\s*content\s*=\s*f[\"']")

# `|tojson` is deliberately not listed: Jinja escapes <, >, & and ' in its output
# precisely so that it stays safe inside HTML/JS (the admin templates use it for
# chart data and JS constants).
TEMPLATE_ESCAPE_HATCHES = (r"\|\s*safe\b", r"Markup\(")


def _python_sources() -> list[Path]:
    return sorted(p for p in SRC.rglob("*.py") if "__pycache__" not in p.parts)


def test_no_fstring_html_response_content():
    """HTMLResponse(...) must not take an f-string as its content.

    Render a Jinja template (which autoescapes) or escape the values explicitly,
    like the admin 404 page does with ``html.escape``.
    """
    offenders = []
    for path in _python_sources():
        source = path.read_text(encoding="utf-8")
        for match in FSTRING_CONTENT.finditer(source):
            line = source[: match.start()].count("\n") + 1
            offenders.append(f"{path.name}:{line}")

    assert offenders == [], (
        "HTML built with an f-string in HTMLResponse() cannot escape user input; "
        "use a template or escape the values: " + ", ".join(offenders)
    )


def test_admin_templates_do_not_disable_autoescaping():
    """``|safe`` in an admin template would re-introduce stored XSS.

    If a template ever really has to render trusted HTML, add the value to an
    explicit allowlist here and escape it in Python.
    """
    offenders = []
    for template in sorted(TEMPLATES.glob("*.html")):
        source = template.read_text(encoding="utf-8")
        for pattern in TEMPLATE_ESCAPE_HATCHES:
            if re.search(pattern, source):
                offenders.append(f"{template.name}: {pattern}")

    assert offenders == [], (
        "admin templates must rely on Jinja autoescaping: " + ", ".join(offenders)
    )
