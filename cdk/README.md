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


# set discord token to ssm param
aws ssm put-parameter --name "/${PREFIX}/discordBotToken" --type "SecureString" --value "${DISCORD_TOKEN}"
aws ssm put-parameter --name "/${PREFIX}/discordPubKey" --type "String" --value "${DISCORD_PUBKEY}"
```

## build & deploy

```
. .env; npx aws-cdk deploy sdtdPVE01
```
