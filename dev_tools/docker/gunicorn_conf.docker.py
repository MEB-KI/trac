import multiprocessing

workers = max(1, min(multiprocessing.cpu_count() * 2 - 1, 8))
worker_class = "uvicorn.workers.UvicornWorker"

bind = "0.0.0.0:8000"

timeout = 120
keepalive = 5

accesslog = "-"
errorlog = "-"
loglevel = "info"

proc_name = "tud_backend_docker_dev"
