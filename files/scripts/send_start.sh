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
	CONTENT="${DOMAIN_NAME} 起動完了\nサーバーの起動が完了しました。ゲームが始められます。\nURL: https://sc.suzu.me.uk/${DOMAIN_NAME}"
	post_discord
}

while :; do
	check_action && break
	sleep 2
done
post
