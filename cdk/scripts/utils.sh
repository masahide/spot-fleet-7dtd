#!/bin/bash

TOKEN=`curl -sX PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`
AZ=$(curl -sH "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/availability-zone)
INSTANCEID=$(curl -sH "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)
NAME=spot7dtd


echo AZ: $AZ
echo INSTANCEID: $INSTANCEID

init () {
  set -ex
  createvolume=$(aws ec2 create-volume --volume-type gp3 --size 20 --availability-zone $AZ --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value='$NAME'}]')
  vid=$(echo "$createvolume" |jq -r '.VolumeId')
  echo $vid >/var/tmp/aws_vid
  echo volumeID: $vid
  aws ec2 wait volume-available --volume-ids $vid
  aws ec2 attach-volume --volume-id $vid --instance-id $INSTANCEID --device /dev/sdf
  sleep 5
  sudo mkfs /dev/sdf
  mount /dev/sdf /mnt
}


del() {
  set -ex
  vid=$(cat /var/tmp/aws_vid)
  ## detach-volume
  umount /mnt
  aws ec2 detach-volume --volume-id $vid
  # aws ec2 detach-volume --volume-id $vid --force
  ## create-snapshot
  time=$(date "+%Y%m%d-%H%M%S")
  aws ec2 create-snapshot --volume-id $vid --description "$Name backup $time" --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Name,Value='${NAME}-${time}'},{Key='$NAME',Value=true}]'
  sleep 5
  ## delete-volume
  aws ec2 delete-volume --volume-id $vid
}
