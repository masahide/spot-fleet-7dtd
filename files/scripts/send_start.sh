#!/bin/bash


. /var/tmp/aws_env
SCRIPT_DIR=$(
	cd $(dirname $0)
	pwd
)
. ${SCRIPT_DIR}/utils.sh


check_action() {
	cat /mnt/game/log/console/sdtdserver-console.log | grep "GameServer.Init successful"
}

post() {
	DOMAIN_NAME=${SERVERNAME}.$(get_ssm_value route53domainName)
	CONTENT="${DOMAIN_NAME} 起動完了\nサーバーの起動が完了しました。ゲームが始められます。\nURL: steam://connect/${DOMAIN_NAME}:26900"
	post_discord
}

while :; do
	echo start
	check_action && break
	echo hoge
	sleep 2
done
post
