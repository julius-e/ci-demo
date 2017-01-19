#!/usr/bin/env bash

# Build the images
sudo docker build -t 10.100.200.200:5000/proxy /vagrant/proxy-service/.

# Push to local repo
sudo docker push 10.100.200.200:5000/proxy
