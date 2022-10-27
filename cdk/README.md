## setup enviroment

vim bin/cdk.ts

## edit .env

```bash
cp .env.sample .env
vim .env
```

## setup

```
# load .env
. .env

# server name
SERVER=sdtdPVE01

# set discord token to ssm param
aws ssm put-parameter --name "/${PREFIX}/${SERVER}/discordBotToken" --type "SecureString" --value "${DISCORD_TOKEN}"
```

## build & deploy

```
. .env; npx aws-cdk deploy sdtdPVE01
```
