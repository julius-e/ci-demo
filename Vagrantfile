Vagrant.configure("2") do |config|
  config.vm.provider "virtualbox" do |v|
    v.memory = 2096
    v.cpus = 2
  end

  config.vm.box = "ubuntu/xenial64"
  config.vm.synced_folder ".", "/vagrant"

  config.vm.define :dev do |dev|
    config.vm.provision "ansible_local" do |ansible|
      ansible.playbook = "dev-env/ansible/docker.yml"
      ansible.extra_vars = {
        connection: "local"
      }
    end
  end

  config.vm.define "cd" do |n|
    n.vm.box = "ubuntu/trusty64"
    n.vm.hostname = "cd"
    n.vm.network "private_network", ip: "10.100.200.200"

    config.vm.provision "ansible_local" do |ansible|
      ansible.playbook = "dev-env/ansible/registry.yml"
      ansible.extra_vars = {
        connection: "local"
      }
    end
  end

  config.vm.define "prod" do |n|
    n.vm.box = "ubuntu/trusty64"
    n.vm.hostname = "prod"
    n.vm.network "private_network", ip: "10.100.200.201"

    config.vm.provision "ansible_local" do |ansible|
      ansible.playbook = "dev-env/ansible/docker.yml"
      ansible.extra_vars = {
        connection: "local"
      }
    end
  end

  if Vagrant.has_plugin?("vagrant-cachier")
    config.cache.scope = :box
  end
end
