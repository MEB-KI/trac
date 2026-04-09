# TRAC -- Time-Use Research Activity Collector


[![Backend Unit Tests](https://github.com/dfsp-spirit/trac/actions/workflows/backend_unit_tests.yml/badge.svg)](https://github.com/dfsp-spirit/trac/actions/workflows/backend_unit_tests.yml)
[![Backend Integration Tests](https://github.com/dfsp-spirit/trac/actions/workflows/backend_integration_tests.yml/badge.svg)](https://github.com/dfsp-spirit/trac/actions/workflows/backend_integration_tests.yml)
[![E2E Tests](https://github.com/dfsp-spirit/trac/actions/workflows/e2e_tests.yml/badge.svg)](https://github.com/dfsp-spirit/trac/actions/workflows/e2e_tests.yml)


TRAC is a web-based research software for time-use research: users can report what they did during one or more days by selecting activities and placing them on one or more timelines per day. E.g., depending on the study, there may be one timeline for 'Primary Activity', and another one for 'Secondary Activity', allowing users to report things like listening to music while riding on the subway.

The frontend is based on [github.com/andreifoldes/o-timeusediary by Andrei Tamas Foldes et al.](https://github.com/andreifoldes/o-timeusediary) but heavily adapted, and the backend was written from scratch.

When using the software in this repo, please also cite [Andrei Tamas Foldes' paper](https://doi.org/10.32797/jtur-2020-1) `Time use diary design for our times - an overview, presenting a Click-and-Drag Diary Instrument (CaDDI) for online application`.


## Developer Documentation

### Development Setup

Make sure you have `git`, `uv` and `nginx`. Python comes with every Linux distribution, so you should not need to install it. This will get you everything you need under Ubuntu 24 LTS:

```bash
sudo apt install nginx git
curl -LsSf https://astral.sh/uv/install.sh | sh  # get uv for your user
```

Clone repo and change into it:

```bash
git clone https://github.com/dfsp-spirit/trac
cd trac/
```

There is no need to do anything for the frontend, it is ready to run. So let's install the backend dependencies first and verify by running tests:

```bash
cd backend/

# Create virtual environment and install dependencies
uv sync --dev

# Run backend unit tests to verify setup
uv run pytest
```

Great, now it is time to run everything:

```bash
cd ..     # back to repo root (`trac` directory)
./run_dev_nginx_both.bash
```

You can now connect to [http://localhost:3000](http://localhost:3000) to access nginx. The default nginx page will show info on how to access the frontend, admin interface, and API.



### Howto make a release

* record changes in `CHANGES` file
* bump version of backend in `backend/src/o-timeusediary_backend/__init__.py`
* bump version of frontend in `frontend/src/js/constants.js`
* create commit with the mentioned changes, with a commit message like 'Bump version to and log changes for v0.x.y'
* tag the commit with the new version_ `git tag v0.x.y <hash>`
* run `git push --tags` to publish
* in the `backend/` dir, run `uv build` to create the wheel artefact
* log into Github account, draft a new release based on the tag, copy change notes from CHANGES in there and attach the wheel artefact



