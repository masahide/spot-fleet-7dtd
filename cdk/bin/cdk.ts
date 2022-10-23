#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { spot7dtdStack } from "../lib/spot7dtd-stack";
import { spot7dtdBaseStack } from "../lib/base-stack";
import { sshPublicKey, getMyIP } from "../lib/utils";

const prefix = "spot7dtd";
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};
const app = new cdk.App();

const baseStack = new spot7dtdBaseStack(app, `${prefix}Base`, {
  env: env,
  prefix: prefix,

  // ssh-pulickey strings (default: `ssh-add -L|head -n 1` command)
  sshPublicKey: sshPublicKey(),
  // my inetnet ip address. ex:"15.230.221.1/32" (default: `curl inet-ip.info`)
  myIP: getMyIP(),
});

const post7dtd01Stack = new spot7dtdStack(app, `${prefix}PVE01`, {
  env: env,
  prefix: prefix,
  base: baseStack.base,
  snapshotGen: 3, // number of snapshot generations
  volumeSize: 20, // EBS volume size (GB)
  discordChannelID: "channelID",
  route53domainName: "domain",
  route53hostZone: "aaaa",
});

cdk.Tags.of(app).add("CDKName", prefix);
cdk.Tags.of(baseStack).add("stackName", `${prefix}base`);
cdk.Tags.of(post7dtd01Stack).add("stackName", `${prefix}pve01`);
