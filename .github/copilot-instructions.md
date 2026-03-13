This is the Python/FastApi backend of the Time Use Diary (TUD) research app for the collection of time use data from participants in online studies.

The app is implemented as a Python package that can be found in directly in this repo (see pyproject.toml file). The main backend code is in the `src/o-timeusediary-backend` directory. The backend is built with FastAPI, and it uses SQLAlchemy and SQLModels for database access to a PostgreSQL dataase. There are scripts to create the database in the database/ directory. The backend serves a REST API that the frontend can use to get and save data. The backend does not serve the frontend files in production, they are served via nginx. The only thing the backend serves in production is the REST API and the admin interface, which is implemented using FastAPI templates. Access to the backend is via an nginx reverse proxy, which also serves the frontend files. The backend is designed to be run in a WSGI server, e.g., Gunicorn.

A pure JavaScript frontend for this app can be found at https://github.com/dfsp-spirit/o-timeusediary.

Users of the frontend see an instructions page followed by the data collection page. On the data collection page, users can select the activities at the bottom, and they see one or more timelines at the top, e.g., a 'primary activity' timeline and a 'secondary activity' timeline. Users place activities on timelines to indicate what they have been doing during the day. They click on an activity to select it, and then click on the timeline to place the activity on the timeline. The activity can be moved and resized on the timeline. The timeline is divided into 10-minute intervals and covers one entire day.

The app can support several studies, defined in file `src/settings/studies_config.json`. Each study can be open to everyone (e.g., for sending invitation to a mailing list), or only to listed participants who need to know their ID or invitation link including this ID. For each study, a separate list of activites is available in an activities JSON file, the exact file is defined for each study in the `studies_config.json` file.

In production, the frontend will receive the list of studies and the activities for each study from the backend.

A study may cover more than a single day, e.g., a full week. When the user has filled out all timelines of one day, they can click a button to go to the next day. The app will save the data to the backend after each day.

Note that users do not explicitly login: they get an invitation link that includes a long ID (random string) that identifies them, and they can use this link to access the app and fill out their data. The backend identifies users based on this ID, and it does not require any other login information. This is to make it as easy as possible for users to access the app and fill out their data, without having to create an account or remember a password. If a user arrives at the frontend without a valid ID, they will be assigned a random ID, which is fine and valid for an open study, but they will not be able to access the app if the study is closed (i.e., only open to listed participants).

Scientists can provide a studies_config.json file and the respective activities_<study_name>.json files to define a study. When the backend is started in scans the studies_config.json file and loads the studies and activities into the database, if no study with that name exists yet. Scientists can also use the admin interface to change some properties of a study, like add a new user. They can of course not make changes that would require adapting the database schema in the admin interface.

In production, the frontend and backend may be run on different servers and at a nested path on a domain, so we need to make sure that the backend can be configured to support this, via the FastAPI root_path setting.

Note that the backend will run on a public server on the internet, so security is very important. The backend should be designed with security in mind, e.g., by validating all input data, using secure headers, and following best practices for web application security.
