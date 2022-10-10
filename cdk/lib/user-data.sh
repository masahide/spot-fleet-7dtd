#!/bin/bash

setup () {
  yum update -y
  yum install -y docker
  systemctl start docker
  usermod -a -G docker ec2-user
  sudo curl -sL https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
  docker-compose version
}

set -ex
setup > /var/tmp/userdata.log 2>&1
