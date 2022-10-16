#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { spot7dtdStack } from "../lib/spot7dtd-stack";
import { spot7dtdBaseStack } from "../lib/base-stack";
import { sshPublicKey, getMyIP } from "../lib/utils";

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};
const app = new cdk.App();

const baseStack = new spot7dtdBaseStack(app, "spot7dtdBase", {
  env: env,

  // ssh-pulickey strings (default: `ssh-add -L|head -n 1` command)
  sshPublicKey: sshPublicKey(),
  // my inetnet ip address. ex:"15.230.221.1/32" (default: `curl inet-ip.info`)
  myIP: getMyIP(),
});

const spot = new spot7dtdStack(app, "spot7dtd", {
  env: env,
  base: baseStack.base,
  serverName: "7dtd", // ec2 instance name
  snapshotGen: 3, // number of snapshot generations
  volumeSize: 20, // EBS volume size (GB)
});

