CI Demo
=======

This demo leverages docker to run a simple service in a container.  Integration tests are included in a separate 
container, and can be run in a self-contained configuration or against a remote url.  This way, we can re-use the 
integration tests to verify our service in production.

I use docker so that the build process is repeatable and reproducible.  Docker could be replaced in this configuration
with virtual machines or AWS images with some changes.  The goal is to have an immutable image to deploy, whether that 
be a container image or a VM image.  Immutability provides certainty that what we deployed will work as expected.

I use vagrant (and virtual box) to streamline the development environment setup and to provide additional VMs to 
simulate production.

I use ansible to bootstrap software on the VMs.  Ansible has a great configuration based solution (similar to the other
tools used in this demo) to declare the end state that each machine should have. 

The production environment is configured so that there is a proxy sitting in front of the service tier.  This proxy
is configured to point to the current active instance of the service.  When the CD system deploys to production, it
will only switch over to the new version if all integration tests have succeeded.  The proxy in this configuration 
can serve multiple purposes.  If there are many instance of a service running, the proxy can also act as a load balancer.
If we wish to A/B test a new version of the service, we can configure the proxy to redirect only a segment of users to
the new version.

To get started, you will need a Linux environment with both Vagrant and Virtual Box installed.  Those are the only 
requirements.  Everything else will handled via VMs and containers.

Development
-----------

This section is dedicated to what happens on a developer's machine.  The goal here is to iterate through changes until
they are ready to be pushed.

Virtual machines are a good way to keep development environments consistent from developer to developer and from 
machine to machine.  A Vagrantfile is included at the root of the demo.  It includes definitions for the dev environment
as well as the CI/CD machine and the prod machine.  

Docker uses Dockerfiles to document the steps required to package software.  These files are included in both the 
demo service and in the proxy service directories.

Each time a developer builds the demo service container image, the unit tests for the service are run.  This means
that the container build will fail if the unit tests fail.  It is recommended to build the container for your software
at least once before pushing.

Here are the steps to build the demo service in the dev VM:
-----------------------------------------------------------

To ssh into the dev machine:
```bash
vagrant up dev
vagrant ssh dev
```

To build a container image and test image for the demo recommendation service:
```bash
sudo docker build -t demo /vagrant/demo-service/.
sudo docker build -t demo-test -f /vagrant/demo-service/Dockerfile.test /vagrant/.
```

To run the service:
```bash
sudo docker run -d --name "service" demo
```

To run the integration tests on a self-contained instance of the service:
```bash
sudo docker run -d --name "tests" demo-test
```

To run the integration tests on a instance running somewhere remotely:
```bash
sudo docker run -d -p 7070:8080 --name "service" demo
sudo docker run --rm --net=host -it -e "URL=http://localhost:7070" --name "tests" demo-test
```

Continuous Integration & Continuous Deployment
----------------------------------------------

*Assumptions:*

For the sake of the demo simplicity, I will not try to configure a Jenkins environment.  Instead, we will ssh into a 
VM that will represent our CI/CD node.  We will execute scripts on this node.  When we run scripts on this node assume 
that Jenkins would have run it on checkin. 

*The flow from dev to prod is as follows:*

- Developer makes changes to code on their machine
- Changes are commited to source control
- The CI system picks up changes and does the following:
  - Runs tests, if tests fail, build fails
  - Builds the docker image and pushes it to docker repo
  - Allocates a new container on prod
  - Runs integration tests on new container
    - If integration tests succeed, prod is redirected to new container
    - If integration tests fail in production, the build fails, and prod is *not* switched to new version
  
So far we have covered the first two bullets.  The developer has made changes and has commited those changes to source
control.  Next we will cover what happens on CI/CD machine.

SSH into the cd node:
```bash
exit # Leave the Development VM
vagrant up cd prod
vagrant ssh cd
```

In the directory of the demo and the proxy service there are two scripts: build-and-push-images.sh and deploy.sh.  
These scripts will get our code into production from the cd node.  All commands are remotely executed from the cd node.  
We will not SSH into production.

Lets get the proxy running:

```bash
/vagrant/proxy-service/build-and-push-images.sh
/vagrant/demo-service/build-and-push-images.sh
```

The build-and-push-images.sh script will create the images and push them to a local image repo.  This will allow any 
node with visibility of cd to pull images and use them.  Unit tests are run when building the images, so if those tests
fail, the build will fail.

The contents of one of these scripts isn't terribly interesting (this is proxy-service/build-and-push-images.sh): 
```bash
#!/usr/bin/env bash

# Build the images
sudo docker build -t 10.100.200.200:5000/proxy /vagrant/proxy-service/.

# Push to local repo
sudo docker push 10.100.200.200:5000/proxy
```

Start proxy service in production:
```bash
/vagrant/proxy-service/deploy.sh
```

This script will turn on the proxy.  Due to the constraints of this demo, the proxy must be started before the demo
service is deployed.  In real life, I would make it so that there is no dependency.

We can confirm that the proxy is running with this command
```bash
curl -v http://prod:8000/services/demo
```

This should return the "default" configuration for the proxy.
 ```json
 {
   "url": {
     "url": "http://10.100.200.201:8080",
     "name": "demo"
   }
 }
```

This demo proxy assumes the existence of the demo service.  In real life, the proxy would allow assignment to any url
dynamically.

Start demo service in production:
```bash
/vagrant/demo-service/deploy.sh
```

This script is interesting:
```bash
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
```

We use DOCKER_HOST=tcp://prod:2375 to indicate to the docker command line that we are going to manage a remote machine.
This demo uses an unauthenticated version of the remote protocol.  In real life, this should be much more tightly 
restricted.

```bash
# Run container
CONTAINER_ID=$(docker -H ${DOCKER_HOST} run -d -p 8080 10.100.200.200:5000/demo)
echo Container ID is ${CONTAINER_ID}
CONTAINER_PORT=$(docker -H ${DOCKER_HOST} inspect ${CONTAINER_ID} | jq -r '.[0].NetworkSettings.Ports["8080/tcp"][0].HostPort')
echo Container Port is ${CONTAINER_PORT}
```

These two commands start the container on prod.  The CONTAINER_ID returned from the run command is used to look up the
container's metadata.  From this metadata we are able to figure out what port docker assigned to the container.  We
will use this information to upate the proxy.

```bash
# Run tests on newly deployed container
docker run -it --rm -e "URL=http://10.100.200.201:${CONTAINER_PORT}" --name demo-tests 10.100.200.200:5000/demo-tests
```

Earlier we talked about reusing the integration tests to validate the application in production.  This command runs
the tests against the newly deployed container.  At this point the proxy is still pointing at the old version of the
service.  If these tests fail, the deploy will fail (since we are running in -it mode).  This way the cut over will
be seamless and there will be no downtime regardless of whether the deploy succeeded or failed.

It should be noted here that the tests we use to validate production should be representative of what "working" means.
The tests in this demo are not comprehensive, and only check that the service returns a value and a 200 status code.

```bash
# Register the new service on prod
curl -XPOST http://prod:8000/services/demo/$(rawurlencode "http://10.100.200.201:${CONTAINER_PORT}")
```

Now that the tests have run successfully, we will cut over the proxy from the old version to the new one.  The proxy 
included in the demo exposes a route to post locations.  Again, we are using the dynamically assigned port from earlier.
 
```bash
# Remove old version(s)
docker -H ${DOCKER_HOST} rm -f $(docker -H ${DOCKER_HOST} ps -q -f ancestor=10.100.200.200:5000/demo -f before=${CONTAINER_ID})
```

Now we clean up the old container(s).  This command finds instances of the service that are not the one we just deployed.
This imposes a restriction of one instance of a service running on production at a time.  In real life we would have 
a much more flexible way to provision services to hosts.

To verify that everything is working as intended, we will run:
```bash
curl -v http://prod:8000/services/demo
curl http://prod:8000/demo/1
```

`curl -v http://prod:8000/services/demo` will return the new url for the demo service: 
```json
{
  "url": {
    "url": "http://10.100.200.201:32768",
    "name": "demo"
  }
}
```

`curl http://prod:8000/demo/1` will return a recommendation object (the value is random). 
```json
{
  "rec": 7671
}
```

And lets look at what container the service is running in:
```bash
docker -H tcp://prod:2375 ps
```

Returns something like:
```text
CONTAINER ID        IMAGE                       COMMAND                  CREATED             STATUS              PORTS                     NAMES
329cfc2b1305        10.100.200.200:5000/demo    "/bin/sh -c 'npm s..."   54 minutes ago      Up 54 minutes       0.0.0.0:32785->8080/tcp   hungry_colden
d0c4708c0716        10.100.200.200:5000/proxy   "/bin/sh -c 'npm s..."   About an hour ago   Up About an hour    0.0.0.0:8000->8000/tcp    proxy
```

To verify the production pipeline, lets run the deploy script again:
```bash
/vagrant/demo-service/deploy.sh
```

Now if we check the service, it should still be returning values.  If we rerun the docker ps command:
```text
CONTAINER ID        IMAGE                       COMMAND                  CREATED             STATUS              PORTS                     NAMES
9723424fabef        10.100.200.200:5000/demo    "/bin/sh -c 'npm s..."   6 seconds ago       Up 6 seconds        0.0.0.0:32786->8080/tcp   inspiring_wozniak
d0c4708c0716        10.100.200.200:5000/proxy   "/bin/sh -c 'npm s..."   About an hour ago   Up About an hour    0.0.0.0:8000->8000/tcp    proxy
```

Notice that the name of the demo container and the host port mapping have changed.

Conclusion
----------

Hopefully I have illustrated what is possible with a container based dev/ci/cd/prod environment.  Docker is only one
way to get the benefits of immutable containers in your environment.  We could rewrite this demo to use VMs instead of
containers.  The key point is that a definition exists somewhere detailing how something should be constructed.

Changes/Improvements
--------------------

There is a lot of room for improvement in this demo.  The interaction between provisioning containers and updating the
consumers of the container is clunky.  There are tools that can hook into docker to and automatically update a service
registry with the container's info.  

Registrator is one such tool: https://github.com/gliderlabs/registrator

Another improvement would separating the proxy from the service registration. If we were to use something etcd 
(https://github.com/coreos/etcd) or Consul (https://www.consul.io/) we could have all the metadata associated with 
our containers stored in a consistent location with a known API.  We could configure these tools to make changes to 
our proxy's configuration.  That would be a better separation of responsibilities.

Additionally, a dedicated proxy solution would be an improvement over the proxy used in the demo.  nginx is a 
possibility.

The proxy in the solution should be treated just like any other service running in containers.  

After addressing those concerns, the next steps would be to take a look at adding features like self-healing and 
on demand scaling.  For self-healing, we would want to implement some health checks on the services so that a
monitor may ping them to determine the state of the service.  On demand scaling is similar in that we would want to 
use information about our system to determine whether we should take some preventative actions.  In either case we would
likely need an additional tool to monitor our system and to take action.

Considerations
--------------

While I was bringing this demo together, the following things came to mind:

* More heavy weight services, such as a Hadoop stack would need more attention.  The more layers required in a 
container, the harder it is to maintain and deploy.
  * A possibility is to use VMs and provision software with ansible
* I am not sure whether the proxy should have a dynamically assigned port, like the other services, or if it should have 
static port, like we had in the demo.