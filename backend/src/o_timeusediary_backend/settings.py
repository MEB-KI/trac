import os
from dotenv import load_dotenv
import json

load_dotenv()   # load .env file in working directory if it exists



class TUDBackendSettings:
    def __init__(self):
        # Backend-specific settings
        self.debug = True if os.getenv("TUD_DEBUG", "false").lower() == "true" else False
        self.studies_config_path: str = os.getenv("TUD_STUDIES_CONFIG_PATH", "studies_config.json") # Backend file with studies configuration
        self.print_db_contents_on_startup = True if os.getenv("TUD_REPORT_DB_CONTENTS_ON_STARTUP", "false").lower() == "true" else False

    # Environment-dependent settings as properties
    @property
    def database_url(self):
        """Get the database URL for the application, something like 'postgresql://user:password@localhost/dbname'."""
        db_url = os.getenv("TUD_DATABASE_URL")
        if not db_url:
            raise ValueError("TUD_DATABASE_URL environment variable is not set. Please set it when starting the application or use an .env file in the startup directory.")
        return db_url

    @property
    def allowed_origins(self):
        """Get the list of allowed origins for CORS. Should be set to a JSON array like '["http://localhost:3000", "https://example.com"]'.

        Raises:
            ValueError: If the TUD_ALLOWED_ORIGINS environment variable is not set or is empty.

        Returns:
            list: A list of allowed origins.
        """
        origins = json.loads(os.getenv("TUD_ALLOWED_ORIGINS", "[]"))
        if not origins:
            raise ValueError("TUD_ALLOWED_ORIGINS environment variable is not set. Please set a JSON array of allowed origins.")
        return origins

    @property
    def rootpath(self):
        """Get the root path for the application, i.e., the path part of the URL where the application is hosted.
           Defaults to '/' if not set. If you have configured your webserver to server the backend
           at http://yourdomain.com/tud_backend, you would set this to '/tud_backend'.

        Returns:
            str: The root path of the application.
        """
        return os.getenv("TUD_ROOTPATH", "/")

    @property
    def admin_username(self):
        """Get the admin username for the API endpoints requiring admin rights and the admin pages (which use these endpoints)."""
        username = os.getenv("TUD_API_ADMIN_USERNAME")
        if not username:
            raise ValueError("TUD_API_ADMIN_USERNAME environment variable is not set.")
        return username

    @property
    def admin_password(self):
        """Get the admin password for the API endpoints requiring admin rights and the admin pages (which use these endpoints)."""
        password = os.getenv("TUD_API_ADMIN_PASSWORD")
        if not password:
            raise ValueError("TUD_API_ADMIN_PASSWORD environment variable is not set.")
        return password


settings = TUDBackendSettings()

