#!/usr/bin/env bash

# This is a bash implementation of a URL encoder.  This is required to send the new container url to the proxy.
# It is from here: http://stackoverflow.com/a/10660730
rawurlencode() {
  local string="${1}"
  local strlen=${#string}
  local encoded=""
  local pos c o

  for (( pos=0 ; pos<strlen ; pos++ )); do
     c=${string:$pos:1}
     case "$c" in
        [-_.~a-zA-Z0-9] ) o="${c}" ;;
        * )               printf -v o '%%%02x' "'$c"
     esac
     encoded+="${o}"
  done
  echo "${encoded}"    # You can either set a return variable (FASTER)
  REPLY="${encoded}"   #+or echo the result (EASIER)... or both... :p
}

DOCKER_HOST=tcp://prod:2375

# Pull newest images
docker -H ${DOCKER_HOST} pull 10.100.200.200:5000/demo
docker -H ${DOCKER_HOST} pull 10.100.200.200:5000/demo-tests

# Run container
CONTAINER_ID=$(docker -H ${DOCKER_HOST} run -d -p 8080 10.100.200.200:5000/demo)
echo Container ID is ${CONTAINER_ID}
CONTAINER_PORT=$(docker -H ${DOCKER_HOST} inspect ${CONTAINER_ID} | jq -r '.[0].NetworkSettings.Ports["8080/tcp"][0].HostPort')
echo Container Port is ${CONTAINER_PORT}

# Force stop tests if they are still running for whatever reason
docker -H ${DOCKER_HOST} rm -f demo-tests

# Run tests on newly deployed container
docker run -it --rm -e "URL=http://10.100.200.201:${CONTAINER_PORT}" --name demo-tests 10.100.200.200:5000/demo-tests

# Register the new service on prod
curl -XPOST http://prod:8000/services/demo/$(rawurlencode "http://10.100.200.201:${CONTAINER_PORT}")

# Remove old version(s)
docker -H ${DOCKER_HOST} rm -f $(docker -H ${DOCKER_HOST} ps -q -f ancestor=10.100.200.200:5000/demo -f before=${CONTAINER_ID})