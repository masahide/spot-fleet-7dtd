#!/bin/bash

LISTFILE=/mnt/config/ipset_list
MIN=1440
SETNAME=allow_list

find $LISTFILE -mmin +$MIN -a -type f -exec rm -f {} \;
[[ -f $LISTFILE ]] ||
	curl -sL http://nami.jp/ipv4bycc/cidr.txt.gz |
	zcat |
	sed -n 's/^JP\t//p' \
		>$LISTFILE

/usr/sbin/ipset create $SETNAME hash:net
/usr/sbin/ipset flush $SETNAME 2>/tmp/ipset.err.log

while read line; do
	/usr/sbin/ipset add $SETNAME $line 2>>/tmp/ipset.err.log
done <$LISTFILE

/sbin/iptables --flush INPUT
/sbin/iptables -A INPUT -p ALL -s 127.0.0.1 -j ACCEPT
/sbin/iptables -A INPUT -p ALL -s 172.16.0.0/12 -j ACCEPT
/sbin/iptables -A INPUT -p ALL -s 192.168.0.0/16 -j ACCEPT
/sbin/iptables -A INPUT -p ALL -s 10.0.0.0/8 -j ACCEPT
/sbin/iptables -A INPUT -p ALL -m state --state ESTABLISHED,RELATED -j ACCEPT
# UDP (50261)
/sbin/iptables -A INPUT -p udp --dport 50261 -m set --match-set $SETNAME src -j ACCEPT
/sbin/iptables -A INPUT -p udp --dport 50261 -j DROP
# UDP（26900-26903)
/sbin/iptables -A INPUT -p udp --dport 26900:26903 -m set --match-set $SETNAME src -j ACCEPT
/sbin/iptables -A INPUT -p udp --dport 26900:26903 -j DROP
# TCP（26900）
/sbin/iptables -A INPUT -p tcp --dport 26900 -m set --match-set $SETNAME src -j ACCEPT
/sbin/iptables -A INPUT -p tcp --dport 26900 -j DROP
# https
/sbin/iptables -A INPUT -p tcp -m state --state NEW -m tcp --dport 443 -m set --match-set $SETNAME src -j ACCEPT
/sbin/iptables -A INPUT -p tcp --dport 443 -j DROP
# api port
/sbin/iptables -A INPUT -p tcp -m state --state NEW -m tcp --dport 28082 -m set --match-set $SETNAME src -j ACCEPT
/sbin/iptables -A INPUT -p tcp --dport 28082 -j DROP
