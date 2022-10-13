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

SVNAME=$1
VOLSIZE=$2
TOKEN=`curl -sX PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`
AZ=$(curl -sH "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/availability-zone)
INSTANCEID=$(curl -sH "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)
REGION=$(echo $AZ | sed -e 's/.$//')

cat << EOS > /var/tmp/aws_env
SVNAME=$SVNAME
VOLSIZE=$VOLSIZE
AZ=$AZ
INSTANCEID=$INSTANCEID
REGION=$REGION
EOS

. /var/lib/scripts/utils.sh
set -x
mount_latest >>/var/tmp/userdata_mount.log 2>&1
