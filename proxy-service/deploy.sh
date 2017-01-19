#!/usr/bin/env bash

DOCKER_HOST=tcp://prod:2375

docker -H $DOCKER_HOST pull 10.100.200.200:5000/proxy
docker -H $DOCKER_HOST run -d --rm -p 8000:8000 --name proxy 10.100.200.200:5000/proxy
