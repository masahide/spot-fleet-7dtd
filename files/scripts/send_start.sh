#!/bin/bash

[[ $1 == "" ]] && sleep 180

. /var/tmp/aws_env
SCRIPT_DIR=$(
	cd $(dirname $0)
	pwd
)
. ${SCRIPT_DIR}/utils.sh

${SCRIPT_DIR}/expect/check_start.sh >/tmp/check_start.log

DOMAIN_NAME=${SERVERNAME}.$(get_ssm_value route53domainName)

CONTENT="${DOMAIN_NAME} 起動完了\nサーバーの起動が完了しました。ゲームが始められます。\nURL: steam://connect/${DOMAIN_NAME}:26900"
post_discord_response
