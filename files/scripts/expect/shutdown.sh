#!/usr/bin/expect -f

set timeout 5
set hostname localhost

spawn telnet localhost 8081

#expect {
#  "Please enter password:" {
#    send "$password\r"
#  }
#}

send "saveworld\r"
expect "World saved\r"

send "shutdown\r"
#send "exit\r"
expect eof
