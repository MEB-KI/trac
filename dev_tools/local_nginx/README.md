## dev_tools/local_nginx -- Configuration and helpers to run in nginx

The files in this directory allwo you to run this app locally in nginx. This setup uses:

* a reverse proxy to access the backend
* runs the frontend at http://localhost:3000/report/
* runs the backend at http://localhost:3000/tud_backend/ (via nginx proxy)
* runs the internal uvicorn server at http://localhost:8000, but you should not use this and access the backend via the proxy


This setup is a lot closer to what you will get in production than the minimal dev setup, so it is easier to find path issues early.
It is a bit more complex to setup though, as it requires a locally running nginx.


### Large Request Body Handling

TRAC supports importing study configurations with embedded activity definitions, which can result in HTTP POST request bodies of 10-50 KB or larger. By default, nginx buffers large request bodies to disk. The `dev.nginx.conf.template` in this directory includes the configuration directive `client_body_temp_path` to direct nginx to use a user-writable directory for temporary buffering.

When running the development setup locally as your user (not as root), nginx needs write permissions to the temporary directory. The startup script `./run_dev_nginx_both.bash` automatically creates this directory before starting nginx.

If you get HTTP 500 errors when importing large study configurations, check the nginx error log for "Permission denied" messages related to the temporary path. This typically means the temporary directory is not writable by your user. The automatic setup should handle this, but if you need to troubleshoot:

1. Verify the `client_body_temp_path` directory in your nginx config and ensure it exists
2. Ensure your user has write permissions on that directory: `ls -ld /path/to/temp/dir`
3. If needed, create it manually: `mkdir -p ~/nginx-client-body-temp` and ensure it's readable/writable


### Usage

```sh
# start script that copies proper cfg files in place and then runs nginx and uvicorn
./run_dev_nginx_both.bash
```


