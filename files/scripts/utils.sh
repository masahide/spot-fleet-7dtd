#!/bin/bash

#. /var/tmp/aws_env

# Get the latest snapshot
_get_snapshot() {
	snapshots=$(aws ec2 describe-snapshots --owner-ids self \
		--query 'Snapshots[?(Tags[?Key==`'$SERVERNAME'`].Value)]')
	latestsnapshot=$(echo $snapshots | jq 'max_by(.StartTime)|.SnapshotId' -r)

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
		--tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value='${SERVERNAME}-${time}'},{Key='$SERVERNAME',Value=true}]')
	vid=$(echo "$volume" | jq -r '.VolumeId')
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
		--tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value='${SERVERNAME}-${time}'},{Key='$SERVERNAME',Value=true}]')
	vid=$(echo "$createvolume" | jq -r '.VolumeId')
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
		--query 'Snapshots[?(Tags[?Key==`'$SERVERNAME'`].Value)]')
	rmsids=$(echo $snapshots | jq 'sort_by(.StartTime)|.[:-'$SNAPSHOTGEN']|.[].SnapshotId' -r)
	for sid in $rmsids; do
		aws ec2 delete-snapshot --snapshot-id $sid
	done
}

get_ssm_value() {
	SSMPATH=/${PREFIX}/${SERVERNAME}
	aws ssm get-parameter --name "${SSMPATH}/${1}" --with-decryption | jq .Parameter.Value -r
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
		--tag-specifications 'ResourceType=snapshot,Tags=[{Key=Name,Value='${SERVERNAME}-${time}'},{Key='$SERVERNAME',Value=true}]'
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
		_create_new_volume
		;;
	*)
		_mount_snapshot $snapshot
		;;
	esac
}

stop_server() {
	[[ -z $PREFIX ]] && return
	[[ $SERVERNAME == "" ]] && SERVERNAME=$1
	sfrid=$(get_ssm_value sfrID)
	aws ec2 modify-spot-fleet-request --spot-fleet-request-id $sfrid --target-capacity 0
}

start_server() {
	[[ -z $PREFIX ]] && return
	[[ $SERVERNAME == "" ]] && SERVERNAME=$1
	sfrid=$(get_ssm_value sfrID)
	aws ec2 modify-spot-fleet-request --spot-fleet-request-id $sfrid --target-capacity 1
}

start_game() {
	[[ $(get_ssm_value maintenance) == true ]] && return
	docker-compose -f /var/lib/config/docker-compose.yml up -d
}
stop_game() {
	docker-compose -f /var/lib/config/docker-compose.yml down
}

stop_backup_shutdown() {
	stop_game
	sleep 3
	create_snapshot
	sleep 3
	stop_server
	sleep 3
	/usr/sbin/shutdown -h now
}

upsert_domain() {
	DOMAIN_NAME=${SERVERNAME}.$(get_ssm_value route53domainName)
	HOST_ZONE_ID=$(get_ssm_value route53hostZone)
	RECORD='{
  "Comment": "UPSERT '${DOMAIN_NAME}'",
  "Changes": [{
  "Action": "UPSERT",
  "ResourceRecordSet": {
  "Name": "'${DOMAIN_NAME}'",
  "Type": "A",
  "TTL": 5,
  "ResourceRecords": [{ "Value": "'${IPADDRESS}'"}]
}}]}'
	aws route53 change-resource-record-sets \
		--hosted-zone-id ${HOST_ZONE_ID} \
		--change-batch \
		file://<(echo ${RECORD})
}

post_discord() {
	[[ $(get_ssm_value maintenance) == true ]] && return
	DISCORD_CHANNEL_ID=$(get_ssm_value discordChannelID)
	BOT_TOKEN=$(get_ssm_value discordBotToken)
	URL=https://discordapp.com/api/channels/${DISCORD_CHANNEL_ID}/messages

	echo '{
  "content": "'${CONTENT}'",
  "tts": false
}' |
		curl -X POST -H "Content-Type: application/json" \
			-H "Authorization: Bot ${BOT_TOKEN}" \
			${URL} \
			-d @-
}

post_discord_response() {
	[[ $(get_ssm_value maintenance) == true ]] && return
	DISCORD_CHANNEL_ID=$(get_ssm_value discordChannelID)
	BOT_TOKEN=$(get_ssm_value discordBotToken)
	json=/tmp/7dtd_executer.data.json
	[[ -f $json ]] && [[ $(date "+%s") -le $(jq -r '.["ttl"]' $json) ]] && URL=$(jq -r '.["url"]' $json)
	[[ -z $URL ]] && URL=https://discordapp.com/api/channels/${DISCORD_CHANNEL_ID}/messages

	echo '{
  "content": "'${CONTENT}'",
  "tts": false
}
}' |
		curl -X POST -H "Content-Type: application/json" \
			-H "Authorization: Bot ${BOT_TOKEN}" \
			${URL} \
			-d @-
}
