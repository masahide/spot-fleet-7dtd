#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { spot7dtdStack } from "../lib/spot7dtd-stack";
import { spot7dtdBaseStack } from "../lib/base-stack";
import { sshPublicKey, getMyIP, getEnv } from "../lib/utils";

const prefix = "sdtd";
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};
const app = new cdk.App();
cdk.Tags.of(app).add("CDKName", prefix);

const baseStack = new spot7dtdBaseStack(app, `${prefix}Base`, {
  env: env,
  prefix: prefix,

  // ssh-pulickey strings (default: `ssh-add -L|head -n 1` command)
  sshPublicKey: sshPublicKey(),
  // my inetnet ip address. ex:"15.230.221.1/32" (default: `curl inet-ip.info`)
  myIP: getMyIP(),
});
cdk.Tags.of(baseStack).add("stackName", baseStack.stackName);

[
  {
    serverName: `sdtdPVE01`, // server name
    props: {
      env: env,
      prefix: prefix,
      base: baseStack.base,
      snapshotGen: 3, // number of snapshot generations
      volumeSize: 20, // EBS volume size (GB)
      discordChannelID: getEnv("DISCORD_CHANNELID"),
      route53domainName: getEnv("ROUTE53_ZONE_DNS_NAME"),
      route53hostZone: getEnv("ROUTE53_ZONEID"),
    },
  },
  {
    serverName: `sdtdPVE02`, // server name
    props: {
      env: env,
      prefix: prefix,
      base: baseStack.base,
      snapshotGen: 3, // number of snapshot generations
      volumeSize: 20, // EBS volume size (GB)
      discordChannelID: getEnv("DISCORD_CHANNELID"),
      route53domainName: getEnv("ROUTE53_ZONE_DNS_NAME"),
      route53hostZone: getEnv("ROUTE53_ZONEID"),
    },
  },
].map((conf) => {
  const stack = new spot7dtdStack(app, conf.serverName, conf.props);
  cdk.Tags.of(stack).add("stackName", stack.stackName);
});
