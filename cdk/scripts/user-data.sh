#!/bin/bash

setup () {
  yum update -y
  yum install -y docker jq
  systemctl start docker
  usermod -a -G docker ec2-user
  sudo curl -sL https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
  docker-compose version

}

set -ex
setup > /var/tmp/userdata.log 2>&1
set +ex

TOKEN=`curl -sX PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`
AZ=$(curl -sH "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/availability-zone)
INSTANCEID=$(curl -sH "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)
REGION=$(echo $AZ | sed -e 's/.$//')
echo $REGION >/var/tmp/aws_region
echo $AZ >/var/tmp/aws_az
echo $INSTANCEID >/var/tmp/aws_instanceid
