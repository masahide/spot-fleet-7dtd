#!/bin/bash

#TOKEN=`curl -sX PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`
#AZ=$(curl -sH "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/availability-zone)
#INSTANCEID=$(curl -sH "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)

. /var/tmp/aws_env

# Get the latest snapshot
_get_snapshot() {
  snapshots=$(aws ec2 describe-snapshots --owner-ids self \
    --query 'Snapshots[?(Tags[?Key==`'$SVNAME'`].Value)]')
  latestsnapshot=$(echo $snapshots|jq 'max_by(.StartTime)|.SnapshotId' -r)

  #[[ "null" == "$latestsnapshot" ]] &&  return
  echo $latestsnapshot
}

# mount snapshot
_mount_snapshot() {
  snapshot=$1
  time=$(date "+%Y%m%d-%H%M%S")
  volume=$(aws ec2 create-volume --volume-type gp3 \
    --availability-zone $AZ \
    --snapshot-id $snapshot \
    --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value='${SVNAME}-${time}'},{Key='$SVNAME',Value=true}]')
  vid=$(echo "$volume" |jq -r '.VolumeId')
  echo $vid >/var/tmp/aws_vid
  echo volumeID: $vid
  aws ec2 wait volume-available --volume-ids $vid
  aws ec2 attach-volume --volume-id $vid --instance-id $INSTANCEID --device /dev/sdf
  sleep 5
  mount /dev/sdf /mnt
}

# Create new volume and mount
_create_new_volume() {
  time=$(date "+%Y%m%d-%H%M%S")
  createvolume=$(aws ec2 create-volume --volume-type gp3 \
    --size $VOLSIZE \
    --availability-zone $AZ \
    --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value='${SVNAME}-${time}'},{Key='$SVNAME',Value=true}]')
  vid=$(echo "$createvolume" |jq -r '.VolumeId')
  echo $vid >/var/tmp/aws_vid
  echo volumeID: $vid
  aws ec2 wait volume-available --volume-ids $vid
  aws ec2 attach-volume --volume-id $vid --instance-id $INSTANCEID --device /dev/sdf
  sleep 5
  sudo mkfs.xfs /dev/sdf
  mount /dev/sdf /mnt
}

# Delete old ones, leaving $SNAPSHOTGEN generations
_delete_old_snapshot() {
  snapshots=$(aws ec2 describe-snapshots --owner-ids self \
    --query 'Snapshots[?(Tags[?Key==`'$SVNAME'`].Value)]')
  rmsids=$(echo $snapshots|jq 'sort_by(.StartTime)|.[:-'$SNAPSHOTGEN']|.[].SnapshotId' -r)
  for sid in $rmsids;do
    aws ec2 delete-snapshot --snapshot-id $sid
  done
}

# Unmount to create a snapshot and delete volume
create_snapshot() {
  vid=$(cat /var/tmp/aws_vid)
  ## detach-volume
  umount -f /mnt
  aws ec2 detach-volume --volume-id $vid
  # aws ec2 detach-volume --volume-id $vid --force
  ## create-snapshot
  time=$(date "+%Y%m%d-%H%M%S")
  aws ec2 create-snapshot --volume-id $vid \
    --description "$Name backup $time" \
    --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Name,Value='${SVNAME}-${time}'},{Key='$SVNAME',Value=true}]'
  sleep 2
  ## delete-volume
  aws ec2 wait volume-available --volume-ids $vid
  aws ec2 delete-volume --volume-id $vid
  _delete_old_snapshot
}


mount_latest() {
  snapshot=$(_get_snapshot)
  case "$snapshot" in
    "null")
      _create_new_volume;;
    *)
      _mount_snapshot $snapshot;;
  esac
}


stop_server() {
    sfrid=$(aws ssm get-parameter --name "/${PREFIX}/${STACKNAME}/sfrID"|jq .Parameter.Value -r)
    aws ec2 modify-spot-fleet-request --spot-fleet-request-id $sfrid --target-capacity 0
}
