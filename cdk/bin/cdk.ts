#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { spot7dtdStack } from "../lib/spot7dtd-stack";
import { spot7dtdBaseStack } from "../lib/base-stack";

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};
const app = new cdk.App();

const sshPublicKey = process.env.SSH_PUB_KEY;
if (sshPublicKey === undefined) {
  throw new Error(`SSH_PUB_KEY environment variable not defined`);
}

const baseStack = new spot7dtdBaseStack(app, "spot7dtdBase", {
  env: env,
  sshPublicKey: sshPublicKey,
});

new spot7dtdStack(app, "spot7dtd", {
  env: env,
  serverName: "7dtd",
  volumeSize: 20,
  base: baseStack.base,
});
