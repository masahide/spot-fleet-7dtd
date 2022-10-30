#!/bin/bash

TIME=600

. /var/tmp/aws_env
SCRIPT_DIR=$(
	cd $(dirname $0)
	pwd
)
. ${SCRIPT_DIR}/utils.sh

FILE=/tmp/players

players() {
	${SCRIPT_DIR}/expect/listplayer.sh >$FILE
	cat $FILE | grep "in the game" | grep -Eo "[0-9]{1,4}"
}

[[ $(get_ssm_value maintenance) == true ]] && return
[[ "$(players)" -eq "0" ]] || exit 0

echo sleep $TIME sec...
sleep $TIME

[[ $(get_ssm_value maintenance) == true ]] && return
[[ "$(players)" -eq "0" ]] || exit 0

CONTENT="サーバーを停止しました"
post_discord

stop_backup_shutdown
