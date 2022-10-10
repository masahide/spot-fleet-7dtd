## setup enviroment

```bash
export SSH_PUB_KEY=$(ssh-add -L|head -n 1)
export MYIP="$(curl inet-ip.info)/32"
```

## build & deploy

- `npm run build` compile typescript to js
- `npx aws-cdk list`
- `npx aws-cdk deploy xxxx` deploy this stack to your default AWS account/region

- `npx aws-cdk diff` compare deployed stack with current state
- `npx aws-cdk synth` emits the synthesized CloudFormation template
