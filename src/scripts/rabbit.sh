#!/bin/bash

start_or_run () {
    docker inspect zapier_rabbitmq > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        echo "Starting Zapier RabbitMQ container..."
        docker start zapier_rabbitmq
    else
        echo "Zapier RabbitMQ container not found, creating a new one..."
        docker run -d --name zapier_rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3.13-management
    fi
}

case "$1" in
    start)
        start_or_run
        ;;
    stop)
        echo "Stopping Zapier RabbitMQ container..."
        docker stop zapier_rabbitmq
        ;;
    logs)
        echo "Fetching logs for Zapier RabbitMQ container..."
        docker logs -f zapier_rabbitmq
        ;;
    *)
        echo "Usage: $0 {start|stop|logs}"
        exit 1
esac