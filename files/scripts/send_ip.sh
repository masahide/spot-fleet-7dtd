#!/bin/bash

. /var/tmp/aws_env
SCRIPT_DIR=$(
	cd $(dirname $0)
	pwd
)
. ${SCRIPT_DIR}/utils.sh

DOMAIN_NAME=${SERVERNAME}.$(get_ssm_value route53domainName)
CONTENT="${DOMAIN_NAME} のIPは ${IPADDRESS} になりました\n${SERVERNAME}の起動処理を始めました. しばらくお待ちください."
post_discord
