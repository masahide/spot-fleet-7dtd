#!/usr/bin/expect
set timeout 600
spawn telnet localhost 8081
expect -re " GameServer.Init successful"
send "exit\r"

expect eof
