#!/bin/bash

. /var/tmp/aws_env
SCRIPT_DIR=$(
	cd $(dirname $0)
	pwd
)
. ${SCRIPT_DIR}/utils.sh

check_action() {
	TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600") && curl -s -H "X-aws-ec2-metadata-token: $TOKEN" v http://169.254.169.254/latest/meta-data/spot/instance-action | grep action
}

start_shutdown() {
	CONTENT="amazonからスポットインスタンス中断通知を受信しました\n10秒後に${SERVERNAME}サーバーを安全に停止します\n停止後にDiscordから再起動してください"
	post_discord
  sleep 10
	stop_backup_shutdown
	CONTENT="${SERVERNAME}サーバーを停止しました"
	post_discord
	/usr/sbin/shutdown -h now
	exit
}

while :; do
	check_action && start_shutdown
	sleep 10
done
