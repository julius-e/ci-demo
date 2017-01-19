#!/usr/bin/env bash

# Build the images
sudo docker build -t 10.100.200.200:5000/demo /vagrant/demo-service/.
sudo docker build -t 10.100.200.200:5000/demo-tests -f /vagrant/demo-service/Dockerfile.test /vagrant/demo-service/.

# Push to local repo
sudo docker push 10.100.200.200:5000/demo
sudo docker push 10.100.200.200:5000/demo-tests

